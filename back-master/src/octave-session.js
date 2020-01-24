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

// The code in this file is shared among all implementations of the Octave session.  See session-impl.js for examples of implementations.

const logger = require("@oo/shared").logger;
const OnlineOffline = require("@oo/shared").OnlineOffline;
const config = require("@oo/shared").config;
const config2 = require("@oo/shared").config2;
const timeLimit = require("@oo/shared").timeLimit;
const fs = require("fs");
const path = require("path");
const async = require("async");
const url = require("url");
const http = require("http");
const https = require("https");
const querystring = require("querystring");
const uuid = require("uuid");
const RedisQueue = require("@oo/shared").RedisQueue;
const base58 = require("base-x")("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");
const temp = require("temp");
const onceMessage = require("@oo/shared").onceMessage;
const child_process = require("child_process");

class OctaveSession extends OnlineOffline {
	constructor(sessCode, options) {
		super();
		this.sessCode = sessCode;
		this._options = options;
		this._log = logger("octave-session:" + sessCode);
		this._mlog = logger("octave-session:" + sessCode + ":minor");

		this._log.debug("Tier:", this._options.tier);

		this._extraTime = 0;
		this._countdownExtraTime = config2.tier(this._options.tier)["session.countdownExtraTime"];
		this._countdownRequestTime = config2.tier(this._options.tier)["session.countdownRequestTime"];

		this._legalTime = config.session.legalTime.guest;
		this._payloadLimit = config.session.payloadLimit.guest;
		this._resetPayload();

		this._plotPngStore = {};
		this._plotSvgStore = {};

		this._redisQueue = new RedisQueue(sessCode);
		this._redisQueue.on("message", this.sendMessage.bind(this));

		this._throttleCounter = 0;
		this._throttleTime = process.hrtime();

		this.on("error", this._handleError.bind(this));
	}

	_doCreate(next) {
		let subdir = path.join(config.worker.logDir, config.worker.sessionLogs.subdir);
		for (let i=0; i<config.worker.sessionLogs.depth; i++) {
			subdir = path.join(subdir, this.sessCode[i]);
		}
		let sessionLogPath = path.join(subdir, `${this.sessCode}.log`);
		this._mlog.trace("Storing session log in:", sessionLogPath);
		this._sessionLogStream = fs.createWriteStream(sessionLogPath);
		this._doCreateImpl(next);
	}

	_doDestroy(next, reason) {
		this._mlog.trace("Starting Destroy Procedure:", reason);
		async.series([
			(_next) => {
				if (this._countdownTimer) clearTimeout(this._countdownTimer);
				if (this._timewarnTimer) clearTimeout(this._timewarnTimer);
				if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
				if (this._autoCommitTimer) clearInterval(this._autoCommitTimer);
				if (this._payloadInterruptTimer) clearTimeout(this._payloadInterruptTimer);
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
		this._signal("SIGINT");
	}

	enqueueMessage(name, getData) {
		this._redisQueue.enqueueMessage(name, getData);
	}

	// COUNTDOWN METHODS: For interrupting the Octave kernel after a fixed number of seconds to ensure a fair distribution of CPU time.
	// Use an interval to signal Octave once after the first timeout and then repeatedly after that, until the kernel sends us a "request-input" event to signal that it is done processing commands.
	_startCountdown() {
		if (this._countdownTimer) return;
		if (this._state !== "ONLINE") return;

		this._countdownTimer = setTimeout(this._onCountdownEnd.bind(this), this._legalTime);
	}
	_endCountdown() {
		if (this._countdownTimer) {
			clearTimeout(this._countdownTimer);
			this._countdownTimer = null;
		}
	}
	_onCountdownEnd() {
		if (new Date().valueOf() - this._extraTime < this._countdownRequestTime + config.session.countdownRequestTimeBuffer) {
			// Add 15 seconds and don't send an interrupt signal
			this._log.trace("Extending countdown with extra time");
			this._countdownTimer = setTimeout(this._onCountdownEnd.bind(this), this._countdownExtraTime);
		} else {
			// Send an interrupt signal now and again in 5 seconds
			this._log.trace("Interrupting execution due to countdown");
			this.interrupt();
			this.emit("message", "err", "!!! OUT OF TIME !!!\n");
			this._countdownTimer = setTimeout(this._onCountdownEnd.bind(this), 5000);
		}
	}
	_addTime() {
		// This method gets called when the user clicks the "Add 15 Seconds" button on the front end.
		this._extraTime = new Date().valueOf();
	}

	// TIMEOUT METHODS: For killing the Octave kernel after a fixed number of seconds to clear server resources when the client is inactive.
	resetTimeout() {
		if (this._state !== "ONLINE") return;
		if (this._timewarnTimer) clearTimeout(this._timewarnTimer);
		if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
		const timewarnTime = config2.tier(this._options.tier)["session.timewarnTime"];
		const timeoutTime = config2.tier(this._options.tier)["session.timeoutTime"];
		this._mlog.trace("Resetting timeout:", timewarnTime, timeoutTime);
		this._timewarnTimer = setTimeout(() => {
			this.emit("message", "err", config.session.timewarnMessage+"\n");
		}, timewarnTime);
		this._timeoutTimer = setTimeout(() => {
			this._log.info("Session Timeout");
			this.emit("message", "destroy", "Session Timeout");
		}, timeoutTime);
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

			// End the countdown, and instead give the user a specified amount of time to allow the process to continue from where it left off.
			this._signal("SIGSTOP");
			this._endCountdown();
			let payloadDelay = config.session.payloadAcknowledgeDelay;
			this._payloadInterruptTimer = setTimeout(() => {
				this._signal("SIGCONT");
				this._signal("SIGINT");

				// Send the error message after a small delay in order to let the output buffers flush first
				setTimeout(() => {
					this.emit("message", "err", "!!! PAYLOAD TOO LARGE !!!\n");

					// Octave sometimes gets confused with the interrupt signal, so send an empty command to reset things.
					this._sendMessageToHost("cmd", "");
				}, config.session.payloadMessageDelay);
			}, payloadDelay);

			// Tell the user how much time they have.
			this.emit("message", "payload-paused", {
				delay: payloadDelay
			});
		}
	}
	_acknowledgePayload() {
		if (!this._payloadInterrupted) return this._log.warn("Attempting to acknowledge payload, but process is not currently paused");
		this._log.trace("User manually acknowledged payload");
		this._continueIfPaused();
		this._resetPayload();
	}
	_continueIfPaused() {
		if (!this._payloadInterrupted) return;
		this._log.trace("Continuing execution");
		clearTimeout(this._payloadInterruptTimer);
		this._signal("SIGCONT");
		this._startCountdown();
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
		this._onceMessageFromFiles("committed", () => { _next(null); });

		// Request the commit
		this._sendMessageToFiles("commit", { comment });
	}

	// SESSION LOG: Log all commands, input, and output to a log file
	_appendToSessionLog(type, content) {
		if (!this._sessionLogStream) return this._log.warn("Cannot log before created", { type, content });
		if (this._sessionLogStream.closed) return this._log.warn("Cannot log to a closed stream:", { type, content });
		this._sessionLogStream.write(type + ": " + content.replace(/\n/g, "\n" + type + ": ") + "\n");
	}

	// PLOTTED PNG IMAGE METHODS: Convert image links to base-64 data URIs
	// TODO: A better way to do this would be to modify GNUPlot to directly save PNG images as base-64 URIs.  I did it this way because I wanted to avoid having to maintain a fork from another major project.
	_convertPlotImages(content) {
		// Search the plot SVG for local PNG files that we need to load
		let imageNames = [];
		let regex = /xlink:href='(\w+).png'/g;
		let match;
		while ((match = regex.exec(content.content))) {
			imageNames.push(match[1]);
		}
		if (imageNames.length === 0) return false;

		// Enqueue the images for loading
		let id = uuid.v4();
		let svgObj = {
			content: content.content,
			command_number: (content.command_number || -1),
			waitCount: 0
		};
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
			this.emit("message", "show-static-plot", {
				content: svgObj.content,
				command_number: svgObj.command_number
			});
			delete this._plotSvgStore[id];
		}
	}

	// URL METHODS: Perform URL requests on behalf of the user.  Uses a hard-coded whitelist in the config file for filtering out legal URLs.
	_handleRequestUrl(content) {
		try {
			let urlObj = url.parse(content.url);

			// Check if the hostname is legal
			if (urlObj.hostname === null) {
				this._sendMessageToHost("request-url-answer", [false, "You must specify a URL of the form http://example.com/"]);
				return;
			}
			let isLegal = false;
			for (let pattern of config.session.urlreadPatterns) {
				if (new RegExp(pattern).test(urlObj.hostname)) {
					isLegal = true;
					break;
				}
			}
			if (!isLegal) {
				this._sendMessageToHost("request-url-answer", [false, `The hostname ${urlObj.hostname} is not whitelisted\nfor access by Octave Online. If you think this hostname\nshould be whitelisted, please open a support ticket.`]);
				return;
			}

			// Convert from the query param list to a query string
			let paramObj = {};
			for (let i=0; i<content.param.length; i+=2) {
				paramObj[content.param[i]] = content.param[i+1];
			}
			let encodedParams = querystring.stringify(paramObj);

			// Set up and perform the request
			let payload = "";
			if (content.action.toLowerCase() === "post") {
				urlObj.method = "POST";
				urlObj.headers = {
					"Content-Type": "application/x-www-form-urlencoded",
					"Content-Length": Buffer.byteLength(encodedParams)
				};
				payload = encodedParams;
			} else {
				urlObj.method = "GET";
				if (urlObj.query) {
					urlObj.query += "&" + encodedParams;
				} else {
					urlObj.query = encodedParams;
				}
				// shouldn't updating the path and href be automatic inside the url module? :/
				urlObj.path = urlObj.pathname + (urlObj.query ? "?" + urlObj.query : "") + (urlObj.hash ? urlObj.hash : "");
				urlObj.href = urlObj.protocol  + "//" + (urlObj.auth ? urlObj.auth + "@" : "") + urlObj.hostname + (urlObj.port ? ":" + urlObj.port : "") + urlObj.path;
			}

			this._log.info("Successfully matched URL", content.url, urlObj);
			this._log.trace("Sending URL request:", urlObj.href);
			let httpLib = (urlObj.protocol === "https:") ? https : http;
			let req = httpLib.request(urlObj, (res) => {
				this._log.trace("Received URL response:", res.statusCode, urlObj.href);
				res.setEncoding("base64");
				let fullResult = "";
				let errmsg = "";
				res.on("data", (chunk) => {
					if (chunk.length + fullResult.length > config.session.urlreadMaxBytes) {
						errmsg = `Requested URL exceeds maximum of ${config.session.urlreadMaxBytes} bytes`;
					} else {
						fullResult += chunk;
					}
				});
				res.on("end", () => {
					this._log.trace("URL response after processing:", errmsg, fullResult.length);
					if (errmsg) {
						this._sendMessageToHost("request-url-answer", [false, errmsg]);
					} else {
						this._sendMessageToHost("request-url-answer", [true, fullResult]);
					}
				});
			});
			req.on("error", (err) => {
				this._log.trace("Problem with URL request:", err.message);
				this._sendMessageToHost("request-url-answer", [false, err.message]);
			});
			req.write(payload);
			req.end();
		} catch(err) {
			this._sendMessageToHost("request-url-answer", [false, err.message]);
		}
	}

	// BUCKET METHODS: Create (and destroy) buckets with snapshots of static files that can be published.
	_createBucket(bucketInfo) {
		let filenames = bucketInfo.filenames;
		if (!Array.isArray(filenames)) return;

		// Create the bucket ID.
		const bucketIdBuffer = new Buffer(16);
		uuid.v4({}, bucketIdBuffer, 0);
		const bucketId = base58.encode(bucketIdBuffer);
		bucketInfo.bucket_id = bucketId;

		this._log.debug("Creating new bucket:", bucketId, filenames);
		async.auto({
			"read_files": (_next) => {
				// Load the bucket files into memory.
				this._mlog.trace("Reading files for bucket");
				let jobId = uuid.v4();
				this._onceMessageFromFiles("multi-binary:" + jobId, (err, data) => {
					if (!data.success) return _next(new Error("Unsuccessful call to multi-binary"));
					_next(null, data.results);
				}, _next);
				this._sendMessageToFiles("multi-binary", {
					id: jobId,
					filenames: filenames
				});
			},
			"tmpdir": (_next) => {
				// We need to create a working directory for the bucket git
				this._mlog.trace("Creating tmpdir for bucket");
				temp.mkdir("oo-", _next);
			},
			"session": (_next) => {
				// Create a Git session for the new bucket.
				const session = this._makeNewFileSession("create-bucket:" + bucketId);
				session.on("message", (name /*, content */) => {
					this._mlog.trace("Bucket file session message:", name);
				});
				session.on("error", (err) => {
					this._log.error("Bucket file session error:", err);
				});
				_next(null, session);
			},
			// NOTE: In Async 1.5.x, the version used here, the argument order is (_next, results), but in Async 2.x, the argument order changed to (results, _next).
			"session_create": ["tmpdir", "session", (_next, results) => {
				this._mlog.trace("Creating session for bucket");
				results.session.create(_next, results.tmpdir);
			}],
			"session_init": ["session_create", (_next, results) => {
				this._mlog.trace("Initializing session for bucket");
				onceMessage(results.session, "filelist", _next);
				results.session.sendMessage("bucket-info", {
					id: bucketId,
					readonly: false
				});
			}],
			"write_files": ["read_files", "session_init", (_next, results) => {
				this._mlog.trace("Writing files for bucket");
				let jobId = uuid.v4();
				onceMessage(results.session, "multi-binary-saved:" + jobId, (err, data) => {
					if (!data.success) return _next(new Error("Unsuccessful call to save-multi-binary"));
					_next(null);
				});
				results.session.sendMessage("save-multi-binary", {
					id: jobId,
					filenames: filenames,
					base64datas: results.read_files
				});
			}],
			"commit": ["write_files", (_next, results) => {
				this._mlog.trace("Committing files for bucket");
				onceMessage(results.session, "committed", _next);
				results.session.sendMessage("commit", {
					comment: "Scripted bucket creation: " + bucketId
				});
			}],
			"destroy_session": ["commit", (_next, results) => {
				this._mlog.trace("Destroying session for bucket");
				results.session.destroy(_next);
			}],
			"destroy_tmpdir": ["destroy_session", (_next, results) => {
				this._mlog.trace("Destroying working dir bucket");
				child_process.exec(`rm -rf ${results.tmpdir}`, _next);
			}]
		}, (err) => {
			if (err) {
				this._log.error("Error creating bucket:", err);
				this.emit("message", "err", "Encountered an error creating the bucket.\n");
			} else {
				this._log.info("Finished creating new bucket:", bucketId);
				this.emit("message", "bucket-repo-created", bucketInfo);
			}
		});
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
				this._continueIfPaused();
				this.interrupt();
				break;

			case "oo.add_time":
				this._addTime();
				this.resetTimeout();
				break;

			case "oo.acknowledge_payload":
				this._acknowledgePayload();
				this.resetTimeout();
				break;

			case "cmd":
				// FIXME: The following translation (from content to content.data) should be performed in message-translator.js, but we're unable to do so because the data isn't downloaded from Redis until after message-translator is run.  Is there a more elegant place to put this?  Maybe all message translation should happen here in octave-session.js instead?
				content = content.data || "";
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
					this._legalTime = content.user.legalTime;
					this._payloadLimit = content.user.payloadLimit;
					this._countdownExtraTime = content.user.countdownExtraTime;
					this._countdownRequestTime = content.user.countdownRequestTime;
				}
				if (content.bucketId) {
					this._sendMessageToFiles("bucket-info", {
						id: content.bucketId,
						legalTime: this._legalTime, // FIXME: For backwards compatibility
						readonly: true
					});
				} else {
					this._sendMessageToFiles(name, content);
				}
				break;

			case "oo.create_bucket":
				this._createBucket(content);
				break;

			// Messages to forward to the file manager
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
			case "request-url-answer":
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
				this._log.debug("Message ignored:", name);
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
		if (/^multi-binary:[\w-]+$/.test(name)) return;

		// Forward remaining events downstream
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

			case "request-url":
				this._handleRequestUrl(content);
				break;

			case "files-ready":
				// As soon as files are loaded for the first time, execute the .octaverc if it is present
				// GNU Octave normally does this automatically, but we pre-start the processes against a clean directory, so .octaverc is not present when GNU Octave starts up
				this._sendMessageToHost("cmd", "if exist(\"~/.octaverc\", \"file\"); source(\"~/.octaverc\"); current_command_number(0); end");
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
