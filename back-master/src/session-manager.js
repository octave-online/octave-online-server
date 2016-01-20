"use strict";

const log = require("@oo/shared").logger("session-manager");
const EventEmitter = require("events");
const OctaveSession = require("./octave-session");
const uuid = require("uuid");
const Queue = require("@oo/shared").Queue;
const async = require("async");
const config = require("@oo/shared").config;

class SessionManager extends EventEmitter {
	constructor() {
		super();
		this._pool = {};
		this._online = {};
		this._POOL_ENABLED = true;

		// Log the session index on a fixed interval
		this._logInterval = setInterval(() => {
			log.debug("Current Number of Pooled Sessions:", Object.keys(this._pool).length);
			log.trace(Object.keys(this._pool).join("; "));
			log.debug("Current Number of Online Sessions:", Object.keys(this._online).length);
			log.trace(Object.keys(this._online).join("; "));
		}, config.sessionManager.logInterval);

		// Keep the pool populated with new sessions
		async.forever(
			(_next) => {
				if (!this._POOL_ENABLED) this._makePoolTimer = setTimeout(_next, config.sessionManager.poolInterval);
				else this._createMany(config.sessionManager.poolSize, () => {
					this._makePoolTimer = setTimeout(_next, config.sessionManager.poolInterval);
				});
			},
			() => { log.error("Pool loop ended") }
		);

		// Keep pool sessions alive
		this._keepAliveInterval = setInterval(() => {
			Object.keys(this._pool).forEach((localCode) => {
				this._pool[localCode].session.resetTimeout();
			});
		}, config.session.timewarnTime/2);
	}

	_create(next) {
		// Create the session object
		const localCode = uuid.v4(null, new Buffer(16)).toString("hex");
		const session = new OctaveSession(localCode);

		// Add messages to a cache when they are created
		const cache = new Queue();
		session.on("message", (name, content) => {
			cache.enqueue([name, content]);
		});

		session.create((err) => {
			// Get rid of the session if it failed to create
			if (err) {
				log.warn(localCode, err);
				session.destroy();
				if (next) next();
				return;
			}

			// Save reference
			this._pool[localCode] = { session, cache };

			// Call the callback if necessary
			if (next) next();
		});
	}

	_createMany(n, next) {
		let attempts = 0;
		async.whilst(
			() => {
				return (Object.keys(this._pool).length < n && attempts < 2*n);
			},
			(_next) => {
				attempts += 1;
				this._create(_next);
			},
			next
		);
	}

	numActiveSessions() {
		return Object.keys(this._online).length;
	}

	attach(remoteCode, user) {
		// Make sure there is a pool session available
		if (Object.keys(this._pool).length === 0) {
			log.warn("No pooled sessions available for " + remoteCode);
			this._create(() => { this.attach(remoteCode, user) });
			return;
		}

		// Move pool session to online session
		const localCode = Object.keys(this._pool)[0];
		this._online[remoteCode] = this._pool[localCode];
		delete this._pool[localCode];
		log.info("Upgraded pool session", localCode, remoteCode);

		// Convenience references
		const session = this._online[remoteCode].session;
		const cache = this._online[remoteCode].cache;

		// Reset the session timeout to leave the user with a full allotment of time
		session.resetTimeout();

		// Send user info upstream
		session.sendMessage("user-info", { user });

		// Forward future messages
		cache.on("enqueue", () => {
			const message = cache.dequeue();
			this.emit("message", remoteCode, message[0], message[1]);
		});

		// Create touch interval for Redis and save reference
		this.emit("touch", remoteCode);
		const touchInterval = setInterval(() => {
			this.emit("touch", remoteCode);
		}, config.redis.expire.interval);

		// Add user and touchInterval to store
		this._online[remoteCode].user = user;
		this._online[remoteCode].touchInterval = touchInterval;

		// Flush cached messages
		// Do this at the end in case any of the messages are "exit" messages
		while (!cache.isEmpty()) {
			const message = cache.dequeue();
			log.trace("Flushing message:", remoteCode, message[0]);
			if (/exit/.test(message[0])) log.warn("Exit message:", message[1]);
			this.emit("message", remoteCode, message[0], message[1]);
		}
	}

	get(sessCode) {
		// Look up session
		const meta = this._online[sessCode];
		if (!meta) return null;

		// Return it
		return meta.session;
	}

	destroy(sessCode, reason) {
		// Look up session
		const meta = this._online[sessCode];
		if (!meta) {
			if (/Shell Exited/.test(reason)) return;
			else return log.warn("Cannot find session to destroy:", sessCode, reason);
		}

		// Destroy the session
		const session = meta.session;
		session.destroy(session._handleError.bind(session), reason);

		// Send destroy-u message
		this.emit("destroy-u", sessCode, reason);

		// Dereference pointers
		meta.session = null;
		meta.cache = null;
		meta.user = null;
		clearInterval(meta.touchInterval);

		// Remove it from the index
		delete this._online[sessCode];
		log.debug("Removed session from index", sessCode);
	}

	disablePool() {
		this._POOL_ENABLED = false;
		Object.keys(this._pool).forEach((localCode) => {
			this._pool[localCode].session.destroy(null, "Pool Disabled");
			this._pool[localCode].session = null;
			this._pool[localCode].cache = null;
			delete this._pool[localCode];
		});
	}

	enablePool() {
		this._POOL_ENABLED = true;
	}

	terminate(reason) {
		this.disablePool();
		clearInterval(this._logInterval);
		clearInterval(this._keepAliveInterval);
		clearTimeout(this._makePoolTimer);
		Object.keys(this._online).forEach((remoteCode) => {
			this.destroy(remoteCode, reason);
		});
	}
}

module.exports = SessionManager;
