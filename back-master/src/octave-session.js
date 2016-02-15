"use strict";

// This class needs to be extended in order to work.  See session-docker.js and session-selinux.js

const logger = require("@oo/shared").logger;
const OnlineOffline = require("@oo/shared").OnlineOffline;
const config = require("@oo/shared").config;
const timeLimit = require("@oo/shared").timeLimit;
const fs = require("fs");
const path = require("path");
const async = require("async");

class OctaveSession extends OnlineOffline {
	constructor(sessCode) {
		super();
		this.sessCode = sessCode;
		this._log = logger("octave-session:" + sessCode);

		this._legalTime = config.session.legalTime.guest;
		this._payloadLimit = config.session.payloadLimit.guest;
		this._resetPayload();

		this.on("error", this._handleError.bind(this));
	}

	_doCreate(next) {
		this._sessionLogStream = fs.createWriteStream(path.join("/srv/oo/logs", `${this.sessCode}.log`));
		this._doCreateImpl(next);
	}

	_doDestroy(next, reason) {
		async.series([
			(_next) => {
				if (this._countdownTimer) clearTimeout(this._countdownTimer);
				if (this._timewarnTimer) clearTimeout(this._timewarnTimer);
				if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
				if (this._autoCommitTimer) clearInterval(this._autoCommitTimer);
				_next(null);
			},
			(_next) => {
				this._doDestroyImpl(_next, reason);
			},
			(_next) => {
				if (this._sessionLogStream) this._sessionLogStream.end(reason);
				_next(null);
			}
		], next);
	}

	interrupt() {
		this._interrupt();
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

	_commit(comment, next) {
		// Set a 60-second time limit
		let _next = timeLimit(config.git.commitTimeLimit, [new Error("Out of time")], next);

		// Call the callback when a "committed" message is received
		this._onceMessageFromFiles("committed", () => { _next(null); })

		// Request the commit
		this._sendMessageToFiles("commit", { comment });
	}

	// SESSION LOG: Log all commands, input, and output to a log file
	_appendToSessionLog(type, content) {
		if (!this._sessionLogStream) return this._log.warn("Cannot log before created", { type, content });
		if (this._sessionLogStream.closed) return this._log.warn("Cannot log to a closed stream:", { type, content });
		if (type === "cmd") content += "\n";
		this._sessionLogStream.write(`${type}: ${content}----\n`);
	}

	sendMessage(name, content) {
		switch (name) {
			// Messages requiring special handling
			case "interrupt":
				this._interrupt();
				break;

			case "cmd":
				this._startCountdown();
				this.resetTimeout();
				this._sendMessageToHost(name, content);
				this._appendToSessionLog(name, content);
				break;

			case "user-info":
				if (content && content.user) {
					this._startAutoCommitLoop();
					if (content.user.legalTime) this._legalTime = content.user.legalTime;
					if (content.user.payloadLimit) this._payloadLimit = content.user.payloadLimit;
				}
				this._sendMessageToFiles(name, content);
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
				this._sendMessageToFiles(name, content);
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
				this._sendMessageToHost(name, content);
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
			if (/^\/tmp\/octave-help-/.test(content)) return;
			if (/built-in-docstrings' not found/.test(content)) return;
			if (/__unimplemented__/.test(content)) content = "Error: You called a function that is not currently available in Octave.\n";
			if (/warning: function .* shadows a core library function/.test(content) && config.forge.placeholders.indexOf(content.match(/\/([^\.\/]+)\.m/)[1]) !== -1) return;
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
				this._sendMessageToHost("confirm-shutdown-answer", true);
				break;
			case "prompt-new-edit-file":
				this._sendMessageToHost("prompt-new-edit-file-answer", true);
				break;
			case "message-dialog":
				this._sendMessageToHost("message-dialog-answer", 0);
				break;
			case "question-dialog":
				this._sendMessageToHost("question-dialog-answer", "");
				break;
			case "list-dialog":
				this._sendMessageToHost("list-dialog-answer", [[],0]);
				break;
			case "input-dialog":
				this._sendMessageToHost("input-dialog-answer", []);
				break;
			case "file-dialog":
				this._sendMessageToHost("file-dialog-answer", []);
				break;
			case "debug-cd-or-addpath-error":
				this._sendMessageToHost("debug-cd-or-addpath-error-answer", 0);
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
