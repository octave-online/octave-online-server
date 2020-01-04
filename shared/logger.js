/*
 * Copyright © 2019, Octave Online LLC
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

// Centralized logger definition for most OO projects.

let writeStackdriverLog = function() {};

try {
	const stackdriver = require("@oo/gcp-stackdriver");
	writeStackdriverLog = stackdriver.writeLog;
} catch(err) {
	// Don't log to stackdriver
}

// Use debug-logger with all logs going to stderr
const debugLogger = require("debug-logger").config({
	levels: {
		trace: { fd: 2 },
		debug: { fd: 2 },
		log: { fd: 2 },
		info: { fd: 2 },
		warn: { fd: 2 },
		error: { fd: 2 }
	}
});

module.exports = function(id) {
	const impl = debugLogger("oo:" + id);
	return {
		/** Trace: low-level operational details */
		trace: (...args) => {
			impl.trace(...args);
			// don't log to stackdriver
		},

		/** Debug: information related to app health */
		debug: (...args) => {
			impl.debug(...args);
			writeStackdriverLog("debug", id, args);
		},

		/** Log: uncategorized messages from another source */
		log: (...args) => {
			impl.log(...args);
			// don't log to stackdriver
		},

		/** Info: changes to an application state */
		info: (...args) => {
			impl.info(...args);
			writeStackdriverLog("info", id, args);
		},

		/** Warn: unusual state, but not an error */
		warn: (...args) => {
			impl.warn(...args);
			writeStackdriverLog("warning", id, args);
		},

		/** Error: unexpected state */
		error: (...args) => {
			impl.error(...args);
			writeStackdriverLog("error", id, args);
		},
	};
};
