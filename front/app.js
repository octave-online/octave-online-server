#!/usr/bin/env node

// Parse command-line options
var options = {
	port: {
		abbr: 'p',
		metavar: 'PORT',
		help: "Which port to listen for connections",
		oo_config: 'url.port'
	}
};
var args = require("nomnom")
	.script("app.js")
	.options(options).parse();

// Save options into the Config hash
var Config = require("./build/config");
Object.keys(args).forEach(function (key) {
	if (!options[key]) return;
	var cfg = Config, path = options[key].oo_config.split('.');
	path.slice(0, -1).forEach(function (v) { cfg = cfg[v] });
	cfg[path[path.length - 1]] = args[key];
});

// Pre-initialization: add timestamps to console messages
require('console-stamp')(console, '[d mmm HH:MM:ss.l]');

// Require application code
require("./build/app");
