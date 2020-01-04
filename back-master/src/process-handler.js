/*
 * Copyright © 2018, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

"use strict";

const async = require("async");
const logger = require("@oo/shared").logger;
const StdioMessenger = require("@oo/shared").StdioMessenger;

class ProcessHandler extends StdioMessenger {
	constructor(sessCode) {
		super();
		this._log = logger(`process-handler:${sessCode}`);
		this._mlog = logger(`process-handler:${sessCode}:minor`);
		this.sessCode = sessCode;
	}

	_doCreate(next, fn) {
		async.series([
			(_next) => {
				// Spawn the process
				let args = Array.prototype.slice.call(arguments, 2);
				this._mlog.trace("Spawning process:", args[0], args[1].join(" "), args[2]);
				this._spwn = fn.apply(this, args);

				// Create all unexpected error listeners
				this._spwn.on("error", (err) => { this._log.error("spwn:", err); });
				this._spwn.stdin.on("error", (err) => { this._log.error("stdin:", err); });
				this._spwn.stdout.on("error", (err) => { this._log.error("stdout:", err); });
				this._spwn.stderr.on("error", (err) => { this._log.error("stderr:", err); });

				// Create stderr listener
				this._spwn.stderr.on("data", this._handleLog.bind(this));

				// Create exit listener
				this._spwn.on("exit", this._handleExit.bind(this));

				// Listen to main read stream
				this.setReadStream(this._spwn.stdout);

				// Wait until we get an acknowledgement before continuing.  Two conditions: receipt of the acknowledgement message, and premature exit.
				var ack = false;
				this.once("message", (name /*, content */) => {
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
			this._mlog.debug("Finished creating");
			return next(null);
		});
	}

	_doDestroy(next) {
		// This method wont't be called unless the process state is ONLINE, so we don't need to check.
		if (this._spwn.exitCode !== null) {
			// We can ignore the "next" callback because it will be implicitly called by _handleExit()
			this._doDestroyProcess();
		} else {
			next(null);
		}
	}

	signal(name) {
		if (!this._spwn) return this._log.warn("Tried to signal child process, but it does not exist");
		if (this._spwn.exitCode !== null || this._spwn.signalCode !== null) return this._log.warn("Tried to signal child process, but it is exited");
		this._signal(name);
		this._log.debug("Sent " + name + " to child process");
	}

	_signal(name) {
		this._spwn.kill(name);
	}

	_handleLog(data) {
		// Log message to console
		data.toString().trim().split("\n").forEach((line) => {
			this._mlog.log(line);
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
