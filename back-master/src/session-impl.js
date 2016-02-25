"use strict";

const OctaveSession = require("./octave-session");
const CappedFileSystem = require("./capped-file-system");
const DockerHandler = require("./docker-handler");
const ProcessHandler = require("./process-handler");
const config = require("@oo/shared").config;
const async = require("async");
const silent = require("@oo/shared").silent;
const child_process = require("child_process");
const path = require("path");
const logger = require("@oo/shared").logger;
const mkdirp = require("mkdirp");
const pstree = require("ps-tree");
const temp = require("temp");

class SessionImpl extends OctaveSession {
	constructor(sessCode) {
		super(sessCode);
		this._makeSessions();

		this._cfs = new CappedFileSystem(this.sessCode, config.docker.diskQuotaKiB);

		this._filesSession.on("message", this._handleMessage.bind(this));
		this._hostSession.on("message", this._handleMessage.bind(this));

		this._cfs.on("error", this._handleError.bind(this));
		this._filesSession.on("error", this._handleError.bind(this));
		this._hostSession.on("error", this._handleError.bind(this));
	}

	_doCreateImpl(next) {
		async.auto({
			"cfs": (_next) => {
				this._log.trace("Requesting creation of capped file system");
				this._cfs.create((err, dataDir) => {
					if (!err) this._dataDir = dataDir;
					_next(err);
				});
			},
			"files": ["cfs", (_next) => {
				this._log.trace("Requesting creation of file manager process");
				this._filesSession.create(_next, this._dataDir);
			}],
			"host": ["cfs", (_next) => {
				this._log.trace("Requesting creation of Octave host process");
				this._hostSession.create(_next, this._dataDir);
			}]
		}, (err) => {
			if (err) return next(err);
			this._log.info("Session successfully created");
			this.resetTimeout();
			return next(null);
		});
	}

	_doDestroyImpl(next, reason) {
		// TODO: Add an alternative destroy implementation that is synchronous, so that it can be run in an exit handler.
		async.auto({
			"host": (_next) => {
				this._log.trace("Requesting termination of Octave host process");
				this._hostSession.destroy(_next);
			},
			"commit": (_next) => {
				this._log.trace("Requesting to commit changes to Git");
				this._commit("Scripted user file commit", silent(/Out of time/, _next));
			},
			"files": ["commit", (_next) => {
				this._log.trace("Requesting termination of file manager process");
				this._filesSession.destroy(_next);
			}],
			"cfs": ["host", "files", (_next) => {
				this._log.trace("Requesting deletion of capped file system");
				this._cfs.destroy(_next);
			}]
		}, (err) => {
			if (err) return next(err);
			this._log.info("Session successfully destroyed:", reason);
			return next(null);
		});
	}

	_interrupt() {
		this._hostSession.interrupt();
	}

	_sendMessageToFiles(name, content) {
		this._filesSession.sendMessage(name, content);
	}

	_sendMessageToHost(name, content) {
		this._hostSession.sendMessage(name, content);
	}

	_onceMessageFromFiles(name, next) {
		let messageCallback = (name, content) => {
			if (name === name) {
				next(content);
				this._filesSession.removeListener("message", messageCallback);
			}
		};
		this._filesSession.on("message", messageCallback);
	}
}

class HostProcessHandler extends ProcessHandler {
	constructor(sessCode) {
		super(sessCode);

		// Override default logger with something that says "host"
		this._log = logger(`host-handler:${sessCode}`);
	}

	_doCreate(next, dataDir) {
		async.series([
			(_next) => {
				temp.mkdir("oo-", (err, tmpdir) => {
					this._log.debug("Created tmpdir:", tmpdir);
					this.tmpdir = tmpdir;
					_next(err);
				});
			},
			(_next) => {
				// Spawn sandbox process
				// super._doCreate(_next, child_process.spawn, "/usr/local/bin/octave-host", { cwd: dataDir });
				super._doCreate(_next, child_process.spawn, "/usr/bin/sandbox", ["-M", "-H", dataDir, "-T", this.tmpdir, "--level", "s0", "env", "GNUTERM=svg", "env", "LD_LIBRARY_PATH=/usr/local/lib", "/usr/local/bin/octave-host"]);
			},
			(_next) => {
				// We need to get the octave-cli PID for signalling, because sandbox handles signals strangely.
				this.octavePID = null;
				async.whilst(
					() => { return !this.octavePID && this._state !== "DESTROYED" },
					(__next) => {
						async.waterfall([
							(___next) => {
								setTimeout(___next, 250);
							},
							(___next) => {
								this._log.trace("Attempting to get Octave PID...");
								pstree(this._spwn.pid, ___next);
							},
							(children, ___next) => {
								let child = children.find((_child) => { return /octave-cli/.test(_child.COMMAND) });
								if (child) {
									this.octavePID = child.PID;
									this._log.debug("Got Octave PID:", this.octavePID);
								}
								___next(null);
							}
						], __next);
					},
					_next
				);
			}
		], next);
	}

	_doDestroy(next) {
		async.series([
			(_next) => {
				if (this.tmpdir) {
					child_process.exec(`rm -rf ${this.tmpdir}`, _next);
				} else {
					process.nextTick(_next);
				}
			},
			super._doDestroy.bind(this)
		], next);
	}

	_signal(name) {
		if (!this.octavePID) return this._log.error("Cannot signal Octave process yet");
		child_process.exec(`kill -s ${name.slice(3)} ${this.octavePID}`, (err) => {
			if (err) this._log.error("signalling octave:", err);
		});
	}
}

class FilesProcessHandler extends ProcessHandler {
	constructor(sessCode) {
		super(sessCode);

		// Override default logger with something that says "files"
		this._log = logger(`files-handler:${sessCode}`);
	}

	_doCreate(next, dataDir) {
		async.series([
			(_next) => {
				temp.mkdir("oo-", (err, tmpdir) => {
					this._log.debug("Created gitdir:", tmpdir);
					this.gitdir = tmpdir;
					_next(err);
				});
			},
			(_next) => {
				super._doCreate(_next, child_process.fork, path.join(__dirname, "../../back-filesystem/app"), [this.gitdir, dataDir], { cwd: dataDir, silent: true });
			}
		], (err) => {
			if (err) return next(err);
			this._log.debug("Successfully created");
			return next(null);
		});
	}

	_doDestroy(next) {
		async.series([
			(_next) => {
				if (this.gitdir) {
					child_process.exec(`rm -rf ${this.gitdir}`, _next);
				} else {
					process.nextTick(_next);
				}
			},
			super._doDestroy.bind(this)
		], next);
	}
}

class SessionSELinux extends SessionImpl {
	_makeSessions() {
		this._filesSession = new FilesProcessHandler(this.sessCode);
		this._hostSession = new HostProcessHandler(this.sessCode);
	}
}

class HostDockerHandler extends DockerHandler {
	constructor(sessCode) {
		super(sessCode);
		this._dockerImage = config.docker.images.octaveSuffix;
		this._dockerName = `oo-host-${sessCode}`;

		// Override default logger with something that says "host"
		this._log = logger(`host-handler:${sessCode}`);
	}

	_doCreate(next, dataDir) {
		// More about resource management: https://goldmann.pl/blog/2014/09/11/resource-management-in-docker/
		const dockerArgs = [
			"run", "-i",
			"-v", `${dataDir}:${config.docker.cwd}`,
			"--cpu-shares", config.docker.cpuShares,
			"-m", config.docker.memoryShares,
			"--name", this._dockerName,
			`oo/${this._dockerImage}`
		];
		super._doCreate(next, dockerArgs);
	}
}

class FilesDockerHandler extends DockerHandler {
	constructor(sessCode) {
		super(sessCode);
		this._dockerImage = config.docker.images.filesystemSuffix;
		this._dockerName = `oo-files-${sessCode}`;

		// Override default logger with something that says "files"
		this._log = logger(`files-handler:${sessCode}`);
	}

	_doCreate(next, dataDir) {
		const dockerArgs = [
			"run", "-i",
			"-v", `${dataDir}:${config.docker.cwd}`,
			"--name", this._dockerName,
			`oo/${this._dockerImage}`
		];
		super._doCreate(next, dockerArgs);
	}
}

class SessionDocker extends SessionImpl {
	_makeSessions() {
		this._filesSession = new FilesDockerHandler(this.sessCode);
		this._hostSession = new HostDockerHandler(this.sessCode);
	}
}

module.exports = {
	docker: SessionDocker,
	selinux: SessionSELinux
};
