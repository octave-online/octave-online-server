"use strict";

const child_process = require("child_process");
const log = require("@oo/shared").logger("maintenance");
const config = require("@oo/shared").config;

const MAINTENANCE_COMMAND = 'docker ps -a --filter "status=exited" --filter "ancestor=oo/octave" | grep Exited | cut -c -12 | xargs -n 1 docker rm -f; docker ps -a --filter "status=exited" --filter "ancestor=oo/files" | grep Exited | cut -c -12 | xargs -n 1 docker rm -f';

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
