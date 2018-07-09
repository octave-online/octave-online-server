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
