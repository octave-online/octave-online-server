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

/**
 * Module dependencies.
 */

const app = require("../app");
const db = require("../src/db");
const debug = require("debug")("utils-admin:server");
const http = require("http");
const config = require("@oo/shared").config;

(async function() {

	// Database connection.
	const mongoUrl = `mongodb://${config.mongo.hostname}:${config.mongo.port}`;
	const mongoDb = config.mongo.db;
	await db.connect(mongoUrl, mongoDb);
	debug("Connected to MongoDB:", mongoUrl, mongoDb);

	// Get port from environment and store in Express.

	const port = normalizePort(process.env.PORT || "3000");
	app.set("port", port);

	// Create HTTP server.

	const server = http.createServer(app);

	// Listen on provided port, on all network interfaces.

	server.listen(port);
	server.on("error", onError);
	server.on("listening", onListening);

	// Normalize a port into a number, string, or false.

	function normalizePort(val) {
		const port = parseInt(val, 10);

		if (isNaN(port)) {
		// named pipe
			return val;
		}

		if (port >= 0) {
		// port number
			return port;
		}

		return false;
	}

	// Event listener for HTTP server "error" event.

	function onError(error) {
		if (error.syscall !== "listen") {
			throw error;
		}

		const bind = typeof port === "string"
			? "Pipe " + port
			: "Port " + port;

		// handle specific listen errors with friendly messages
		switch (error.code) {
			case "EACCES":
				debug(bind + " requires elevated privileges");
				process.exit(1);
				break;
			case "EADDRINUSE":
				debug(bind + " is already in use");
				process.exit(1);
				break;
			default:
				throw error;
		}
	}

	// Event listener for HTTP server "listening" event.

	function onListening() {
		const addr = server.address();
		const bind = typeof addr === "string"
			? "pipe " + addr
			: "port " + addr.port;
		debug("Listening on " + bind);
	}

// async function
})().catch((err) => {
	throw err;
});
