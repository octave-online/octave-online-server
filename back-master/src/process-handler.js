"use strict";

const async = require("async");
const child_process = require("child_process");
const logger = require("@oo/shared").logger;
const StdioMessenger = require("@oo/shared").StdioMessenger;
const config = require("@oo/shared").config;

class ProcessHandler extends StdioMessenger {
	constructor(sessCode) {
		super();
		this._log = logger(`process-handler:${sessCode}`);
		this.sessCode = sessCode;
	}

	_doCreate(next, fn) {
		async.series([
			(_next) => {
				// Spawn the process
				this._spwn = fn.apply(this, Array.prototype.slice.call(arguments, 2));

				// Create all unexpected error listeners
				this._spwn.on("error", (err) => { this._log.error("spwn:", err) });
				this._spwn.stdin.on("error", (err) => { this._log.error("stdin:", err) });
				this._spwn.stdout.on("error", (err) => { this._log.error("stdout:", err) });
				this._spwn.stderr.on("error", (err) => { this._log.error("stderr:", err) });

				// Create stderr listener
				this._spwn.stderr.on("data", this._handleLog.bind(this));

				// Create exit listener
				this._spwn.on("exit", this._handleExit.bind(this));

				// Listen to main read stream
				this.setReadStream(this._spwn.stdout);

				// Wait until we get an acknowledgement before continuing.  Two conditions: receipt of the acknowledgement message, and premature exit.
				var ack = false;
				this.once("message", (name, content) => {
					if (ack) return;
					ack = true;

					// Error if the message is process-exit
					if (name === "process-exit") return _next(new Error("Process exited prematurely"));

					// Don't enable the write stream until down here because we don't want to write messages to the child's STDIN until we've acknowledged that it is online
					this.setWriteStream(this._spwn.stdin);
					_next(null);
				});
			}
		], (err) => {
			if (err) return next(err);
			this._log.debug("Finished creating");
			return next(null);
		});
	}

	_doDestroy(next) {
		// This method wont't be called unless the process state is ONLINE, so we don't need to check.
		// We can ignore the "next" callback because it will be implicitly called by _handleExit()
		this._log.trace("Sending SIGTERM");
		this._spwn.kill("SIGTERM");
	}

	interrupt() {
		if (!this._spwn) return this._log.warn("Tried to signal child process, but it does not exist");
		if (this._spwn.exitCode !== null) return this._log.warn("Tried to signal child process, but it is exited");
		this._spwn.kill("SIGINT");
		this._log.debug("Sent SIGINT to child process");
	}

	_handleLog(data) {
		// Log message to console
		data.toString().trim().split("\n").forEach((line) => {
			this._log.log(line);
		});
	}

	_handleExit(code, signal) {
		this._log.debug("Process Exit:", code, signal);
		this.emit("message", "process-exit", { code, signal });
		this._internalDestroyed(null);

		// TODO: when to emit this.emit("message", "octave-killed") ?
	}
}

module.exports = ProcessHandler;
