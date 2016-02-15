"use strict";

const child_process = require("child_process");
const log = require("@oo/shared").logger("maintenance");
const config = require("@oo/shared").config;

var MAINTENANCE_COMMAND;
switch (config.session.implementation) {
	case "docker":
		MAINTENANCE_COMMAND = 'docker ps -a --filter "status=exited" --filter "ancestor=oo/'+config.docker.images.octaveSuffix+'" | cut -c -12 | xargs -n 1 docker rm -f; docker ps -a --filter "status=exited" --filter "ancestor=oo/'+config.docker.images.filesystemSuffix+'" | cut -c -12 | xargs -n 1 docker rm -f';
		break;
	case "selinux":
		MAINTENANCE_COMMAND = 'echo "FIXME: selinux maintenance"';
		break;
	default:
		log.error("Please provide a maintenance command for your implementation");
		break;
}

function runMaintenance(next) {
	log.info("Starting Maintenance Routine");
	log.trace("Running command:", MAINTENANCE_COMMAND);
	child_process.exec(MAINTENANCE_COMMAND, (err, stdout, stderr) => {
		log.info("Finished Maintenance Routine");
		if (err) log.warn(err);
		log.trace(stdout);
		log.trace(stderr);
		next();
	});
}

module.exports = runMaintenance;
