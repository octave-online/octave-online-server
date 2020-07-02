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
function silent(messageRegex, next) {

	function pass() {
		var args = Array.prototype.slice.call(arguments, 1);
		mlog.log("Suppressed additional output (regex: " + messageRegex + "): ", JSON.stringify(args));
		args.unshift(null);
		next.apply(this, args);
	}

	function logNext() {
		var args = Array.prototype.slice.call(arguments, 1);
		mlog.log("Pass-through additional output (regex: " + messageRegex + "): ", JSON.stringify(args));
		next.apply(this, arguments);
	}

	// The following function needs to be an ES5-style function in order for "arguments" to work.  Note: At the time of writing, the ES6 spread operator is not supported in Node.JS.
	function checkError() {
		var err = arguments[0];
		if (err && messageRegex.test(err.message)) {
			mlog.trace("Message suppressed (regex: " + messageRegex + ")");
			return pass.apply(this, arguments);
		} else {
			return logNext.apply(this, arguments);
		}
	}

	function checkStdout(err, stdout, stderr) {
		if (stdout && messageRegex.test(stdout)) {
			mlog.trace("Message suppressed from stdout (regex: " + messageRegex + ")");
			return pass.apply(this, arguments);
		} else {
			return checkError.apply(this, arguments);
		}
	}

	checkError.stdout = checkStdout;
	return checkError;
}

module.exports = silent;
