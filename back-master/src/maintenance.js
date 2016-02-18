"use strict";

const child_process = require("child_process");
const log = require("@oo/shared").logger("maintenance");
const config = require("@oo/shared").config;

function runMaintenance(next) {
	log.info("Starting Maintenance Routine");

	switch (config.session.implementation) {
		case "docker":
			let MAINTENANCE_COMMAND = 'docker ps -a --filter "status=exited" --filter "ancestor=oo/'+config.docker.images.octaveSuffix+'" | cut -c -12 | xargs -n 1 docker rm -f; docker ps -a --filter "status=exited" --filter "ancestor=oo/'+config.docker.images.filesystemSuffix+'" | cut -c -12 | xargs -n 1 docker rm -f';
			log.trace("Running command:", MAINTENANCE_COMMAND);
			child_process.exec(MAINTENANCE_COMMAND, (err, stdout, stderr) => {
				log.info("Finished Maintenance Routine");
				if (err) log.warn(err);
				log.trace(stdout);
				log.trace(stderr);
				next();
			});
			break;

		case "selinux":
			// Exit this process and let the daemon running it clean up and restart
			process.exit(0);
			break;

		default:
			log.error("Please provide a maintenance command for your implementation");
			break;
	}
}

module.exports = runMaintenance;
