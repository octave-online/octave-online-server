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

			// "request-input" is the newer version of "prompt", which provided a line number as an integer.
			case "request-input":
				let match = content.match(/\d+/);
				let line_number = -1;
				if (match) line_number = parseInt(match[0]);
				this._forDownstream(sessCode, "prompt", { line_number });
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
					md5: crypto.createHash("md5").update(content.content).digest("hex")
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
	fromDownstream(sessCode, name, content) {
		switch(name) {
			// MESSAGES NEEDING TRANSLATION:

			// "data" needs to be translated to the "cmd" event (which is a synonym for "request-input-answer")
			case "data":
				this._forUpstream(sessCode, "cmd", content.data);
				break;

			// Translate "signal" to "interrupt"
			case "signal":
				this._forUpstream(sessCode, "interrupt");
				break;

			// MESSAGES THAT CAN BE IGNORED:
			case "init":
			case "ot.cursor":
			case "ot.change":
			case "oo.reconnect":
				break;

			// REMAINING MESSAGES:
			default:
				this._forUpstream(sessCode, name, content);
				break;
		}
	}

	_forDownstream(sessCode, name, content) {
		this.emit("for-downstream", sessCode, name, content);
	}

	_forUpstream(sessCode, name, content) {
		this.emit("for-upstream", sessCode, name, content);
	}
}

module.exports = MessageTranslator;
