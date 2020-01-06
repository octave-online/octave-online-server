#!/usr/bin/env node
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

// This file is the entrypoint for back-master, intended for use with the "SELinux" backend.  The "Docker" backend has its own initialization built in to the Dockerfiles.
// This file intentionally has no dependencies on npm modules to make it more portable.

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

// Print basic information about the process
console.log("Daemon PID:", process.pid);
console.log("Date:", new Date().toISOString());

// What files will we be loading?
const prefix = (__dirname === "/usr/local/bin") ? "/usr/local/share/oo" : path.join(__dirname, "..");
const configFile = path.join(prefix, "shared/config.js");
const exitFile = path.join(prefix, "entrypoint/exit.js");
const spawnDirectory = path.join(prefix, "back-master");
const spawnFile = path.join(prefix, "back-master/app.js");

// Wait until the application code is ready before continuing.  Example: network drives being mounted at startup.
// eslint-disable-next-line no-constant-condition
while (true) {
	try {
		fs.statSync(configFile);
		fs.statSync(spawnDirectory);
		fs.statSync(spawnFile);
		break;
	} catch(err) {
		console.log("One or more dependencies not available!  Trying again in 5 seconds...");
		child_process.execSync("sleep 5");  // blocking sleep
	}
}

// Load config file dependency
const config = require(configFile);

// Load exit routine
function getExitFunction() {
	var exit;
	try {
		exit = require(exitFile);
		console.log("Will use exit routine from exit.js");
	} catch(err) {
		if (/Cannot find module/.test(err.message)) {
			// If exit.js is not provided, set a no-op.
			exit = function(){};
			console.log("Will use no-op exit routine");
		} else throw err;
	}
	return exit;
}

// Make log directories
function mkdirSyncNoError(path) {
	try {
		fs.mkdirSync(path, "0740");
	} catch(err) {
		if (!/EEXIST/.test(err.message)) {
			throw err;
		}
	}
}
const monitorLogPath = path.join(config.worker.logDir, config.worker.monitorLogs.subdir);
const sessionLogPath = path.join(config.worker.logDir, config.worker.sessionLogs.subdir);
mkdirSyncNoError(monitorLogPath);
mkdirSyncNoError(sessionLogPath);

// Create nested session log dirs (the goal of nesting is to reduce the number of files in each directory)
function makeSessionLogDirsRecursive(prefix, depth) {
	if (depth === config.worker.sessionLogs.depth) {
		return;
	}
	for (let i=0; i<16; i++) {
		let letter = "0123456789abcdef"[i];
		let currpath = path.join(prefix, letter);
		mkdirSyncNoError(currpath);
		makeSessionLogDirsRecursive(currpath, depth + 1);
	}
}
makeSessionLogDirsRecursive(sessionLogPath, 0);

// Create log stream
let dateStr = new Date().toISOString().replace(/:/g,"-").replace(".","-").replace("T","_").replace("Z","");
let logPath = path.join(monitorLogPath, config.worker.token+"_"+dateStr+".log");
let logFd = fs.openSync(logPath, "a", "0640");
let logStream = fs.createWriteStream(null, { fd: logFd });
console.log("Logging to:", logPath);

// Prepare child process environment and copy all environment variables
const spawnOptions = {
	cwd: spawnDirectory,
	env: {
		"GNUTERM": "svg",
		"DEBUG": "*"
	},
	uid: config.worker.uid,
	gid: config.worker.uid,
	stdio: ["inherit", "inherit", logStream]
};
for (var name in process.env) {
	if (!(name in spawnOptions.env)) {
		spawnOptions.env[name] = process.env[name];
	}
}

// Signal Handling
var sigCount = 0;
var spwn;
function doExit() {
	if (sigCount === 0) {
		console.log("RECEIVED FIRST SIGNAL.  Terminating gracefully.");
		if (spwn) spwn.kill("SIGTERM");
	} else if (sigCount < 5) {
		console.log("RECEIVED SIGNAL 2-5.  Ignoring.");
	} else {
		console.log("RECEIVED FINAL SIGNAL.  Killing child process now.");
		if (spwn) spwn.kill("SIGKILL");
		process.exit(1);
	}
	sigCount++;
}
process.on("SIGINT", doExit);
process.on("SIGHUP", doExit);
process.on("SIGTERM", doExit);

// Spawn loop
function runOnce() {
	console.log(spawnOptions);
	spwn = child_process.spawn("/usr/bin/env", ["node", spawnFile], spawnOptions);
	console.log(`Starting child (${spawnFile}) with PID ${spwn.pid}`);
	spwn.once("exit", (code, signal) => {
		console.log(`Process exited with code ${code}, signal ${signal}`);
		if (code !== 0) {
			setTimeout(runOnce, 500);
		} else {
			logStream.close(); // also closes the logFd file descriptor
			getExitFunction()();
		}
	});
}

// Run it!
runOnce();
