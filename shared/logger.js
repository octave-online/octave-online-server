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

// Centralized logger definition for most OO projects.

// Use debug-logger with all logs going to stderr
const logger = require("debug-logger").config({
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
	const impl = logger(id);
	return {
		trace: impl.trace,
		debug: impl.debug,
		log: impl.log,
		info: impl.info,
		warn: impl.warn,
		error: impl.error,
	};
};
