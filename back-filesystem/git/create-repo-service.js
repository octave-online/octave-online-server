#!/usr/bin/env node

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

/* eslint-disable no-console */

const child_process = require("child_process");
const http = require("http");
const path = require("path");
const url = require("url");

if (process.argv.length !== 4) {
	console.error("Usage: node create-repo-service.js /path/to/git/root PORT");
	process.exit(1);
}

const gitRoot = process.argv[2];
const port = parseInt(process.argv[3]);

http.createServer((req, res) => {
	const { query } = url.parse(req.url, true);
	const isoTime = new Date().toISOString();
	if (["buckets", "repos"].indexOf(query.type) === -1) {
		res.writeHead(400, "Invalid type");
		console.log(`${isoTime} Invalid type`);
		return res.end();
	}
	if (!query.name || !/^[\w]+$/.test(query.name)) {
		res.writeHead(400, "Invalid name");
		console.log(`${isoTime} Invalid name`);
		return res.end();
	}
	const bareRepoPath = path.join(gitRoot, query.type, query.name + ".git");
	const process = child_process.spawn("git", ["init", "--bare", bareRepoPath]);
	let resData = Buffer.alloc(0);
	process.stdout.on("data", (chunk) => {
		resData = Buffer.concat([resData, chunk]);
	});
	process.stderr.on("data", (chunk) => {
		resData = Buffer.concat([resData, chunk]);
	});
	process.on("exit", (code /* , signal */) => {
		if (code === 0) {
			res.writeHead(200, { "Content-Type": "text/plain" });
			console.log(`${isoTime} Created ${bareRepoPath}`);
		} else {
			res.writeHead(500, { "Content-Type": "text/plain" });
			console.log(`${isoTime} Error ${bareRepoPath}`);
			console.log(resData.toString("utf-8"));
		}
		res.write(resData);
		res.end();
	});
}).listen(port);

console.log("Listening on port", port);
