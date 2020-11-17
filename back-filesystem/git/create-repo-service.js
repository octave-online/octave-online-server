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
const fs = require("fs");
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
		console.log(`create-repo-service: ${isoTime} Invalid type`);
		return res.end();
	}
	if (!query.name || !/^[\w]+$/.test(query.name)) {
		res.writeHead(400, "Invalid name");
		console.log(`create-repo-service: ${isoTime} Invalid name`);
		return res.end();
	}
	const bareRepoPath = path.join(gitRoot, query.type, query.name + ".git");
	fs.stat(bareRepoPath, (err) => {
		const exists = !err;
		let process;
		if (query.action === "delete") {
			if (exists) {
				process = child_process.spawn("rm", ["-rf", bareRepoPath]);
			} else {
				res.writeHead(200, { "Content-Type": "text/plain" });
				res.end("Already Deleted\n");
				console.log(`create-repo-service: ${isoTime} Already Deleted: ${bareRepoPath}`);
				return;
			}
		} else {
			if (exists) {
				res.writeHead(200, { "Content-Type": "text/plain" });
				res.end("Already Created\n");
				console.log(`create-repo-service: ${isoTime} Already Created: ${bareRepoPath}`);
				return;
			} else {
				process = child_process.spawn("git", ["init", "--bare", bareRepoPath]);
			}
		}
		let resData = Buffer.alloc(0);
		process.stdout.on("data", (chunk) => {
			resData = Buffer.concat([resData, chunk]);
		});
		process.stderr.on("data", (chunk) => {
			resData = Buffer.concat([resData, chunk]);
		});
		process.on("exit", (code /* , signal */) => {
			const operation = (query.action === "delete") ? "Delete" : "Init";
			if (code === 0) {
				res.writeHead(200, { "Content-Type": "text/plain" });
				res.write(`${operation} Success\n`);
				console.log(`create-repo-service: ${isoTime} ${operation} Success: ${bareRepoPath}`);
			} else {
				res.writeHead(500, { "Content-Type": "text/plain" });
				res.write(`${operation} Error\n`);
				console.log(`create-repo-service: ${isoTime} ${operation} Error: ${bareRepoPath}`);
				console.log(`create-repo-service: ${resData.toString("utf-8")}`);
			}
			res.write(resData);
			res.end();
		});
	});
}).listen(port);

console.log("create-repo-service: Listening on port", port);
