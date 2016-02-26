#!/usr/bin/env node
"use strict";

// This file is the entrypoint for back-master, intended for use with the "SELinux" backend.  The "Docker" backend has its own initialization built in to the Dockerfiles.
// This file intentionally has no dependencies on npm modules to make it more portable.

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

const prefix = (__dirname === "/usr/local/bin") ? "/usr/local/share/oo" : "..";
const config = require(path.join(prefix, "shared/config.json"));

console.log("Daemon PID:", process.pid);

// Make log directories
function attemptMakeLogDirs(next) {
	try {
		fs.mkdirSync(path.join(config.worker.logDir, "monitor"), "0740");
		fs.mkdirSync(path.join(config.worker.logDir, "sessions"), "0740");
	} catch(err) {
		if (/EEXIST/.test(err.message)) {
			console.log("Using pre-existing log directories.");
			return next();
		} else if (/ENOENT/.test(err.message)) {
			console.log("NFS not mounted yet; trying again in 5 seconds");
			return setTimeout(attemptMakeLogDirs, 5000, next);
		} else throw err;
	}
	return next();
}

// Create log stream
function createLogStream() {
	let dateStr = new Date().toISOString().replace(/:/g,"-").replace(".","-").replace("T","_").replace("Z","");
	let logPath = path.join(config.worker.logDir, "monitor", config.worker.token+"_"+dateStr+".log");
	let logFd = fs.openSync(logPath, "a", "0640");
	let logStream = fs.createWriteStream(null, { fd: logFd });
	console.log("Logging to:", logPath);
	return logStream;
}

// Prepare child for spawning
const env = {
	"GIT_SSH": path.join(prefix, "back-filesystem/git/git_ssh.sh"),
	"GNUTERM": "svg",
	"DEBUG": "*"
};
for (var name in process.env) {
	if (!(name in env)) {
		env[name] = process.env[name];
	}
}
const spawnOptions = {
	cwd: path.join(prefix, "back-master"),
	env: env,
	uid: config.worker.uid,
	gid: config.worker.uid
};
const spawnFile = path.join(prefix, "back-master/app.js");

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
			child_process.execSync("sudo reboot");
		}
	});
}

// Run it!
attemptMakeLogDirs(() => {
	let logStream = createLogStream();
	spawnOptions.stdio = ["inherit", "inherit", logStream];
	runOnce(logStream);
});
