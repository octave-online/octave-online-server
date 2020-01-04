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

const parserFactory = require("stream-json").parser;
const streamValues = require("stream-json/streamers/StreamValues").streamValues;
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
		// Note: upon error events, we must restart the parser, because Node closes streams upon any error event.
		this.stream
			.pipe(parserFactory({
				jsonStreaming: true
			}))
			.on("error", (err) => {
				log.error("JSON syntax error", err);
				this._run();
			})
			.pipe(streamValues())
			.on("error", (err) => {
				log.error("Could not unpack value", err);
				this._run();
			})
			.on("data", (d) => {
				this.emit("data", d.value);
			})
			.on("end", () => {
				// TODO: Does this method get run? Is it important?
				this.emit("end");
			});
	}
}

module.exports = JSONStreamSafe;
