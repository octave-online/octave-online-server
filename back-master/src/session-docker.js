"use strict";

const OctaveSession = require("./octave-session");
const CappedFileSystem = require("./capped-file-system");
const DockerHandler = require("./docker-handler");
const config = require("@oo/shared").config;
const async = require("async");
const silent = require("@oo/shared").silent;

class SessionDocker extends OctaveSession {
	constructor(sessCode) {
		super(sessCode);

		this._cfs1 = new CappedFileSystem(this.sessCode, config.docker.diskQuotaKiB);
		this._cfs2 = new CappedFileSystem(this.sessCode, config.docker.diskQuotaKiB);
		this._filesSession = new DockerHandler(this.sessCode, config.docker.images.filesystemSuffix);
		this._hostSession = new DockerHandler(this.sessCode, config.docker.images.octaveSuffix);

		this._filesSession.on("message", this._handleMessage.bind(this));
		this._hostSession.on("message", this._handleMessage.bind(this));

		this._cfs1.on("error", this._handleError.bind(this));
		this._filesSession.on("error", this._handleError.bind(this));
		this._hostSession.on("error", this._handleError.bind(this));
	}

	_doCreateImpl(next) {
		async.auto({
			"cfs1": (_next) => {
				this._log.trace("Requesting creation of capped file system 1");
				this._cfs1.create((err, dataDir1) => {
					if (!err) this._dataDir1 = dataDir1;
					_next(err);
				});
			},
			"cfs2": (_next) => {
				this._log.trace("Requesting creation of capped file system 2");
				this._cfs2.create((err, dataDir2) => {
					if (!err) this._dataDir2 = dataDir2;
					_next(err);
				});
			},
			"files": ["cfs1", "cfs2", (_next) => {
				this._log.trace("Requesting creation of file manager process");
				this._filesSession.create(_next, this._dataDir1, this._dataDir2);
			}],
			"host": ["cfs1", "cfs2", (_next) => {
				this._log.trace("Requesting creation of Octave host process");
				this._hostSession.create(_next, this._dataDir1, this._dataDir2);
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
			"cfs1": ["host", "files", (_next) => {
				this._log.trace("Requesting deletion of capped file system 1");
				this._cfs1.destroy(_next);
			}],
			"cfs2": ["host", "files", (_next) => {
				this._log.trace("Requesting deletion of capped file system 2");
				this._cfs2.destroy(_next);
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

module.exports = SessionDocker;
