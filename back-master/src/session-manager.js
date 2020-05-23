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

const log = require("@oo/shared").logger("session-manager");
const mlog = require("@oo/shared").logger("session-manager:minor");
const EventEmitter = require("events");
const impls = require("./session-impl");
const uuid = require("uuid");
const Queue = require("@oo/shared").Queue;
const config = require("@oo/shared").config;
const config2 = require("@oo/shared").config2;
const metrics = require("@oo/shared").metrics;
const timeLimit = require("@oo/shared").timeLimit;

class SessionManager extends EventEmitter {
	constructor(maxOnly) {
		super();
		this._pool = {};
		this._poolSizes = {};

		let tiersEnabled;
		if (maxOnly) {
			tiersEnabled = ["_maxima"];
		} else {
			tiersEnabled = Object.keys(config.tiers);
			tiersEnabled.splice(tiersEnabled.indexOf("_maxima"), 1);
		}
		log.info("Enabled tiers:", tiersEnabled);

		tiersEnabled.forEach((tier) => {
			this._pool[tier] = {};
			this._poolSizes[tier] = config2.tier(tier)["sessionManager.poolSize"];
		});

		this._online = {};
		this._monitor_session = null;
		this._setup();
		this.startPool();
		this.recordMetrics();
	}

	_setup() {
		// Log the session index on a fixed interval
		this._logInterval = setInterval(() => {
			Object.keys(this._pool).forEach((tier) => {
				log.debug("Current Number of Pooled Sessions, tier " + tier + ":", Object.keys(this._pool[tier]).length);
				log.trace(Object.keys(this._pool[tier]).join("; "));
			});
			log.debug("Current Number of Online Sessions:", Object.keys(this._online).length);
			log.trace(Object.keys(this._online).join("; "));

			// Time an arbitrary command to test server health
			if (this._monitor_session) {
				let t1 = new Date().valueOf();
				this._monitor_session.sendMessage("cmd", { data: "sombrero" });
				this._monitor_session.once("msg:request-input", () => {
					log.debug("Monitor Time (ms):", new Date().valueOf() - t1);
				});
			}
		}, config.sessionManager.logInterval);

		// Keep pool sessions alive
		this._keepAliveInterval = setInterval(() => {
			Object.keys(this._pool).forEach((tier) => {
				Object.keys(this._pool[tier]).forEach((localCode) => {
					this._pool[tier][localCode].session.resetTimeout();
				});
			});
		}, config.session.timewarnTime/2);
	}

	numActiveSessions() {
		return Object.keys(this._online).length;
	}

	canAcceptNewSessions() {
		if (!this._poolVar.enabled) {
			return false;
		}
		if (this.numActiveSessions() >= config.worker.maxSessions) {
			return false;
		}
		for (let tier of Object.keys(this._pool)) {
			// Require every tier to have at least 1 session in the pool
			if (Object.keys(this._pool[tier]).length === 0) {
				return false;
			}
		}
		return true;
	}

	usagePercent() {
		return this.numActiveSessions() / config.worker.maxSessions;
	}

	isHealthy() {
		return this._monitor_session && this._monitor_session.isOnline();
	}

	_create(next, options) {
		// Get the correct implementation
		const SessionImpl = config.session.implementation === "docker" ? impls.docker : impls.selinux;

		// Create the session object
		const localCode = uuid.v4(null, new Buffer(16)).toString("hex");
		const session = new SessionImpl(localCode, options);

		// Add messages to a cache when they are created
		const cache = new Queue();
		session.on("message", (name, content) => {
			cache.enqueue([name, content]);
		});

		session.create(timeLimit(config.sessionManager.startupTimeLimit, [new Error("Time limit reached")], (err) => {
			// Get rid of the session if it failed to create
			if (err) {
				log.warn("Session failed to create:", localCode, err);
				session.destroy(null, "Failed To Create");
				next();
				return;
			}

			// Call the callback
			next(localCode, session, cache, options);
		}));
	}

	attach(remoteCode, content) {		// Move pool session to online session
		if (!this.canAcceptNewSessions()) return log.warn("Cannot accept any new sessions right now");

		// TODO: Backwards compatibility with old front server: the message content can be the user itself; if null, it is a guest user.
		if (!content) {
			content = { user: null };
		} else if (content.parametrized) {
			content = { user: content };
		}

		// Determine which tier to use
		const user = content.user;
		const tier = content.tier ? content.tier : user ? user.tier : Object.keys(this._pool)[0];
		// eslint-disable-next-line no-console
		console.assert(Object.keys(this._pool).includes(tier), tier);

		// Pull from the pool
		const localCode = Object.keys(this._pool[tier])[0];
		this._online[remoteCode] = this._pool[tier][localCode];
		delete this._pool[tier][localCode];
		log.info("Upgraded pool session", tier, localCode, remoteCode);
		this.recordMetrics();

		// Convenience references
		const session = this._online[remoteCode].session;
		const cache = this._online[remoteCode].cache;

		// Reset the session timeout to leave the user with a full allotment of time
		session.resetTimeout();

		// Send payload upstream
		session.sendMessage("user-info", content);

		// Forward future messages
		cache.on("enqueue", () => {
			const message = cache.dequeue();
			this.emit("message", remoteCode, message[0], message[1]);
		});

		// Save the start time to keep a record of the time spent on flavor servers
		var startTime = new Date().valueOf();

		// Create touch interval for Redis and save reference
		const touchInterval = setInterval(() => {
			this.emit("touch", remoteCode, startTime);
		}, config.redis.expire.interval);

		// Emit an event to set to live in Redis (required for OT)
		this.emit("live", remoteCode);

		// Add user and touchInterval to store
		this._online[remoteCode].user = user;
		this._online[remoteCode].touchInterval = touchInterval;

		// Flush cached messages
		// Do this at the end in case any of the messages are "exit" messages
		while (!cache.isEmpty()) {
			const message = cache.dequeue();
			mlog.trace("Flushing message:", remoteCode, message[0]);
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
		session.destroy((err) => {
			if (err) {
				log.error("Error destroying session:", sessCode, err);
			}
			this.emit("destroy-done", sessCode);
		}, reason);

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
		this.recordMetrics();
	}

	startPool() {
		if (this._poolVar && this._poolVar.enabled) {
			throw new Error("Another pool is already running");
		}

		// I made poolVar a local variable so that there will be one instance for each startPool closure.  Each pool creation loop should be independent from any other pool creation loops that might start or stop.  (Potential problem that this approach prevents: if a session is in the middle of creating, and the pool is disabled and then immediately enabled again, the first pool might not be destroyed if the "pool enabled" variable were singleton.)
		let poolVar = { enabled: true };
		this._poolVar = poolVar;

		let _poolCb = (localCode, session, cache, options) => {
			// If we need to disable the pool...
			if (!poolVar.enabled) {
				if (session) session.destroy(null, "Pool Disabled");
				return;
			}

			// If the session was created successfully...
			if (session) {
				if (!this._monitor_session) {
					log.info("Created monitor session:", localCode);
					this._monitor_session = session;
					cache.enabled = false;
					cache.removeAll();
				} else {
					this._pool[options.tier][localCode] = { session, cache };
					this.recordMetrics();
				}
			}

			// If we need to put another session in our pool...
			for (let tier of Object.keys(this._pool)) {
				if (Object.keys(this._pool[tier]).length < this._poolSizes[tier]) {
					log.trace("Creating new session in tier", tier);
					this._create(_poolCb, { tier });
					return;
				}
			}

			// No more sessions were required.
			setTimeout(_poolCb, config.sessionManager.poolInterval);
		};
		process.nextTick(_poolCb);
	}

	disablePool() {
		if (!this._poolVar || !this._poolVar.enabled) return;
		this._poolVar.enabled = false;
		Object.keys(this._pool).forEach((tier) => {
			Object.keys(this._pool[tier]).forEach((localCode) => {
				this._pool[tier][localCode].session.destroy(null, "Pool Disabled");
				this._pool[tier][localCode].session = null;
				this._pool[tier][localCode].cache = null;
				delete this._pool[tier][localCode];
			});
		});
		this.recordMetrics();
	}

	terminate(reason) {
		this.disablePool();
		clearInterval(this._logInterval);
		clearInterval(this._keepAliveInterval);

		if (this._monitor_session) {
			this._monitor_session.destroy(null, reason);
			this._monitor_session = null;
		}

		Object.keys(this._online).forEach((remoteCode) => {
			this.destroy(remoteCode, reason);
		});
	}

	restart() {
		this.startPool();
		this._setup();
	}

	recordMetrics() {
		metrics.gauge("oo.online_sessions", Object.keys(this._online).length);
		Object.keys(this._pool).forEach((tier) => {
			metrics.gauge(`oo.pool_sessions.${tier}`, Object.keys(this._pool[tier]).length);
		});
	}
}

module.exports = SessionManager;
