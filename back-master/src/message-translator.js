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

const EventEmitter = require("events");
const log = require("@oo/shared").logger("message-translator");
const crypto = require("crypto");
const uuid = require("uuid");
const config = require("@oo/shared").config;

// This class "translates" messages between the older format expected by the downstream front end and the newer format expected by the upstream back ends (Octave host and file manager).

class MessageTranslator extends EventEmitter {

	// When the upstream back ends send us a message:
	fromUpstream(sessCode, name, content) {
		switch(name) {
			// MESSAGES NEEDING TRANSLATION:

			// "request-input" is the newer version of "prompt", which provided a line number as an integer.  The line number needs to be extracted via regex for backwards compatibility.
			case "request-input":
				let match = content.match(/^octave:(\d+)>\s+$/);
				let line_number = -1;
				if (match) {
					line_number = parseInt(match[1]);
				} else {
					this._forDownstream(sessCode, "data", {
						type: "stdout",
						data: content
					});
				}
				this._forDownstream(sessCode, "prompt", { line_number, prompt: content });
				break;

			// "out" and "err" need to be translated to "data" events
			case "out":
				this._forDownstream(sessCode, "data", {
					type: "stdout",
					data: content
				});
				break;

			case "err":
				// Send the error text doenstream
				this._forDownstream(sessCode, "data", {
					type: "stderr",
					data: content
				});
				break;

			// We need only the "ws" part of the "set-workspace" message
			case "set-workspace":
				this._forDownstream(sessCode, "workspace", {
					vars: content.ws
				});
				break;

			// The new "show-static-plot" needs to be broken into "plotd" (plot data) and "plote" (plot finished)
			case "show-static-plot":
				let id = uuid.v4();
				this._forDownstream(sessCode, "plotd", {
					id: id,
					content: content.content
				});
				this._forDownstream(sessCode, "plote", {
					id: id,
					md5: crypto.createHash("md5").update(content.content).digest("hex"),
					command_number: content.command_number
				});
				break;

			// "clc" control command:
			case "clear-screen":
				this._forDownstream(sessCode, "ctrl", {
					command: "clc"
				});
				break;

			// "doc" control command:
			case "show-doc":
				this._forDownstream(sessCode, "ctrl", {
					command: `url=http://octave.sourceforge.net/octave/function/${content}.html`
				});
				break;

			// When come other command was suppressed due to length:
			case "message-too-long":
				if (content.name === "show-static-plot") {
					log.trace("Plot message too long:", content);
					this._forDownstream(sessCode, "data", {
						type: "stderr",
						data: `Warning: Suppressed a large plot (${content.length} bytes).\nMaximum allowable length is ${content.max_length} bytes.\nTip: Try generating a rasterized plot (e.g., imagesc)\ninstead of a vector plot.\n`
					});
				} else {
					log.warn("Unknown message too long:", content);
				}
				break;

			// The "exit" event from octave_link:
			case "exit":
				this._forDownstream(sessCode, "data", {
					type: "exit",
					code: content
				});
				break;

			// The "exit" event from the child process:
			case "docker-exit":
			case "process-exit":
				this.emit("destroy", sessCode, "Shell Exited");
				break;

			// The event for when the Octave process is killed:
			case "octave-killed":
				this._forDownstream(sessCode, "data", {
					type: "stderr",
					data: "Error: Octave process killed.\nYou may have been using too much memory.\nYour memory cap is: " + config.docker.memoryShares + "\n"
				});
				break;

			// Turn "destroy" into "destroy" on this instance
			case "destroy":
				this.emit("destroy", sessCode, content);
				break;

			// Filesystem events: if any of them fail, do not let the events bubble up, but show their error messages on stderr
			case "saved":
			case "renamed":
			case "deleted":
				// FIXME: The rendering of error messages should occur on the client side, not here.
				if (content && !content.success) {
					this._forDownstream(sessCode, "data", {
						type: "stderr",
						data: content.message+"\n"
					});
					break;
				} else {
					this._forDownstream(sessCode, name, content);
					break;
				}

			// File list event (change name from "filelist" to "user")
			case "filelist":
				this._forDownstream(sessCode, "user", content);

			// MESSAGES THAT CAN BE IGNORED:
			case "ack":
			case "set-history":
				break;

			// REMAINING MESSAGES:
			default:
				this._forDownstream(sessCode, name, content);
				break;
		}
	}

	// When the downstream client sends us a message:
	fromDownstream(sessCode, name, getData) {
		switch(name) {
			// MESSAGES NEEDING TRANSLATION:

			// "data" needs to be translated to the "cmd" event (which is a synonym for "request-input-answer")
			case "data":
				this._forUpstream(sessCode, "cmd", getData);
				break;

			// Translate "signal" to "interrupt"
			case "signal":
				this._forUpstream(sessCode, "interrupt", getData);
				break;

			// Emit ping/pong as an event
			case "oo.ping":
				this.emit("ping", sessCode, getData);
				break;
			case "oo.pong":
				this.emit("pong", sessCode, getData);
				break;

			// MESSAGES THAT CAN BE IGNORED:
			case "init":
			case "ot.cursor":
			case "ot.change":
			case "oo.reconnect":
				break;

			// REMAINING MESSAGES:
			default:
				this._forUpstream(sessCode, name, getData);
				break;
		}
	}

	_forDownstream(sessCode, name, content) {
		this.emit("for-downstream", sessCode, name, content);
	}

	_forUpstream(sessCode, name, getData) {
		this.emit("for-upstream", sessCode, name, getData);
	}
}

module.exports = MessageTranslator;
