#!/usr/bin/env node
/*
 * Copyright © 2020, Octave Online LLC
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

// This tool deletes repos from inactive users.

const config = require("@oo/shared").config;
const db = require("../src/db");
const debug = require("debug")("oo:repo-cleanup");
const repo = require("../src/repo");

const command = process.argv[2];
if (command !== "run" && command != "dryrun") {
	console.log("Usage: DEBUG=oo:* bin/repo-cleanup.js [dry]run [30 [200]]");
	return;
}

(async function() {

	// Database connection.
	const mongoUrl = `mongodb://${config.mongo.hostname}:${config.mongo.port}`;
	const mongoDb = config.mongo.db;
	await db.connect(mongoUrl, mongoDb);
	debug("Connected to MongoDB:", mongoUrl, mongoDb);

	let numDays = parseInt(process.argv[3]) || 30;
	debug("Number of days to clean:", numDays);

	let skipDays = parseInt(process.argv[4]) || 200;
	debug("End at this many days in the past:", skipDays);

	let startTime = new Date();
	startTime.setDate(startTime.getDate() - skipDays - numDays);
	debug("Start time:", startTime);

	let endTime = new Date();
	endTime.setDate(endTime.getDate() - skipDays);
	debug("End time:", endTime);

	const query = {
		"last_activity": {
			"$gt": startTime,
			"$lt": endTime,
		},
		"patreon.currently_entitled_amount_cents": {
			"$in": [null, 0],
		},
	};
	for await (let user of db.findAll("users", query, { parametrized: 1, last_activity: 1 })) {
		debug("Processing:", JSON.stringify(user));
		if (command === "run") {
			await repo.deleteRepo(user);
		}
	}

	db.close();

// async function
})().catch((err) => {
	throw err;
});
