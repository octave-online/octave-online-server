const forever = require("forever-monitor");
const config = require("./shared/config.json");
const moment = require("moment");
const path = require("path");

const child = new (forever.Monitor)(path.join(__dirname, "back-master/app.js"), {
	cwd: path.join(__dirname, "back-master"),
	max: 10,
	uid: config.worker.uid,
	logFile: path.join(config.worker.logDir, "monitor", config.worker.token+"_"+moment().format("YYYY-MM-DD_HH-mm-ss-SSS")+".log"),
	env: {
		"GIT_SSH": path.join(__dirname, "back-filesystem/git/git_ssh.sh"),
		"GNUTERM": "svg",
		"DEBUG": "*"
	}
});

child.on("exit:code", (code, signal) => {
	console.log(`Process exited with code ${code}, signal ${signal}`);
	if (code === 0) {
		child.forceStop = true;
		console.log("Stopping Forever Monitor");
	}
});

child.start();

