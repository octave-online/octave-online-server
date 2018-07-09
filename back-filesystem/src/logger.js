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

const logger = require("@oo/shared").logger;

// Enable all log levels by default
logger.debug.enable("*");

// Customize formatArgs
// Based on https://github.com/visionmedia/debug/blob/master/node.js
logger.debug.formatArgs = function formatArgs() {
	var args = arguments;
	var useColors = this.useColors;
	var name = this.namespace;

	if (useColors) {
		var c = this.color;

		args[0] = '  \u001b[3' + c + ';1m' + name + ' '
			+ '\u001b[0m'
			+ args[0] + '\u001b[3' + c + 'm'
			+ ' +' + logger.debug.humanize(this.diff) + '\u001b[0m';
	} else {
		args[0] = name + " " + args[0];
	}
	return args;
}
