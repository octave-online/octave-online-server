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

const fs = require("fs");
const path = require("path");
const hjson = require("hjson");
const deepmerge = require("deepmerge");

const log = require("./logger")("config");

const defaultConfig = hjson.parse(fs.readFileSync(path.join(__dirname, "..", "config_defaults.hjson")).toString("utf-8"));

try {
	var configBuffer = fs.readFileSync(path.join(__dirname, "..", "config.hjson"));
} catch(e) {
	const message = "Could not read config.hjson. Octave Online Server will use all default settings.";
	log.warn(message);
	// Allow console to make sure the message always gets printed, even when not in debug mode:
	// eslint-disable-next-line no-console
	console.error("Notice: " + message);
	configBuffer = Buffer.alloc(0);
}

try {
	var config = hjson.parse(configBuffer.toString("utf-8"));
} catch(e) {
	// The process will die here if config.hjson is not found, so console is OK
	// eslint-disable-next-line no-console
	console.error("Possible syntax error in config file!");
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
}

const resolvedConfig = deepmerge(defaultConfig, config);

module.exports = resolvedConfig;
