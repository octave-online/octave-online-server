"use strict";

const async = require("async");
const child_process = require("child_process");
const logger = require("@oo/shared").logger;
const StdioMessenger = require("@oo/shared").StdioMessenger;
const config = require("@oo/shared").config;

class DockerHandler extends StdioMessenger {
	constructor(sessCode, dockerImage) {
		super();

		this._log = logger(`docker-handler:${dockerImage}:${sessCode}`);

		this.sessCode = sessCode;
		this._dockerImage = dockerImage;
		this._dockerName = `oo-${this._dockerImage.replace(/\W/,"_")}-${this.sessCode}`;
	}

	_doCreate(next, dataDir1, dataDir2) {
		async.series([
			(_next) => {
				// Create the session
				// More about resource management: https://goldmann.pl/blog/2014/09/11/resource-management-in-docker/
				const dockerArgs = [
					"run", "-i",
					"-v", `${dataDir1}:${config.docker.cwd}`,
					"-v", `${dataDir2}:${config.docker.cwd}/.git`,
					"--cpu-shares", config.docker.cpuShares,
					"-m", config.docker.memoryShares,
					"--name", this._dockerName,
					`oo/${this._dockerImage}`
				];
				this._spwn = child_process.spawn("docker", dockerArgs);
				this._log.debug("Launched process with ID:", this._spwn.pid);
				this._log.trace("Docker args:", dockerArgs.join(" "));

				// Create stderr listener
				this._spwn.stderr.on("data", this._handleLog.bind(this));

				// Create exit listener
				this._spwn.on("exit", this._handleExit.bind(this));

				// Listen to main read stream
				this.setReadStream(this._spwn.stdout);

				// Wait until we get an acknowledgement before continuing.  Two conditions: receipt of the acknowledgement message, and premature exit.
				var ack = false;
				this.once("message", () => {
					if (ack) return;
					ack = true;

					// Don't enable the write stream until down here because we don't want to write messages to the child's STDIN until we've acknowledged that it is online
					this.setWriteStream(this._spwn.stdin);
					_next(null);
				});
				this._spwn.once("exit", () => {
					if (ack) return;
					ack = true;

					_next(new Error("Process exited prematurely"));
				});
			}
		], (err) => {
			if (err) return next(err);
			this._log.trace("Finished creating");
			return next(null);
		});
	}

	_doDestroy(next) {
		// Since the child process is actually the docker client and not the daemon, the SIGKILL will never get forwarded to the actual octave host process.  We need to delegate the task to docker.
		child_process.execFile("docker", ["stop", "-t", 0, this._dockerName], (err, stdout, stderr) => {
		// child_process.execFile("docker", ["rm", "-f", this._dockerName], (err, stdout, stderr) => {
			if (err) this._log.warn(err);
			this._log.trace("Finished destroying");
			return next(null);
		});
	}

	interrupt() {
		if (this._state !== "ONLINE") return this._log.warn("Will not send SIGINT to child process: process not online");

		// Although the child process is actually the docker client and not the daemon, the client will forward simple signals like SIGINT to the actual octave host process.
		this._spwn.kill("SIGINT");
		this._log.debug("Sent SIGINT to child process");
	}

	_handleLog(data) {
		data.toString().trim().split("\n").forEach((line) => {
			this._log.log(line);
		});
	}

	_handleExit(code, signal) {
		this._log.info("Docker Exit:", code, signal);
		this.emit("message", "docker-exit", { code, signal });
	}
}

module.exports = DockerHandler;
