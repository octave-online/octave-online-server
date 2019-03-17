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

// This file contains the main loop for normal pool servers.

const log = require("@oo/shared").logger("main-pool");
const config = require("@oo/shared").config;
const RedisMessenger = require("@oo/shared").RedisMessenger;
const MaintenanceReuestManager = require("./maintenance-request-manager");
const runMaintenance = require("./maintenance");
const async = require("async");

const redisMaintenanceHandler = new RedisMessenger().subscribeToRebootRequests();
const maintenanceRequestManager = new MaintenanceReuestManager();

var ACCEPT_CONS = true;
var maintenanceTimer;

// Main loops
function start(globals, next) {
	async.parallel([
		(_next) => {
			startConnectionAcceptLoop(globals, _next);
		},
		(_next) => {
			startMaintenanceLoop(globals, _next);
		}
	], next);
}

function startConnectionAcceptLoop(globals, next) {
	let { sessionManager, redisScriptHandler } = globals;
	async.forever(
		(_next) => {
			if (!ACCEPT_CONS) return;
			async.waterfall([
				(__next) => {
					let delay = Math.floor(config.worker.clockInterval.min + Math.random()*(config.worker.clockInterval.max-config.worker.clockInterval.min));
					setTimeout(__next, delay);
				},
				(__next) => {
					if (sessionManager.canAcceptNewSessions())
						redisScriptHandler.getSessCode((err, sessCode, content) => {
							if (err) log.error("Error getting sessCode:", err);
							__next(null, sessCode, content);
						});
					else
						process.nextTick(() => {
							__next(null, null, null);
						});
				},
				(sessCode, content, __next) => {
					if (sessCode) {
						log.info("Received Session:", sessCode);
						sessionManager.attach(sessCode, content);
					}

					__next(null);
				}
			], _next);
		},
		(err) => {
			log.error("Connection-accepting loop ended");
			return next(err);
		}
	);
}

function startMaintenanceLoop(globals, next) {
	let { sessionManager, redisMessenger } = globals;
	redisMaintenanceHandler.on("reboot-request", maintenanceRequestManager.onMessage.bind(maintenanceRequestManager));
	maintenanceRequestManager.on("request-maintenance", redisMessenger.requestReboot.bind(redisMessenger));
	maintenanceRequestManager.on("reply-to-maintenance-request", redisMessenger.replyToRebootRequest.bind(redisMessenger));
	async.forever(
		(_next) => {
			async.series([
				(__next) => {
					maintenanceTimer = setTimeout(__next, config.maintenance.interval);
				},
				(__next) => {
					maintenanceRequestManager.beginRequestingMaintenance();
					maintenanceRequestManager.once("maintenance-accepted", __next);
				},
				(__next) => {
					sessionManager.disablePool();
					async.whilst(
						() => { return sessionManager.numActiveSessions() > 0; },
						(__next) => { maintenanceTimer = setTimeout(__next, config.maintenance.pauseDuration); },
						__next
					);
				},
				(__next) => {
					sessionManager.terminate();
					maintenanceTimer = setTimeout(__next, config.maintenance.pauseDuration);
				},
				(__next) => {
					runMaintenance(__next);
				},
				(__next) => {
					sessionManager.restart();
					maintenanceTimer = setTimeout(__next, config.maintenance.pauseDuration);
				},
				(__next) => {
					maintenanceRequestManager.reset();
					__next();
				}
			], () => {
				_next();
			});
		},
		(err) => {
			log.error("Maintenance loop ended");
			return next(err);
		}
	);
}

function doExit() {
	clearTimeout(maintenanceTimer);
	maintenanceRequestManager.stop();
	ACCEPT_CONS = false;

	setTimeout(() => {
		redisMaintenanceHandler.close();
	}, 5000);
}

module.exports = {
	start,
	doExit
};
