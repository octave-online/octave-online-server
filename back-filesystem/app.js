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

// This is the entrypoint for a standalone version of back-filesystem, used by the Docker mode but NOT the SELinux mode.

const messenger = new (require("@oo/shared").StdioMessenger)();
const log = require("@oo/shared").logger("app");
const FilesController = require("./src/controller");

// Customize options on the logger
require("./src/logger");

// Read command-line arguments
const GIT_DIR = process.argv[2];
const WORK_DIR = process.argv[3];
log.info("Dirs:", GIT_DIR, WORK_DIR);

// Make an instance of controller
var controller = new FilesController(GIT_DIR, WORK_DIR, "");

// Set up the STDIO messenger instance so we can talk to the master
messenger._log = require("@oo/shared").logger("messenger");
messenger.setReadStream(process.stdin);
messenger.setWriteStream(process.stdout);
messenger.on("message", (name, content) => {
	controller.receiveMessage(name, content);
});
controller.on("message", (name, content) => {
	messenger.sendMessage(name, content);
});
messenger.on("error", (err) => {
	log.error("messenger:", err);
});

// Send acknowledgement message downstream
messenger.sendMessage("ack", true);


