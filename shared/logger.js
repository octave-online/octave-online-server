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

module.exports = logger;
