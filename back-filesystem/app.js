"use strict";

// This is the entrypoint for a standalone version of back-filesystem.

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


