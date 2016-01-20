"use strict";

const async = require("async");
const CappedFileSystem = require("./capped-file-system");
const logger = require("@oo/shared").logger;
const OnlineOffline = require("@oo/shared").OnlineOffline;
const DockerHandler = require("./docker-handler");
const config = require("@oo/shared").config;
const fs = require("fs");
const path = require("path");

// Include timeLimit() and silent()
const timeLimit = require("@oo/shared").timeLimit;
const silent = require("@oo/shared").silent;

class OctaveSession extends OnlineOffline {
	constructor(sessCode) {
		super();
		this.sessCode = sessCode;
		this._log = logger("octave-session:" + sessCode);

		this._legalTime = config.session.legalTime.guest;
		this._payloadLimit = config.session.payloadLimit.guest;

		this.resetTimeout();
		this._resetPayload();

		this._cfs1 = new CappedFileSystem(this.sessCode, config.docker.diskQuotaKiB);
		this._cfs2 = new CappedFileSystem(this.sessCode, config.docker.diskQuotaKiB);
		this._filesSession = new DockerHandler(this.sessCode, config.docker.images.filesystemSuffix);
		this._hostSession = new DockerHandler(this.sessCode, config.docker.images.octaveSuffix);

		this._filesSession.on("message", this._handleMessage.bind(this));
		this._hostSession.on("message", this._handleMessage.bind(this));

		this._cfs1.on("error", this._handleError.bind(this));
		this._filesSession.on("error", this._handleError.bind(this));
		this._hostSession.on("error", this._handleError.bind(this));
		this.on("error", this._handleError.bind(this));
	}

	_doCreate(next) {
		this._sessionLogStream = fs.createWriteStream(path.join("/srv/oo/logs", `${this.sessCode}.log`));

		async.auto({
			"cfs1": (_next) => {
				this._log.trace("Requesting creation of capped file system 1");
				this._cfs1.create((err, dataDir1) => {
					if (!err) this._dataDir1 = dataDir1;
					_next(err);
				});
			},
			"cfs2": (_next) => {
				this._log.trace("Requesting creation of capped file system 2");
				this._cfs2.create((err, dataDir2) => {
					if (!err) this._dataDir2 = dataDir2;
					_next(err);
				});
			},
			"files": ["cfs1", "cfs2", (_next) => {
				this._log.trace("Requesting creation of file manager process");
				this._filesSession.create(_next, this._dataDir1, this._dataDir2);
			}],
			"host": ["cfs1", "cfs2", (_next) => {
				this._log.trace("Requesting creation of Octave host process");
				this._hostSession.create(_next, this._dataDir1, this._dataDir2);
			}]
		}, (err) => {
			if (err) return next(err);
			this._log.info("Session successfully created");
			return next(null);
		});
	}

	_doDestroy(next, reason) {
		// TODO: Add an alternative destroy implementation that is synchronous, so that it can be run in an exit handler.
		if (this._countdownTimer) clearTimeout(this._countdownTimer);
		if (this._timewarnTimer) clearTimeout(this._timewarnTimer);
		if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
		if (this._autoCommitTimer) clearInterval(this._autoCommitTimer);
		if (this._sessionLogStream) this._sessionLogStream.end(reason);
		async.auto({
			"host": (_next) => {
				this._log.trace("Requesting termination of Octave host process");
				this._hostSession.destroy(_next);
			},
			"commit": (_next) => {
				this._log.trace("Requesting to commit changes to Git");
				this._commit("Scripted user file commit", silent(/Out of time/, _next));
			},
			"files": ["commit", (_next) => {
				this._log.trace("Requesting termination of file manager process");
				this._filesSession.destroy(_next);
			}],
			"cfs1": ["host", "files", (_next) => {
				this._log.trace("Requesting deletion of capped file system 1");
				this._cfs1.destroy(_next);
			}],
			"cfs2": ["host", "files", (_next) => {
				this._log.trace("Requesting deletion of capped file system 2");
				this._cfs2.destroy(_next);
			}]
		}, (err) => {
			if (err) return next(err);
			this._log.info("Session successfully destroyed:", reason);
			return next(null);
		});
	}

	interrupt() {
		this._hostSession.interrupt();
	}

	_commit(comment, next) {
		// Set a 60-second time limit
		let _next = timeLimit(config.git.commitTimeLimit, [new Error("Out of time")], next);

		// Call the callback when a "committed" message is received
		let messageCallback = (name, content) => {
			if (name === "committed") {
				_next(null);
				this._filesSession.removeListener("message", messageCallback);
			}
		};
		this._filesSession.on("message", messageCallback);

		// Request the commit
		this._filesSession.sendMessage("commit", { comment });
	}

	// COUNTDOWN METHODS: For interrupting the Octave kernel after a fixed number of seconds to ensure a fair distribution of CPU time.
	_startCountdown() {
		this._endCountdown();
		this._countdownTimer = setTimeout(() => {
			this.interrupt();
			this.emit("message", "err", "!!! OUT OF TIME !!!\n");
		}, this._legalTime);
	}
	_endCountdown() {
		if (this._countdownTimer) clearTimeout(this._countdownTimer);
	}

	// TIMEOUT METHODS: For killing the Octave kernel after a fixed number of seconds to clear server resources when the client is inactive.
	resetTimeout() {
		if (this._timewarnTimer) clearTimeout(this._timewarnTimer);
		if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
		this._timewarnTimer = setTimeout(() => {
			this.emit("message", "err", config.session.timewarnMessage+"\n");
		}, config.session.timewarnTime);
		this._timeoutTimer = setTimeout(() => {
			this._log.info("Session Timeout");
			this.emit("message", "destroy", "Session Timeout");
		}, config.session.timeoutTime);
	}

	// PAYLOAD METHODS: For interrupting the Octave kernel after a large amount of stdout/stderr data to prevent infinite loops from using too much bandwidth.
	_resetPayload() {
		this._payloadSize = 0;
		this._payloadInterrupted = false;
	}
	_appendToPayload(content) {
		this._payloadSize += content.length;
		if (this._payloadSize > this._payloadLimit && !this._payloadInterrupted) {
			this._payloadInterrupted = true;
			this.interrupt();
			// Send the error message after a small delay in order to let the output buffers flush first
			setTimeout(() => {
				this.emit("message", "err", "!!! PAYLOAD TOO LARGE !!!\n");
			}, config.session.payloadMessageDelay);
		}
	}

	// AUTO-COMMIT METHODS: For auto-committing the user's files on a fixed interval.
	_startAutoCommitLoop() {
		this._autoCommitTimer = setInterval(() => {
			this._log.debug("Requesting auto-commit...");
			this._commit("Scripted auto-commit", this._handleError.bind(this));
		}, config.git.autoCommitInterval);
	}

	// SESSION LOG: Log all commands, input, and output to a log file
	_appendToSessionLog(type, content) {
		if (!this._sessionLogStream) return this._log.warn("Cannot log before created");
		if (this._sessionLogStream.closed) return this._log.warn("Cannot log to a closed stream");
		if (type === "cmd") content += "\n";
		this._sessionLogStream.write(`${type}: ${content}----\n`);
	}

	sendMessage(name, content) {
		switch (name) {
			// Messages requiring special handling
			case "interrupt":
				this._hostSession.interrupt();
				break;

			case "cmd":
				this._startCountdown();
				this.resetTimeout();
				this._hostSession.sendMessage(name, content);
				this._appendToSessionLog(name, content);
				break;

			case "user-info":
				if (content && content.user) {
					this._startAutoCommitLoop();
					if (content.user.legalTime) this._legalTime = content.user.legalTime;
					if (content.user.payloadLimit) this._payloadLimit = content.user.payloadLimit;
				}
				this._filesSession.sendMessage(name, content);
				break;

			// Messages to forward to the file manager
			case "user-info":
			case "list":
			case "refresh":
			case "save":
			case "rename":
			case "delete":
			case "binary":
			case "siofu_start":
			case "siofu_progress":
			case "siofu_done":
				this._filesSession.sendMessage(name, content);
				break;

			// Messages to forward to the Octave host
			case "request-input-answer":
			case "confirm-shutdown-answer":
			case "prompt-new-edit-file-answer":
			case "message-dialog-answer":
			case "question-dialog-answer":
			case "list-dialog-answer":
			case "input-dialog-answer":
			case "file-dialog-answer":
			case "debug-cd-or-addpath-error-answer":
				this._hostSession.sendMessage(name, content);
				break;

			// Unknown messages
			default:
				this._log.warn("Unknown message:", name);
				break;
		}
	}

	_handleMessage(name, content) {

		// Filter out some error messages
		if (name === "err") {
			if (/warning: readline is not linked/.test(content)) return;
			if (/warning: docstring file/.test(content)) return;
			if (/error: unable to open .+macros\.texi/.test(content)) return;
			if (/__unimplemented__/.test(content)) content = "Error: You called a function that is not currently available in Octave.\n";
			if (/warning: function .* shadows a core library function/.test(content) && config.forge.placeholders.indexOf(content.match(/\/([^\.]+)\.m/)[1]) !== -1) return;
		}

		// Forward all events downstream
		this.emit("message", name, content);

		// Special handling of a few events here
		switch (name) {
			case "request-input":
				this._endCountdown();
				this.resetTimeout();
				this._resetPayload();
				break;

			case "err":
			case "out":
				this._appendToPayload(content);
				this._appendToSessionLog(name, content);
				break;

			// UNIMPLEMENTED FEATURES REQUIRING RESPONSE:
			case "confirm-shutdown":
				this._hostSession.sendMessage("confirm-shutdown-answer", true);
				break;
			case "prompt-new-edit-file":
				this._hostSession.sendMessage("prompt-new-edit-file-answer", true);
				break;
			case "message-dialog":
				this._hostSession.sendMessage("message-dialog-answer", 0);
				break;
			case "question-dialog":
				this._hostSession.sendMessage("question-dialog-answer", "");
				break;
			case "list-dialog":
				this._hostSession.sendMessage("list-dialog-answer", [[],0]);
				break;
			case "input-dialog":
				this._hostSession.sendMessage("input-dialog-answer", []);
				break;
			case "file-dialog":
				this._hostSession.sendMessage("file-dialog-answer", []);
				break;
			case "debug-cd-or-addpath-error":
				this._hostSession.sendMessage("debug-cd-or-addpath-error-answer", 0);
				break;

			default:
				break;
		}
	}

	_handleError(err) {
		if (err) this._log.error(err);
	}
}

module.exports = OctaveSession;
