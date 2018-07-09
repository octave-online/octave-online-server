#!/usr/bin/env node
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

const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("@oo/shared").config;
const path = require("path");
const basicAuth = require("basic-auth");
const fs = require("fs");

//const PORT = 5123;
const SOCKET_PATH = "/var/run/oosocks/auth.sock";
try { fs.unlinkSync(SOCKET_PATH); } catch(err) {}
console.log("Listening on UNIX socket " + SOCKET_PATH);

mongoose.connect("mongodb://127.0.0.1: " + config.mongo.port + "/" + config.mongo.db);
const User = mongoose.model("User", {
	email: String,
	parametrized: String,
	password_hash: String
});

var benchmarkMongoAvg = 0.0;
var benchmarkMongoCnt = 0;
var benchmarkBcryptAvg = 0.0;
var benchmarkBcryptCnt = 0;

const server = http.createServer((req, res) => {
	const originalUri = path.normalize(req.headers["x-original-uri"] || "");
	const match1 = /^\/(\w+)\.git\/.*$/.exec(originalUri);
	const match2 = /^\/(src|themes|vendor)\/.*$/.exec(originalUri);
	if (match2 !== null) {
		res.writeHead(204);
		return res.end();
	}
	if (match1 === null) {
		res.writeHead(403);
		return res.end();
	}
	const parametrized = match1[1];
	if (req.headers["authorization"]) {
		// Check username/password
		const creds = basicAuth.parse(req.headers["authorization"]);
		if (!creds) {
			res.writeHead(400);
			return res.end("Invalid credentials");
		}
		const mongoStart = new Date().valueOf();
		User.findOne({ email: creds.name }, (err, user) => {
			const mongoEnd = new Date().valueOf();
			benchmarkMongoAvg = benchmarkMongoAvg + (mongoEnd-mongoStart-benchmarkMongoAvg)/(benchmarkMongoCnt+1);
			benchmarkMongoCnt++;
			if (err || !user) {
				console.error(err || "User not found");
				return prompt(res, "Make sure you entered the correct email/password");
			}
			if (!user.password_hash) {
				return prompt(res, "Make sure you have set a password");
			}
			if (user.parametrized !== parametrized) {
				return prompt(res, "Make sure your repository path is correct");
			}
			const bcryptStart = new Date().valueOf();
			bcrypt.compare(creds.pass, user.password_hash, (err, valid) => {
				const bcryptEnd = new Date().valueOf();
				benchmarkBcryptAvg = benchmarkBcryptAvg + (bcryptEnd-bcryptStart-benchmarkBcryptAvg)/(benchmarkBcryptCnt+1);
				benchmarkBcryptCnt++;
				if (err) {
					console.error(err);
					res.writeHead(400);
					return res.end("Problem validating password");
				}
				if (!valid) {
					return prompt(res, "Make sure you entered the correct email/password");
				}
				res.writeHead(204);
				return res.end();
			});
		});
	} else {
		// Prompt for username/password
		prompt(res, "Please enter your email and password");
	}
});
server.listen(SOCKET_PATH);

function prompt(res, message) {
	res.writeHead(401, {
		"WWW-Authenticate": "Basic realm='"+message+"'"
	});
	return res.end();
}

setInterval(() => {
	console.log("Mongo: " + benchmarkMongoAvg + " (" + benchmarkMongoCnt + " reqs); "
	           +"Bcrypt: "+ benchmarkBcryptAvg+ " (" + benchmarkBcryptCnt+ " reqs)");
}, 86400000);
