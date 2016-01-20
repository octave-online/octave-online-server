"use strict";

const JSONStream = require("JSONStream");
const EventEmitter = require("events");
const log = require("./logger")("json-stream-safe");

// This is a thin wrapper around JSONStream that recovers from parse errors.

class JSONStreamSafe extends EventEmitter {
	constructor(stream) {
		super();
		this.stream = stream;
		this._run();
	}

	_run() {
		var jstream = this.stream.pipe(JSONStream.parse());
		jstream.on("data", (d) => { this.emit("data", d); });
		jstream.on("error", (err) => {
			log.warn("Encountered invalid JSON", err);
			// Restart the parser (in Node, streams are closed upon any error event, even caught ones)
			this._run();
		});
	}
}

module.exports = JSONStreamSafe;
