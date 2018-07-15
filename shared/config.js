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
const yaml = require("js-yaml");
const deepmerge = require("deepmerge");

const defaultConfig = yaml.load(fs.readFileSync(path.join(__dirname, "..", "config_defaults.yaml")).toString("utf-8"));

try {
	var configBuffer = fs.readFileSync(path.join(__dirname, "..", "config.yaml"));
} catch(e) {
	console.error("Could not read config.yaml. Please create it in the project directory with desired setting overrides.");
	console.error(e);
	process.exit(1);
}

try {
	var config = yaml.load(configBuffer.toString("utf-8"));
} catch(e) {
	console.error("Possible syntax error in config file!");
	console.error(e);
	process.exit(1);
}

const resolvedConfig = deepmerge(defaultConfig, config);

module.exports = resolvedConfig;
