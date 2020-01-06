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
const config = require("@oo/shared").config;
const gcStats = (require("gc-stats"))();
const child_process = require("child_process");
const fs = require("fs");
const mkdirp = require("mkdirp");
const path = require("path");
const async = require("async");

process.stdout.write("Process ID: " + process.pid + "\n");
process.stderr.write("Process ID: " + process.pid + "\n");
log.info("Process ID:", process.pid);
const hostname = child_process.execSync("hostname").toString("utf8").trim();
log.info("Hostname:", hostname);
log.log(process.env);

var sessionManager, mainImpl, personality;
if (fs.existsSync(config.rackspace.personality_filename)) {
	personality = JSON.parse(fs.readFileSync(config.rackspace.personality_filename, "utf8"));
	log.info("Personality:", personality.flavor, personality);
	sessionManager = new SessionManager(true);
	mainImpl = require("./src/main-flavor");
} else if (process.env["OO_FLAVOR_OVERRIDE"]) {
	personality = { flavor: process.env["OO_FLAVOR_OVERRIDE"] };
	log.info("Flavor override:", personality.flavor);
	sessionManager = new SessionManager(true);
	mainImpl = require("./src/main-flavor");
} else {
	log.info("No personality file found");
	personality = null;
	sessionManager = new SessionManager(false);
	mainImpl = require("./src/main-pool");
}

let sessionLogDirCount = 0;
function makeSessionLogDir(tokens) {
	if (tokens.length === config.worker.sessionLogs.depth) {
		const dirname = path.join(config.worker.logDir, config.worker.sessionLogs.subdir, ...tokens);
		if (sessionLogDirCount % 1000 === 0) {
			mlog.trace(dirname);
		}
		sessionLogDirCount++;
		mkdirp.sync(dirname);
	} else {
		for (let a of "0123456789abcdef") {
			makeSessionLogDir(tokens.concat([a]));
		}
	}
}
log.info("Creating session log dirs…");
makeSessionLogDir([]);
log.info(sessionLogDirCount, "dirs touched");

const redisInputHandler = new RedisMessenger().subscribeToInput();
const redisDestroyDHandler = new RedisMessenger().subscribeToDestroyD();
const redisExpireHandler = new RedisMessenger().subscribeToExpired();
const redisScriptHandler = new RedisMessenger().enableSessCodeScriptsSync();
const redisMessenger = new RedisMessenger();
const translator = new MessageTranslator();

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

sessionManager.on("touch", (sessCode, start) => {
	redisMessenger.touchOutput(sessCode);
	if (personality) {
		redisMessenger.output(sessCode, "oo.touch-flavor", {
			start,
			current: new Date().valueOf(),
			flavor: personality.flavor
		});
	}
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

mainImpl.start({
	sessionManager,
	redisScriptHandler,
	redisMessenger,
	personality
}, (err) => {
	log.error("Main-impl ended", err);
	doExit();
});

function doExit() {
	sessionManager.terminate("Server Maintenance");
	mainImpl.doExit();

	setTimeout(() => {
		redisInputHandler.close();
		redisDestroyDHandler.close();
		redisExpireHandler.close();
		redisScriptHandler.close();
		redisMessenger.close();
	}, 5000);
}

function doGracefulExit() {
	log.info("RECEIVED SIGUSR1.  Disabling pool to exit gracefully.");
	mainImpl.doExit();
	sessionManager.disablePool();
	async.series([
		(_next) => {
			async.whilst(
				() => { return sessionManager.numActiveSessions() > 0; },
				(next) => { setTimeout(next, config.maintenance.pauseDuration); },
				_next
			);
		},
		(_next) => {
			log.info("All sessions are closed. Starting exit procedure.")
			doExit();
		}
	], (err) => {
		log.error("Error during graceful exit:", err);
	});
}

function doFastExit() {
	log.info("RECEIVED SIGNAL.  Starting exit procedure.");
	doExit();
}

process.on("SIGINT", doFastExit);
process.on("SIGHUP", doFastExit);
process.on("SIGTERM", doFastExit);
process.on("SIGUSR1", doGracefulExit);

//const heapdump = require("heapdump");
//setInterval(() => { heapdump.writeSnapshot("/srv/oo/logs/heap/" + hostname + "." + process.pid + "." + Date.now() + ".heapsnapshot"); }, 30000);
