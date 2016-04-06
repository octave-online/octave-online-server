"use strict";

// This class needs to be extended in order to work.  See session-docker.js and session-selinux.js

const logger = require("@oo/shared").logger;
const OnlineOffline = require("@oo/shared").OnlineOffline;
const config = require("@oo/shared").config;
const timeLimit = require("@oo/shared").timeLimit;
const fs = require("fs");
const path = require("path");
const async = require("async");
const uuid = require("uuid");
const Queue = require("@oo/shared").Queue;

class OctaveSession extends OnlineOffline {
	constructor(sessCode) {
		super();
		this.sessCode = sessCode;
		this._log = logger("octave-session:" + sessCode);
		this._mlog = logger("octave-session:" + sessCode + ":minor");

		this._legalTime = config.session.legalTime.guest;
		this._payloadLimit = config.session.payloadLimit.guest;
		this._resetPayload();

		this._plotPngStore = {};
		this._plotSvgStore = {};

		this._messageQueue = new Queue();

		this._throttleCounter = 0;
		this._throttleTime = process.hrtime();

		this.on("error", this._handleError.bind(this));
	}

	_doCreate(next) {
		this._sessionLogStream = fs.createWriteStream(path.join(config.worker.logDir, "sessions", `${this.sessCode}.log`));
		this._doCreateImpl(next);
	}

	_doDestroy(next, reason) {
		this._mlog.trace("Starting Destroy Procedure:", reason);
		async.series([
			(_next) => {
				if (this._countdownTimer) clearInterval(this._countdownTimer);
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
	// Use an interval to signal Octave once after the first timeout and then repeatedly after that, until the kernel sends us a "request-input" event to signal that it is done processing commands.
	_startCountdown() {
		if (this._countdownTimer) return;
		if (this._state !== "ONLINE") return;
		this._countdownTimer = setInterval(() => {
			this.interrupt();
			this.emit("message", "err", "!!! OUT OF TIME !!!\n");
		}, this._legalTime);
	}
	_endCountdown() {
		if (this._countdownTimer) {
			clearInterval(this._countdownTimer);
			this._countdownTimer = null;
		}
	}

	// TIMEOUT METHODS: For killing the Octave kernel after a fixed number of seconds to clear server resources when the client is inactive.
	resetTimeout() {
		if (this._state !== "ONLINE") return;
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

				// Octave sometimes gets confused with the interrupt signal, so send an empty command to reset things.
				this._sendMessageToHost("cmd", "");
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
		this._sessionLogStream.write(type + ": " + content.replace("\n", "\n" + type + ": ") + "\n");
	}

	// PLOTTED PNG IMAGE METHODS: Convert image links to base-64 data URIs
	// TODO: A better way to do this would be to modify GNUPlot to directly save PNG images as base-64 URIs.  I did it this way because I wanted to avoid having to maintain a fork from another major project.
	_convertPlotImages(content) {
		// Search the plot SVG for local PNG files that we need to load
		let imageNames = [];
		let regex = /xlink:href='(\w+).png'/g;
		let match;
		while (match = regex.exec(content.content)) {
			imageNames.push(match[1]);
		}
		if (imageNames.length === 0) return false;

		// Enqueue the images for loading
		let id = uuid.v4();
		let svgObj = { content: content.content, waitCount: 0 };
		imageNames.forEach((name) => {
			let filename = name + ".png";
			if (filename in this._plotPngStore) {
				return this._log.error("Plot image is already in the queue:", filename);
			}
			this._plotPngStore[filename] = id;
			svgObj.waitCount++;
			// Actually send the read-image job upstream:
			this._sendMessageToFiles("read-delete-binary", { filename });
		});
		this._plotSvgStore[id] = svgObj;
		this._log.debug(`Loading ${svgObj.waitCount} images for plot`, id);
		return true;
	}
	_onDeletedBinary(content) {
		if (content.filename in this._plotPngStore) {
			this._resolvePng(content);
			return true;
		} else if (!content.success) {
			// TODO: Implement a better way to resolve load errors.
			this._log.warn("Failed loading a plot image; discarding all pending plots");
			this._plotPngStore = {};
			this._plotSvgStore = {};
		} else {
			return false;
		}
	}
	_resolvePng(content) {
		let filename = content.filename;
		let base64data = content.base64data;
		let id = this._plotPngStore[filename];
		delete this._plotPngStore[filename];
		let svgObj = this._plotSvgStore[id];
		this._log.trace(`Loaded image '${filename}' for plot`, id);

		// Perform the substitution
		svgObj.content = svgObj.content.replace(`xlink:href='${filename}'`, `xlink:href='data:image/png;base64,${base64data}'`);

		// Have we loaded all of the images we need to replace?
		svgObj.waitCount--;
		if (svgObj.waitCount === 0) {
			this._log.debug("Loaded all images for plot", id);
			this.emit("message", "show-static-plot", { content: svgObj.content });
			delete this._plotSvgStore[id];
		}
	}

	// Use a queue to handle incoming messages to ensure that messages are processed in order.  The loading of data via attachments is asynchronous and may cause messages to change order.
	enqueueMessage(name, getData) {
		let message = { name, ready: false };
		this._messageQueue.enqueue(message);
		getData((err, content) => {
			if (err) this._log.error(err);
			message.content = content;
			message.ready = true;
			this._flushMessageQueue();
		});
	}
	_flushMessageQueue() {
		while (!this._messageQueue.isEmpty() && this._messageQueue.peek().ready) {
			let message = this._messageQueue.dequeue();
			this._log.trace("Sending Upstream:", message.name);
			this.sendMessage(message.name, message.content);
		}
	}

	// Prevent spammy messages from clogging up the server.
	// TODO: It would be better if this were done deeper in the stack, such as host.c, so that message spamming doesn't reach all the way into the main event loop.
	_checkThrottle() {
		// FIXME: Make these config values.
		// Nominal values: 100 messages per 100 milliseconds (1000 messages/second) = spam.
		// INTERVAL_DURATION should be less than 1e9.
		let MSGS_PER_INTERVAL = 100;
		let INTERVAL_DURATION = 1e8;

		if (++this._throttleCounter < MSGS_PER_INTERVAL) return;

		this._throttleCounter = 0;
		let diff = process.hrtime(this._throttleTime);
		this._throttleTime = process.hrtime();

		if (diff[0] === 0 && diff[1] < INTERVAL_DURATION) {
			this._log.warn("Messages too rapid!  Killing process!", diff);
			this.emit("message", "destroy", "Too Many Packets");
		}
	}

	sendMessage(name, content) {
		switch (name) {
			// Messages requiring special handling
			case "interrupt":
				this._interrupt();
				break;

			case "cmd":
				// FIXME: The following translation (from content to content.data) should be performed in message-translator.js, but we're unable to do so because the data isn't downloaded from Redis until after message-translator is run.  Is there a more elegant place to put this?  Maybe all message translation should happen here in octave-session.js instead?
				content = content.data;
				this._startCountdown();
				this.resetTimeout();
				this._appendToSessionLog(name, content);
				// Split the command into individual lines and send them to Octave one-by-one.
				content.split("\n").forEach((line) => {
					this._sendMessageToHost(name, line);
				});
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
			case "read-delete-binary":
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
		// Check for message throttling, except for "out" and "err" messages, which are throttled via payload.
		if (name !== "out" && name !== "err") this._checkThrottle();

		// Special pre-processing of a few events here
		switch (name) {
			case "err":
				// Filter out some error messages
				if (/warning: readline is not linked/.test(content)) return;
				if (/warning: docstring file/.test(content)) return;
				if (/error: unable to open .+macros\.texi/.test(content)) return;
				if (/^\/tmp\/octave-help-/.test(content)) return;
				if (/built-in-docstrings' not found/.test(content)) return;
				if (/warning: function .* shadows a core library function/.test(content) && config.forge.placeholders.indexOf(content.match(/\/([^\.\/]+)\.m/)[1]) !== -1) return;
				break;

			case "show-static-plot":
				// Convert PNG file links to embedded base 64 data
				if (this._convertPlotImages(content)) return;
				break;

			case "deleted-binary":
				// If we're waiting for any binary files, capture them here rather than sending them downstream
				if (this._onDeletedBinary(content)) return;
				break;

			default:
				break;
		}

		// Forward events downstream
		this.emit("message", name, content);
		this.emit(`msg:${name}`, content);

		// Special post-processing of a few more events here
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
