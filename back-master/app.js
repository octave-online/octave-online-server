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

const log = require("@oo/shared").logger("app");
const mlog = require("@oo/shared").logger("app:minor");
const MessageTranslator = require("./src/message-translator");
const RedisMessenger = require("@oo/shared").RedisMessenger;
const SessionManager = require("./src/session-manager");
const MaintenanceReuestManager = require("./src/maintenance-request-manager");
const async = require("async");
const runMaintenance = require("./src/maintenance");
const config = require("@oo/shared").config;
const gcStats = (require("gc-stats"))();
const child_process = require("child_process");

process.stdout.write("Process ID: " + process.pid + "\n");
process.stderr.write("Process ID: " + process.pid + "\n");
log.info("Process ID:", process.pid);
const hostname = child_process.execSync("hostname").toString("utf8").trim();
log.info("Hostname:", hostname);
log.log(process.env);

const redisInputHandler = new RedisMessenger().subscribeToInput();
const redisDestroyDHandler = new RedisMessenger().subscribeToDestroyD();
const redisExpireHandler = new RedisMessenger().subscribeToExpired();
const redisScriptHandler = new RedisMessenger().enableScripts();
const redisMaintenanceHandler = new RedisMessenger().subscribeToRebootRequests();
const redisMessenger = new RedisMessenger();
const translator = new MessageTranslator();
const sessionManager = new SessionManager();
const maintenanceRequestManager = new MaintenanceReuestManager();

redisInputHandler.on("message", translator.fromDownstream.bind(translator));
sessionManager.on("message", translator.fromUpstream.bind(translator));

translator.on("for-upstream", (sessCode, name, getData) => {
	const session = sessionManager.get(sessCode);

	// Stop processing this message if it doesn't have to do with a session running on this node.
	if (!session) return;

	// Now we can safely continue.  The following method will download the data from Redis.
	session.enqueueMessage(name, getData);
});

translator.on("for-downstream", (sessCode, name, content) => {
	log.trace("Sending Downstream:", sessCode, name);
	redisMessenger.output(sessCode, name, content);
});

translator.on("destroy", (sessCode, reason) => {
	log.debug("Received Destroy:", sessCode);
	sessionManager.destroy(sessCode, reason);
});

translator.on("ping", (code) => {
	// Not currently used
	log.debug("Received Ping:", code);
	redisMessenger.output(code, "pong", { hostname });
});

redisDestroyDHandler.on("destroy-d", (sessCode, reason) => {
	if (!sessionManager.get(sessCode)) return;
	log.info("Received Destroy-D:", sessCode, reason);
	sessionManager.destroy(sessCode, reason);
});

redisExpireHandler.on("expired", (sessCode, channel) => {
	if (!sessionManager.get(sessCode)) return;
	log.info("Received Expire:", sessCode, channel);
	sessionManager.destroy(sessCode, "Octave Session Expired (downstream)");
});

sessionManager.on("touch", (sessCode) => {
	redisMessenger.touchOutput(sessCode);
});

sessionManager.on("live", (sessCode) => {
	redisMessenger.setLive(sessCode);
});

sessionManager.on("destroy-u", (sessCode, reason) => {
	log.info("Sending Destroy-U:", reason, sessCode);
	redisMessenger.destroyU(sessCode, reason);
});

gcStats.on("stats", (stats) => {
	mlog.trace(`Garbage Collected (type ${stats.gctype}, ${stats.pause/1e6} ms)`);
});

redisMaintenanceHandler.on("reboot-request", maintenanceRequestManager.onMessage.bind(maintenanceRequestManager));
maintenanceRequestManager.on("request-maintenance", redisMessenger.requestReboot.bind(redisMessenger));
maintenanceRequestManager.on("reply-to-maintenance-request", redisMessenger.replyToRebootRequest.bind(redisMessenger));

// Connection-accepting loop
var ACCEPT_CONS = true;
async.forever(
	(next) => {
		if (!ACCEPT_CONS) return;
		async.waterfall([
			(_next) => {
				let delay = Math.floor(config.worker.clockInterval.min + Math.random()*(config.worker.clockInterval.max-config.worker.clockInterval.min));
				setTimeout(_next, delay);
			},
			(_next) => {
				if (sessionManager.canAcceptNewSessions())
					redisScriptHandler.getSessCode((err, sessCode, content) => {
						if (err) log.error("Error getting sessCode:", err);
						_next(null, sessCode, content);
					});
				else
					process.nextTick(() => {
						_next(null, null, null);
					});
			},
			(sessCode, content, _next) => {
				if (sessCode) {
					log.info("Received Session:", sessCode);
					sessionManager.attach(sessCode, content);
				}

				_next(null);
			}
		], next);
	},
	() => { log.error("Connection-accepting loop ended"); }
);

// Request maintenance time every 12 hours
var maintenanceTimer;
async.forever(
	(next) => {
		async.series([
			(_next) => {
				maintenanceTimer = setTimeout(_next, config.maintenance.interval);
			},
			(_next) => {
				maintenanceRequestManager.beginRequestingMaintenance();
				maintenanceRequestManager.once("maintenance-accepted", _next);
			},
			(_next) => {
				sessionManager.disablePool();
				async.whilst(
					() => { return sessionManager.numActiveSessions() > 0; },
					(__next) => { maintenanceTimer = setTimeout(__next, config.maintenance.pauseDuration); },
					_next
				);
			},
			(_next) => {
				sessionManager.terminate();
				maintenanceTimer = setTimeout(_next, config.maintenance.pauseDuration);
			},
			(_next) => {
				runMaintenance(_next);
			},
			(_next) => {
				sessionManager.restart();
				maintenanceTimer = setTimeout(_next, config.maintenance.pauseDuration);
			},
			(_next) => {
				maintenanceRequestManager.reset();
				_next();
			}
		], () => {
			next();
		});
	},
	(err) => { log.error("Maintenance loop ended", err); }
);

function doExit() {
	log.info("RECEIVED SIGNAL.  Terminating gracefully.");

	sessionManager.terminate("Server Maintenance");
	clearTimeout(maintenanceTimer);
	maintenanceRequestManager.stop();
	ACCEPT_CONS = false;

	setTimeout(() => {
		redisInputHandler.close();
		redisDestroyDHandler.close();
		redisExpireHandler.close();
		redisScriptHandler.close();
		redisMaintenanceHandler.close();
		redisMessenger.close();
	}, 5000);
}

process.on("SIGINT", doExit);
process.on("SIGHUP", doExit);
process.on("SIGTERM", doExit);

//const heapdump = require("heapdump");
//setInterval(() => { heapdump.writeSnapshot("/srv/oo/logs/heap/" + hostname + "." + process.pid + "." + Date.now() + ".heapsnapshot"); }, 30000);
