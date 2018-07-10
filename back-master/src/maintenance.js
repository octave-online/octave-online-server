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

const child_process = require("child_process");
const log = require("@oo/shared").logger("maintenance");
const config = require("@oo/shared").config;

function runMaintenance(next) {
	log.info("Starting Maintenance Routine");

	switch (config.session.implementation) {
		case "docker": {
			let MAINTENANCE_COMMAND = "docker ps -a --filter \"status=exited\" --filter \"ancestor=oo/" + config.docker.images.octaveSuffix + "\" | cut -c -12 | xargs -n 1 docker rm -f; docker ps -a --filter \"status=exited\" --filter \"ancestor=oo/" + config.docker.images.filesystemSuffix + "\" | cut -c -12 | xargs -n 1 docker rm -f";
			log.trace("Running command:", MAINTENANCE_COMMAND);
			child_process.exec(MAINTENANCE_COMMAND, (err, stdout, stderr) => {
				log.info("Finished Maintenance Routine");
				if (err) log.warn(err);
				log.trace(stdout);
				log.trace(stderr);
				next();
			});
			break;
		}

		case "selinux": {
			// Exit this process and let the daemon running it clean up and restart
			process.exit(0);
			break;
		}

		default: {
			log.error("Please provide a maintenance command for your implementation");
			break;
		}
	}
}

module.exports = runMaintenance;
