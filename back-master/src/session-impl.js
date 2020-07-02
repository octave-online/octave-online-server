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

const OctaveSession = require("./octave-session");
const CappedFileSystem = require("./capped-file-system");
const DockerHandler = require("./docker-handler");
const ProcessHandler = require("./process-handler");
const config = require("@oo/shared").config;
const config2 = require("@oo/shared").config2;
const async = require("async");
const silent = require("@oo/shared").silent;
const child_process = require("child_process");
const logger = require("@oo/shared").logger;
const pstree = require("ps-tree");
const temp = require("temp");
const OnlineOffline = require("@oo/shared").OnlineOffline;
const Queue = require("@oo/shared").Queue;
const onceMessage = require("@oo/shared").onceMessage;
const FilesController = require("../../back-filesystem/src/controller");

class SessionImpl extends OctaveSession {
	constructor(sessCode, options) {
		super(sessCode, options);
		this.options = options;

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
				this._mlog.trace("Requesting creation of capped file system");
				this._cfs.create((err, dataDir) => {
					if (!err) this._dataDir = dataDir;
					_next(err);
				});
			},
			"files": ["cfs", (_next) => {
				this._mlog.trace("Requesting creation of file manager process");
				this._filesSession.create(_next, this._dataDir);
			}],
			"host": ["cfs", (_next) => {
				this._mlog.trace("Requesting creation of Octave host process");
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
			"commit": (_next) => {
				this._mlog.trace("Requesting to commit changes to Git");
				this._commit("Scripted user file commit", silent(/Out of time/, _next));
			},
			"host": ["commit", (_next) => {
				this._mlog.trace("Requesting termination of Octave host process");
				this._hostSession.destroy(_next);
			}],
			"files": ["commit", (_next) => {
				this._mlog.trace("Requesting termination of file manager process");
				this._filesSession.destroy(_next);
			}],
			"cfs": ["host", "files", (_next) => {
				this._mlog.trace("Requesting deletion of capped file system");
				this._cfs.destroy(_next);
			}]
		}, (err) => {
			if (err) return next(err);
			this._log.info("Session successfully destroyed:", reason);
			return next(null);
		});
	}

	_signal(name) {
		this._hostSession.signal(name);
	}

	_sendMessageToFiles(name, content) {
		this._filesSession.sendMessage(name, content);
	}

	_sendMessageToHost(name, content) {
		this._hostSession.sendMessage(name, content);
	}

	_onceMessageFromFiles(name, next) {
		onceMessage(this._filesSession, name, next);
	}
}

class HostProcessHandler extends ProcessHandler {
	constructor(sessCode, options) {
		super(sessCode);
		this.options = options;

		// Override default logger with something that says "host"
		this._log = logger(`host-handler:${sessCode}`);
		this._mlog = logger(`host-handler:${sessCode}:minor`);
	}

	_doCreate(next, dataDir) {
		const tier = this.options.tier;
		let cgroupName = config2.tier(tier)["selinux.cgroup.name"];
		let addressSpace = config2.tier(tier)["selinux.prlimit.addressSpace"];

		const envVars = [
			"env", "GNUTERM=svg",
			"env", "LD_LIBRARY_PATH=/usr/local/lib",
			"env", "OO_SESSCODE="+this.sessCode,
			"env", "OO_TIER="+this.options.tier
		];

		async.series([
			(_next) => {
				temp.mkdir("oo-", (err, tmpdir) => {
					this._mlog.debug("Created tmpdir:", tmpdir);
					this.tmpdir = tmpdir;
					_next(err);
				});
			},
			(_next) => {
				if (config.session.implementation === "unsafe") {
					// Spawn un-sandboxed process
					super._doCreate(_next, child_process.spawn, "env", [].concat(envVars.slice(1)).concat(["/usr/local/bin/octave-host", config.session.jsonMaxMessageLength]), {
						cwd: dataDir
					});
				} else {
					// Spawn sandboxed process
					// The CWD is set to /tmp in order to make the child process not hold a reference to the mount that the application happens to be running under.
					super._doCreate(_next, child_process.spawn, "/usr/bin/prlimit", [
						"--as="+addressSpace,
						"/usr/bin/cgexec",
						"-g", "cpu:"+cgroupName,
						"/usr/bin/sandbox",
						"-M",
						"-H", dataDir,
						"-T", this.tmpdir,
						"--level", "s0"]
						.concat(envVars)
						.concat([
							"/usr/local/bin/octave-host", config.session.jsonMaxMessageLength
						]),
					{
						cwd: "/tmp"
					});
				}
			},
			(_next) => {
				// We need to get the octave-cli PID for signalling, because sandbox handles signals strangely.
				this.octavePID = null;
				async.whilst(
					() => { return !this.octavePID && this._state !== "DESTROYED"; },
					(__next) => {
						async.waterfall([
							(___next) => {
								setTimeout(___next, 250);
							},
							(___next) => {
								this._mlog.trace("Attempting to get Octave PID...");
								pstree(this._spwn.pid, ___next);
							},
							(children, ___next) => {
								let child = children.find((_child) => { return /octave-cli/.test(_child.COMMAND); });
								if (child) {
									this.octavePID = child.PID;
									this._mlog.debug("Got Octave PID:", this.octavePID);
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
			super._doDestroy.bind(this),
			(_next) => {
				if (this.tmpdir) {
					this._mlog.trace("Destroying tmpdir");
					child_process.exec(`rm -rf ${this.tmpdir}`, _next);
				} else {
					process.nextTick(_next);
				}
			}
		], next);
	}

	_doDestroyProcess() {
		// Starting with Octave 4.4, sending SIGTERM is insufficient to make Octave exit.
		this._log.trace("Executing 'exit' in Octave process");
		this.sendMessage("cmd", "exit");
		setTimeout(() => {
			if (!this._spwn) {
				this._mlog.trace("Not sending SIGKILL: Process is already exited");
				return;
			}
			this._log.trace("Sending SIGKILL");
			this._signal("SIGKILL");
		}, 10000);
	}

	_signal(name) {
		if (!this.octavePID) return this._log.error("Cannot signal Octave process yet");
		child_process.exec(`kill -s ${name.slice(3)} ${this.octavePID}`, (err) => {
			if (err) this._log.error("signalling octave:", err);
		});
	}
}

class FilesControllerHandler extends OnlineOffline {
	constructor(sessCode) {
		super();
		this._log = logger(`files-handler:${sessCode}`);
		this._mlog = logger(`files-handler:${sessCode}:minor`);
		this.sessCode = sessCode;
		this._messageQueue = new Queue();
	}

	_doCreate(next, dataDir) {
		async.series([
			(_next) => {
				// Make the gitdir
				temp.mkdir("oo-", (err, tmpdir) => {
					this._mlog.debug("Created gitdir:", tmpdir);
					this.gitdir = tmpdir;
					_next(err);
				});
			},
			(_next) => {
				// Make the controller
				this.controller = new FilesController(this.gitdir, dataDir, this.sessCode);

				// Flush messages to the controller
				while (!this._messageQueue.isEmpty()) this._flush();
				this._messageQueue.on("enqueue", this._flush.bind(this));

				// Emit messages from the controller
				this.controller.on("message", (name, content) => {
					this.emit("message", name, content);
				});

				_next(null);
			}
		], next);
	}

	_doDestroy(next) {
		async.series([
			(_next) => {
				if (this.controller) {
					this.controller.destroy();
				}
				if (this.gitdir) {
					this._mlog.trace("Destroying gitdir");
					child_process.exec(`rm -rf ${this.gitdir}`, _next);
				} else {
					process.nextTick(_next);
				}
			}
		], next);
	}

	sendMessage(name, content) {
		this._messageQueue.enqueue([name, content]);
	}

	_flush() {
		this.controller.receiveMessage.apply(this.controller, this._messageQueue.dequeue());
	}
}

class SessionSELinux extends SessionImpl {
	_makeSessions() {
		this._filesSession = new FilesControllerHandler(this.sessCode);
		this._hostSession = new HostProcessHandler(this.sessCode, this.options);
	}

	_makeNewFileSession(sessCode) {
		return new FilesControllerHandler(sessCode);
	}
}

class HostDockerHandler extends DockerHandler {
	constructor(sessCode) {
		super(sessCode);
		this._dockerImage = config.docker.images.octaveSuffix;
		this._dockerName = `oo-host-${sessCode}`;

		// Override default logger with something that says "host"
		this._log = logger(`host-handler:${sessCode}`);
		this._mlog = logger(`host-handler:${sessCode}:minor`);
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
		this._mlog = logger(`files-handler:${sessCode}:minor`);
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

	_makeNewFileSession(sessCode) {
		return new FilesDockerHandler(sessCode);
	}
}

module.exports = {
	docker: SessionDocker,
	selinux: SessionSELinux,
	docker_handler: HostDockerHandler,
	selinux_handler: HostProcessHandler
};
