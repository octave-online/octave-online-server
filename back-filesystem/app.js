"use strict";

const async = require("async");
const messenger = new (require("@oo/shared").StdioMessenger)();
const log = require("@oo/shared").logger("app");
const GitUtil = require("./src/git-util");
const WorkingUtil = require("./src/working-util");
const fakeSocket = new (require("./src/fake-socket"))();
const path = require("path");
const SocketIOFileUploadServer = require("socketio-file-upload");
const config = require("@oo/shared").config;

// Set up the STDIO messenger instance so we can talk to the master
messenger._log = require("@oo/shared").logger("messenger");
messenger.setReadStream(process.stdin);
messenger.setWriteStream(process.stdout);
fakeSocket.on("_emit", messenger.sendMessage.bind(messenger));

// Customize options on the logger
require("./src/logger");

// Read command-line arguments
const GIT_DIR = process.argv[2];
const WORK_DIR = process.argv[3];
GitUtil.execOptions.cwd = GIT_DIR;
WorkingUtil.cwd = WORK_DIR;
log.info("Dirs:", GIT_DIR, WORK_DIR);

// Use a global variable to remember the identity of the user (required for backwards compatibility only with old events)
var userGlobal;

// Log and send failure messages
function fail() {
	let args = Array.prototype.slice.call(arguments, 2);
	let messageString = args.join(" ");
	log[arguments[1]].apply(log, args);
	messenger.sendMessage(arguments[0], { success: false, message: messageString });
}

// Main: switch between the different messages and handle them
messenger.on("message", (name, content) => {
	switch (name) {
		case "user-info":
			userGlobal = content.user;
			if (userGlobal) {
				log.info("Received user:", userGlobal.consoleText);
			} else {
				log.info("No user this session");
				return;
			}

			async.waterfall([
				(_next) => {
					GitUtil.initialize(userGlobal, WORK_DIR, _next);
				},
				(results, _next) => {
					WorkingUtil.listAll(_next);
				}
			], (err, fileData) => {
				if (err) {
					if (/unable to write file/.test(err.message)) return fail("saved", "warn", `Whoops! You are currently exceeding your space limit of ${config.docker.diskQuotaKiB} KiB.\nPlease open a support ticket and we will help you resolve the\nissue. Sorry for the inconvenience!`);
					else return log.error(err);
				}
				log.debug("User successfully initialized");
				// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
				messenger.sendMessage("user", {
					name: userGlobal.displayName,
					legalTime: userGlobal.legalTime,
					email: userGlobal.email,
					repo_key: userGlobal.repo_key,
					share_key: userGlobal.share_key,
					program: userGlobal.program,
					files: fileData,
					refresh: false
				});
			});
			break;

		case "list":
			if (!userGlobal) return log.debug("Won't perform action on null user repository");
			log.debug("Listing files...");
			async.waterfall([
				(_next) => {
					WorkingUtil.listAll(_next);
				}
			], (err, fileData) => {
				if (err) return log.error(err);
				log.debug("Files successfully listed");
				// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
				messenger.sendMessage("user", {
					name: userGlobal.displayName,
					legalTime: userGlobal.legalTime,
					email: userGlobal.email,
					repo_key: userGlobal.repo_key,
					share_key: userGlobal.share_key,
					program: userGlobal.program,
					files: fileData,
					refresh: false
				});
			});
			break;

		case "refresh":
			if (!userGlobal) return log.debug("Won't perform action on null user repository");
			log.debug("Refreshing files...");
			async.waterfall([
				(_next) => {
					GitUtil.pullPush("Scripted user file commit", _next);
				},
				(results, _next) => {
					WorkingUtil.listAll(_next);
				}
			], (err, fileData) => {
				if (err) return log.error(err);
				log.debug("Files successfully refreshed");
				// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
				messenger.sendMessage("user", {
					name: userGlobal.displayName,
					legalTime: userGlobal.legalTime,
					email: userGlobal.email,
					repo_key: userGlobal.repo_key,
					share_key: userGlobal.share_key,
					program: userGlobal.program,
					files: fileData,
					refresh: true
				});
			});
			break;

		case "commit":
			if (!userGlobal) return fail("committed", "debug", "Won't perform action on null user repository");
			var comment = content.comment;
			if (!comment) return fail("committed", "warn", "Empty comment:", comment);
			log.debug("Committing files...");
			async.waterfall([
				(_next) => {
					GitUtil.pullPush(comment, _next);
				}
			], (err) => {
				if (err) return fail("committed", "warn", err);
				log.debug("Files successfully committed");
				return messenger.sendMessage("committed", { success: true });
			});
			break;

		case "save":
			var filename = content.filename;
			var value = content.content;
			log.debug("Saving file:", filename);
			if (!filename || !value) return fail("saved", "warn", "Empty file name or value:", filename, value);
			async.waterfall([
				(_next) => {
					WorkingUtil.saveFile(filename, value, _next);
				}
			], (err) => {
				if (err) {
					if (/ENOSPC/.test(err.message)) return fail("saved", "warn", `Whoops, you reached your space limit (${config.docker.diskQuotaKiB} KiB).\nYou should free up space to ensure that changes you make get committed.`);
					else return fail("saved", "warn", err);
				}
				log.debug("File successfully saved");
				return messenger.sendMessage("saved", { filename, success: true });
			});
			break;

		case "rename":
			var oldname = content.filename;
			var newname = content.newname;
			if (!oldname || !newname) return fail("renamed", "warn", "Empty file name or new name:", oldname, newname);
			log.debug("Renaming file:", oldname, newname);
			async.waterfall([
				(_next) => {
					WorkingUtil.renameFile(oldname, newname, _next);
				}
			], (err) => {
				if (err) return fail("renamed", "warn", err);
				log.debug("File successfully renamed");
				return messenger.sendMessage("renamed", { oldname, newname, success: true });
			});
			break;

		case "delete":
			var filename = content.filename;
			if (!filename) return fail("deleted", "warn", "Empty file name:", filename);
			log.debug("Deleting file:", filename);
			async.waterfall([
				(_next) => {
					WorkingUtil.deleteFile(filename, _next);
				}
			], (err) => {
				if (err) return fail("deleted", "warn", err);
				log.debug("File successfully deleted");
				return messenger.sendMessage("deleted", { filename, success: true });
			});
			break;

		case "binary":
			var filename = content.filename;
			if (!filename) return fail("binary", "warn", "Empty file name:", filename);
			log.debug("Loading binary file:", filename);
			async.waterfall([
				(_next) => {
					WorkingUtil.readBinary(filename, _next);
				}
			], (err, base64data, mime) => {
				if (err) return fail("binary", "warn", err);
				log.debug("File successfully loaded");
				return messenger.sendMessage("binary", { filename, base64data, mime, success: true });
			});
			break;

		case "read-delete-binary":
			var filename = content.filename;
			if (!filename) return fail("deleted-binary", "warn", "Empty file name:", filename);
			log.debug("Loading and deleting binary file:", filename);
			async.series([
				(_next) => {
					WorkingUtil.readBinary(filename, _next);
				}, (_next) => {
					WorkingUtil.deleteFile(filename, _next);
				}
			], (err, results) => {
				if (err) return fail("deleted-binary", "warn", err);
				let base64data = results[0][0];
				let mime = results[0][1];
				log.debug("File successfully loaded and deleted");
				return messenger.sendMessage("deleted-binary", { filename, base64data, mime, success: true });
			});
			break;

		// Send remaining messages to the fakeSocket
		default:
			fakeSocket.trigger(name, content);
			break;
	}
});

messenger.on("error", (err) => {
	log.error("messenger:", err);
});

// Set up SIOFU
const uploader = new SocketIOFileUploadServer();
uploader.dir = WORK_DIR;
uploader.emitChunkFail = true;
uploader.on("saved", (event) => {
	const filename = path.basename(event.file.pathName);
	WorkingUtil.getFileInfo(filename, (err, fileInfo) => {
		if (err) return log.warn(err);
		if (!fileInfo) return fail("saved", "warn", "Your file uploaded, but it will not appear in the list due to an illegal file name.");
		log.debug("File successfully uploaded");
		return messenger.sendMessage("fileadd", fileInfo);
	});
});
uploader.on("error", (event) => {
	if (/ENOSPC/.test(event.error.message)) return fail("saved", "warn", `Uploading ${event.file.name}:\nIf your file is large and causes you to exceed your space limit\n(${config.docker.diskQuotaKiB} KiB), the file may be incomplete.`);
	log.error("siofu:", event);
});
uploader.listen(fakeSocket);

messenger.sendMessage("ack", true);
