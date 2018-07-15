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

try {
	var configString = fs.readFileSync(path.join(__dirname, "..", "config.json"));
} catch(e) {
	console.error("Could not read config.json. Please create this file in the project directory; use config.sample.json as a template.");
	console.error(e);
	process.exit(1);
}

try {
	var config = JSON.parse(configString.toString("utf-8"));
} catch(e) {
	console.error("Possible syntax error in config file!");
	console.error(e);
	process.exit(1);
}

module.exports = config;
