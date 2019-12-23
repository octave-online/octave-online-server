/*
 * Copyright © 2019, Octave Online LLC
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

// This file contains the main loop for flavor (dedicated) servers.

const log = require("@oo/shared").logger("main-flavor");
const mlog = require("@oo/shared").logger("main-flavor:minor");
const config = require("@oo/shared").config;
const config2 = require("@oo/shared").config2;
const RedisMessenger = require("@oo/shared").RedisMessenger;
const MaintenanceRequestFlavorManager = require("./maintenance-request-manager");
const runMaintenance = require("./maintenance");
const async = require("async");
const rackOperations = require("@oo/shared/rack/operations");

var redisFlavorStatusHandler,
	flavorStatusManager;

var ACCEPT_CONS = true;
var statusTimer;

function start(globals, next) {
	async.parallel([
		(_next) => {
			startConnectionAcceptLoop(globals, _next);
		},
		(_next) => {
			startLifetimeLoop(globals, _next);
		}
	], next);
}

function startConnectionAcceptLoop(globals, next) {
	let { sessionManager, redisScriptHandler, personality } = globals;
	async.during(
		(_next) => {
			if (!ACCEPT_CONS) return _next(null, false);
			async.waterfall([
				(__next) => {
					if (sessionManager.canAcceptNewSessions()) {
						redisScriptHandler.getSessCodeFlavor(personality.flavor, (err, sessCode, content) => {
							if (err) log.error("Error getting sessCode:", err);
							__next(null, sessCode, content);
						});
					} else {
						process.nextTick(() => {
							__next(null, null, null);
						});
					}
				},
				(sessCode, content, __next) => {
					if (sessCode) {
						async.waterfall([
							(___next) => {
								log.info("Received Session:", sessCode);
								content.tier = "_maxima";
								sessionManager.attach(sessCode, content);
								sessionManager.disablePool();
								flavorStatusManager.stop();
								flavorStatusManager.ignoreAll();
								clearTimeout(statusTimer);
								sessionManager.once("destroy-done", (_sessCode) => {
									___next(null, _sessCode);
								});
							},
							(_sessCode, ___next) => {
								if (sessionManager.numActiveSessions() !== 0) {
									log.error("Active sessions when session was closed");
								}
								if (sessCode !== _sessCode) {
									log.error("sessCode changed:", sessCode, _sessCode);
								}
								sessionManager.terminate("Server Maintenance");
								setTimeout(___next, config.maintenance.pauseDuration);
							},
							(___next) => {
								runMaintenance(___next);
							}
						], (err) => {
							__next(err, false);
						});
					} else {
						__next(null, true);
					}
				},
			], _next);
		},
		(_next) => {
			let delay = Math.floor(config.worker.clockInterval.min + Math.random()*(config.worker.clockInterval.max-config.worker.clockInterval.min));
			setTimeout(_next, delay);
		},
		(err) => {
			mlog.info("Connection-accepting loop ended");
			return next(err);
		}
	);
}

function startLifetimeLoop(globals, next) {
	let { sessionManager, redisMessenger, personality } = globals;
	const flavorConfig = config2.flavor(personality.flavor);
	flavorStatusManager = new MaintenanceRequestFlavorManager(flavorConfig.defaultClusterSize);
	redisFlavorStatusHandler = new RedisMessenger().subscribeToFlavorStatus(personality.flavor);
	redisFlavorStatusHandler.on("flavor-status", (...args) => {
		flavorStatusManager.onMessage(...args);
	});
	flavorStatusManager.on("request-maintenance", (...args) => {
		redisMessenger.requestFlavorStatus(personality.flavor, ...args);
	});
	flavorStatusManager.on("reply-to-maintenance-request", (...args) => {
		redisMessenger.replyToFlavorStatus(personality.flavor, ...args);
	});

	// In a flavor cluster, when we get approval from peers, we remove ourself from the cluster permanently in order to save on idle time costs. New servers will be added to the cluster when needed (on demand).
	async.forever(
		(_next) => {
			async.series([
				(__next) => {
					statusTimer = setTimeout(__next, flavorConfig.idleTime);
				},
				(__next) => {
					flavorStatusManager.beginRequesting(flavorConfig.statusInterval);
					flavorStatusManager.once("maintenance-accepted", __next);
				},
				(__next) => {
					sessionManager.disablePool();
					if (sessionManager.numActiveSessions() !== 0) {
						log.warn("Active sessions when flavor maintenance was approved");
						return;
					}
					sessionManager.terminate("Server Maintenance");
					statusTimer = setTimeout(__next, config.maintenance.pauseDuration);
				},
				(__next) => {
					rackOperations.deleteSelf(personality, __next);
				}
			], (err) => {
				_next(err);
			});
		},
		(err) => {
			log.info("Lifetime loop ended");
			return next(err);
		}
	);
}

function doExit() {
	clearTimeout(statusTimer);
	flavorStatusManager.stop();
	ACCEPT_CONS = false;

	setTimeout(() => {
		redisFlavorStatusHandler.close();
	}, 5000);
}

module.exports = {
	start,
	doExit
};
