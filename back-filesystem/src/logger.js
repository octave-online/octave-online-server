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
