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

"use strict";

const child_process = require("child_process");

const config = require("./config");
const log = require("./logger")("gitarchive");

async function createRepoSnapshot(tld, name, outStream) {
	const remote = `git://${config.git.hostname}:${config.git.gitDaemonPort}/${tld}/${name}.git`;
	log.info(`Archiving ${remote}`);

	const p = child_process.execFile("git", ["archive", "--format=zip", "--remote="+remote, "master"], {
		encoding: "buffer",
	});
	p.stdout.pipe(outStream);
	p.stderr.on("data", (data) => {
		log.log(data);
	});

	return new Promise(function(resolve, reject) {
		p.on("close", (code) => {
			log.trace("Git exited with code " + code);
			resolve();
		});
		p.on("error", reject);
	});
}

function generateFilename(name) {
	return `oo_${new Date().toISOString()}_${name}.zip`;
}

module.exports = {
	createRepoSnapshot,
	generateFilename,
};
