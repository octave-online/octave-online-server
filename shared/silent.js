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

var mlog = require("./logger")("silent:minor");

// Callback wrapper that catches errors and prevents them from propagating.
function silent(messageRegex, _next) {

	// The following function needs to be an ES5-style function in order for "arguments" to work.  Note: At the time of writing, the ES6 spread operator is not supported in Node.JS.
	return function() {
		var err = arguments[0];
		if (err && !messageRegex.test(err.message)) {
			return _next.apply(this, arguments);
		} else if (err) {
			// May 2018: The message could contain email-based identifiers. Do not log the full message.
			mlog.trace("Message suppressed (regex: " + messageRegex + ")");
		}
		var args = Array.prototype.slice.call(arguments, 1);
		args.unshift(null);
		_next.apply(this, args);
	};
};

module.exports = silent;
