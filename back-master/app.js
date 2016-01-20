"use strict";

const log = require("@oo/shared").logger("app");
const MessageTranslator = require("./src/message-translator");
const RedisMessenger = require("@oo/shared").RedisMessenger;
const SessionManager = require("./src/session-manager");
const MaintenanceReuestManager = require("./src/maintenance-request-manager");
const async = require("async");
const runMaintenance = require("./src/maintenance");
const config = require("@oo/shared").config;

log.info("Master process ID:", process.pid);

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

translator.on("for-upstream", (sessCode, name, content) => {
	const session = sessionManager.get(sessCode);
	if (!session) return;
	log.trace("Sending Upstream:", sessCode, name);
	session.sendMessage(name, content);
});

translator.on("for-downstream", (sessCode, name, content) => {
	log.trace("Sending Downstream:", sessCode, name);
	redisMessenger.output(sessCode, name, content);
});

translator.on("destroy", (sessCode, reason) => {
	log.debug("Received Destroy:", sessCode);
	sessionManager.destroy(sessCode, reason);
});

redisDestroyDHandler.on("destroy-d", (sessCode, reason) => {
	if (!sessionManager.get(sessCode)) return;
	log.info("Received Destroy-D:", sessCode, reason);
	sessionManager.destroy(sessCode, reason);
});

redisExpireHandler.on("expired", (sessCode) => {
	if (!sessionManager.get(sessCode)) return;
	log.info("Received Expire:", sessCode);
	sessionManager.destroy(sessCode, "Octave Session Expired (downstream)");
});

redisScriptHandler.on("sesscode", (sessCode, user) => {
	log.info("Received Session:", sessCode);
	// Backwards compatibility: if legalTime or payloadLimit is not specified in user object, set it to the user default
	if (user && !user.legalTime) user.legalTime = config.session.legalTime.user;
	if (user && !user.payloadLimit) user.payloadLimit = config.session.payloadLimit.user;

	// Send special message for beta testers
	redisMessenger.output(sessCode, "data", { type: "stdout", data: "Hello! You have been connected to an updated Octave kernel.\nIt should be more stable and reliable than the classic version.\nIf you encounter any problems, please notify the support team.\n\n\n\n\n\n\n\n\n" });

	sessionManager.attach(sessCode, user);
});

sessionManager.on("touch", (sessCode) => {
	redisMessenger.touchOutput(sessCode);
});

sessionManager.on("destroy-u", (sessCode, reason) => {
	log.info("Sending Destroy-U:", reason, sessCode);
	redisMessenger.destroyU(sessCode, reason);
});

redisMaintenanceHandler.on("reboot-request", maintenanceRequestManager.onMessage.bind(maintenanceRequestManager));
maintenanceRequestManager.on("request-maintenance", redisMessenger.requestReboot.bind(redisMessenger));
maintenanceRequestManager.on("reply-to-maintenance-request", redisMessenger.replyToRebootRequest.bind(redisMessenger));

// Connection-accepting loop
let ACCEPT_CONS = true;
var getSessCodeTimer;
function getSessCode() {
	if (ACCEPT_CONS && sessionManager.numActiveSessions() < config.worker.maxSessions) {
		redisScriptHandler.getSessCode();
	}
	getSessCodeTimer = setTimeout(getSessCode, Math.floor(config.worker.clockInterval.min + Math.random()*(config.worker.clockInterval.max-config.worker.clockInterval.min)));
}
getSessCodeTimer = setTimeout(getSessCode, config.worker.clockInterval.max);

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
				ACCEPT_CONS = false;
				sessionManager.disablePool();
				async.whilst(
					() => { return sessionManager.numActiveSessions() > 0 },
					(__next) => { maintenanceTimer = setTimeout(__next, config.maintenance.pauseDuration) },
					_next
				);
			},
			(_next) => {
				maintenanceTimer = setTimeout(_next, config.maintenance.pauseDuration);
			},
			(_next) => {
				runMaintenance(_next);
			},
			(_next) => {
				sessionManager.enablePool();
				maintenanceTimer = setTimeout(_next, config.maintenance.pauseDuration);
			},
			(_next) => {
				ACCEPT_CONS = true;
				maintenanceRequestManager.reset();
				_next();
			}
		], () => {
			next();
		});
	},
	() => { log.error("Maintenance loop ended") }
);

process.on("SIGTERM", () => {
	log.info("RECEIVED SIGTERM.  Terminating gracefully.");

	sessionManager.terminate("Server Maintenance");
	clearTimeout(getSessCodeTimer);
	clearTimeout(maintenanceTimer);
	maintenanceRequestManager.stop();

	setTimeout(() => {
		redisInputHandler.close();
		redisDestroyDHandler.close();
		redisExpireHandler.close();
		redisScriptHandler.close();
		redisMaintenanceHandler.close();
		redisMessenger.close();
	}, 15000);
});
