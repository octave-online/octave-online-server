// This file is the entrypoint for back-master, intended for use with the "SELinux" backend.  The "Docker" backend has its own initialization built in to the Dockerfiles.

const async = require("async");
const child_process = require("child_process");
const config = require("./shared/config.json");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

console.log("Daemon PID:", process.pid);

// Make log directories
try {
	fs.mkdirSync(path.join(config.worker.logDir, "monitor"), "0740");
	fs.mkdirSync(path.join(config.worker.logDir, "sessions"), "0740");
} catch(err) {
	if (/EEXIST/.test(err.message)) {
		console.log("Using pre-existing log directories.")
	} else {
		throw err;
	}
}

// Create log stream
const logPath = path.join(config.worker.logDir, "monitor", config.worker.token + "_" + moment().format("YYYY-MM-DD_HH-mm-ss-SSS") + ".log");
const logFd = fs.openSync(logPath, "a", "0640");
const logStream = fs.createWriteStream(null, { fd: logFd });
console.log("Logging to:", logPath);

// Prepare child for spawning
const env = {
	"GIT_SSH": path.join(__dirname, "back-filesystem/git/git_ssh.sh"),
	"GNUTERM": "svg",
	"DEBUG": "*"
};
for (var name in process.env) {
	if (!(name in env)) {
		env[name] = process.env[name];
	}
}
const spawnOptions = {
	cwd: path.join(__dirname, "back-master"),
	env: env,
	stdio: ["inherit", "inherit", logStream],
	uid: config.worker.uid,
	gid: config.worker.uid
};

// Signal Handling
var sigCount = 0;
var spwn;
function doExit() {
	if (sigCount === 0) {
		console.log("RECEIVED FIRST SIGNAL.  Terminating gracefully.");
		if (spwn) spwn.kill("SIGTERM");
	} else {
		console.log("RECEIVED SECOND SIGNAL.  Killing child process now.");
		if (spwn) spwn.kill("SIGKILL");
		process.exit(1);
	}
	sigCount++;
}
process.on("SIGINT", doExit);
process.on("SIGHUP", doExit);
process.on("SIGTERM", doExit);

// Spawn loop
var lastExitCode = null;
async.whilst(
	() => { return lastExitCode !== 0 },
	(next) => {
		spwn = child_process.spawn("node", ["app.js"], spawnOptions);
		console.log("Starting child with PID:", spwn.pid);
		spwn.once("exit", (code, signal) => {
			console.log(`Process exited with code ${code}, signal ${signal}`);
			lastExitCode = code;
			next();
		});
	}
);
