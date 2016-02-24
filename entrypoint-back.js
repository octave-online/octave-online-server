// This file is the entrypoint for back-master, intended for use with the "SELinux" backend.  The "Docker" backend has its own initialization built in to the Dockerfiles.

const config = require("./shared/config.json");
const forever = require("forever-monitor");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

console.log("Forever PID: " + process.pid);
console.log(process.env);

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

// Log stream
const logPath = path.join(config.worker.logDir, "monitor", config.worker.token + "_" + moment().format("YYYY-MM-DD_HH-mm-ss-SSS") + ".log");
const logFd = fs.openSync(logPath, "a", "0640");
const logStream = fs.createWriteStream(null, { fd: logFd });

// Prepare child for spawning
const monitor = new (forever.Monitor)(path.join(__dirname, "back-master/app.js"), {
	cwd: path.join(__dirname, "back-master"),
	max: 10,
//	logFile: logPrefix + ".log",
//	outFile: logPrefix + ".out",
//	errFile: logPrefix + ".err",
	stdio: ["ignore", "pipe", logStream],
	env: {
		"GIT_SSH": path.join(__dirname, "back-filesystem/git/git_ssh.sh"),
		"GNUTERM": "svg",
		"DEBUG": "*"
	},
//	spawnWith: {
//		uid: config.worker.uid,
//		gid: config.worker.gid
//	}
});

// Exit handler
monitor.on("exit:code", (code, signal) => {
	console.log(`Process exited with code ${code}, signal ${signal}`);
	if (code === 0) {
		monitor.forceStop = true;
		console.log("Stopping Forever Monitor");
	}
});

// Signal Handling
var sigCount = 0;
function doExit() {
	if (sigCount === 0) {
		console.log("RECEIVED FIRST SIGNAL.  Terminating gracefully.");
		if (monitor.child) process.kill(monitor.child.pid, "SIGTERM");
	} else {
		console.log("RECEIVED SECOND SIGNAL.  Killing child process now.");
		monitor.stop();
	}
	sigCount++;
}
process.on("SIGINT", doExit);
process.on("SIGHUP", doExit);
process.on("SIGTERM", doExit);

// Start the forever loop
monitor.start();

console.log("Forever PID: " + process.pid);
