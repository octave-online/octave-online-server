"use strict";

const async = require("async");
const GitUtil = require("./git-util");
const WorkingUtil = require("./working-util");
const path = require("path");
const SocketIOFileUploadServer = require("socketio-file-upload");
const config = require("@oo/shared").config;
const FakeSocket = require("./fake-socket");
const logger = require("@oo/shared").logger;
const EventEmitter = require("events");

class FilesController extends EventEmitter {
	constructor(gitDir, workDir, logMemo) {
		super();
		this._log = logger(`files-controller:${logMemo}`);
		this._mlog = logger(`files-controller:${logMemo}:minor`);

		this.gitUtil = new GitUtil(gitDir, logMemo);
		this.workingUtil = new WorkingUtil(workDir, logMemo);
		this.workDir = workDir;
		this.user = null;

		this.fakeSocket = new FakeSocket();
		this.fakeSocket.on("_emit", this._sendMessage.bind(this));
		this._setupUploader();
	}

	receiveMessage(name, content) {
		switch (name) {
			case "user-info":
				this.user = content.user;
				if (this.user) {
					this._log.info("Received user:", this.user.consoleText);
				} else {
					this._log.info("No user this session");
					return;
				}

				async.waterfall([
					(_next) => {
						this.gitUtil.initialize(this.user, this.workDir, _next);
					},
					(results, _next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) {
						if (/unable to write file/.test(err.message)) return this._fail("saved", "warn", `Whoops! You are currently exceeding your space limit of ${config.docker.diskQuotaKiB} KiB.\nPlease open a support ticket and we will help you resolve the\nissue. Sorry for the inconvenience!`);
						else return this._log.error(err);
					}
					this._mlog.debug("User successfully initialized");
					// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
					this._sendMessage("user", {
						name: this.user.displayName,
						legalTime: this.user.legalTime,
						email: this.user.email,
						repo_key: this.user.repo_key,
						share_key: this.user.share_key,
						program: this.user.program,
						files: fileData,
						refresh: false
					});
				});
				break;

			case "list":
				if (!this.user) return this._mlog.debug("Won't perform action on null user repository");
				this._mlog.debug("Listing files...");
				async.waterfall([
					(_next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) return this._log.error(err);
					this._log.debug("Files successfully listed");
					// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
					this._sendMessage("user", {
						name: this.user.displayName,
						legalTime: this.user.legalTime,
						email: this.user.email,
						repo_key: this.user.repo_key,
						share_key: this.user.share_key,
						program: this.user.program,
						files: fileData,
						refresh: false
					});
				});
				break;

			case "refresh":
				if (!this.user) return this._mlog.debug("Won't perform action on null user repository");
				this._mlog.debug("Refreshing files...");
				async.waterfall([
					(_next) => {
						this.gitUtil.pullPush("Scripted user file commit", _next);
					},
					(results, _next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) return this._log.error(err);
					this._log.debug("Files successfully refreshed");
					// Sending the user info with this event is deprecated and is for backwards compatibility only.  In the future, the event should be renamed to something like "files" and the user info should be removed.
					this._sendMessage("user", {
						name: this.user.displayName,
						legalTime: this.user.legalTime,
						email: this.user.email,
						repo_key: this.user.repo_key,
						share_key: this.user.share_key,
						program: this.user.program,
						files: fileData,
						refresh: true
					});
				});
				break;

			case "commit":
				if (!this.user) return this._fail("committed", "debug", "Won't perform action on null user repository");
				var comment = content.comment;
				if (!comment) return this._fail("committed", "warn", "Empty comment:", comment);
				this._mlog.debug("Committing files...");
				async.waterfall([
					(_next) => {
						this.gitUtil.pullPush(comment, _next);
					}
				], (err) => {
					if (err) return this._fail("committed", "warn", err);
					this._log.debug("Files successfully committed");
					return this._sendMessage("committed", { success: true });
				});
				break;

			case "save":
				var filename = content.filename;
				var value = content.content;
				this._mlog.debug("Saving file:", filename);
				if (!filename) return this._fail("saved", "warn", "Empty file name:", filename, value);
				async.waterfall([
					(_next) => {
						this.workingUtil.saveFile(filename, value, _next);
					}
				], (err) => {
					if (err) {
						if (/ENOSPC/.test(err.message)) return this._fail("saved", "warn", `Whoops, you reached your space limit (${config.docker.diskQuotaKiB} KiB).\nYou should free up space to ensure that changes you make get committed.\nRunning the command "system('rm octave-workspace')" might help.`);
						else return this._fail("saved", "error", err);
					}
					this._log.debug("File successfully saved");
					return this._sendMessage("saved", { filename, success: true });
				});
				break;

			case "rename":
				var oldname = content.filename;
				var newname = content.newname;
				if (!oldname || !newname) return this._fail("renamed", "warn", "Empty file name or new name:", oldname, newname);
				this._mlog.debug("Renaming file:", oldname, newname);
				async.waterfall([
					(_next) => {
						this.workingUtil.renameFile(oldname, newname, _next);
					}
				], (err) => {
					if (err) return this._fail("renamed", "error", err);
					this._log.debug("File successfully renamed");
					return this._sendMessage("renamed", { oldname, newname, success: true });
				});
				break;

			case "delete":
				var filename = content.filename;
				if (!filename) return this._fail("deleted", "warn", "Empty file name:", filename);
				this._mlog.debug("Deleting file:", filename);
				async.waterfall([
					(_next) => {
						this.workingUtil.deleteFile(filename, _next);
					}
				], (err) => {
					if (err) {
						if (/ENOENT/.test(err.message)) return this._fail("deleted", "warn", `Whoops, the file ${filename} does not exist any more.\nTry pressing the "refresh files" button in the file manager toolbar.`);
						else return this._fail("deleted", "error", err);
					}
					this._log.debug("File successfully deleted");
					return this._sendMessage("deleted", { filename, success: true });
				});
				break;

			case "binary":
				var filename = content.filename;
				if (!filename) return this._fail("binary", "warn", "Empty file name:", filename);
				this._mlog.debug("Loading binary file:", filename);
				async.waterfall([
					(_next) => {
						this.workingUtil.readBinary(filename, _next);
					}
				], (err, base64data, mime) => {
					if (err) return this._fail("binary", "error", err);
					this._log.debug("File successfully loaded");
					return this._sendMessage("binary", { filename, base64data, mime, success: true });
				});
				break;

			case "read-delete-binary":
				var filename = content.filename;
				if (!filename) return this._fail("deleted-binary", "warn", "Empty file name:", filename);
				this._mlog.debug("Loading and deleting binary file:", filename);
				async.series([
					(_next) => {
						this.workingUtil.readBinary(filename, _next);
					}, (_next) => {
						this.workingUtil.deleteFile(filename, _next);
					}
				], (err, results) => {
					if (err) return this._fail("deleted-binary", "error", err);
					let base64data = results[0][0];
					let mime = results[0][1];
					this._log.debug("File successfully loaded and deleted");
					return this._sendMessage("deleted-binary", { filename, base64data, mime, success: true });
				});
				break;

			// Send remaining messages to the fakeSocket
			default:
				this.fakeSocket.trigger(name, content);
				break;
		}
	}

	// Send messages downstream
	_sendMessage(name, content) {
		this.emit("message", name, content);
	}

	// Log and send failure messages
	_fail() {
		let args = Array.prototype.slice.call(arguments, 2);
		let messageString = args.join(" ");
		this._log[arguments[1]].apply(this, args);
		this._sendMessage(arguments[0], { success: false, message: messageString });
	}

	// Set up SIOFU
	_setupUploader() {
		const uploader = new SocketIOFileUploadServer();
		uploader.dir = this.workDir;
		uploader.emitChunkFail = true;
		uploader.on("saved", (event) => {
			const filename = path.basename(event.file.pathName);
			this.workingUtil.getFileInfo(filename, (err, fileInfo) => {
				if (err) return this._log.warn(err);
				if (!fileInfo) return this._fail("saved", "warn", "Your file uploaded, but it will not appear in the list due to an illegal file name.");
				this._log.debug("File successfully uploaded");
				return this._sendMessage("fileadd", fileInfo);
			});
		});
		uploader.on("error", (event) => {
			if (/ENOSPC/.test(event.error.message)) return this._fail("saved", "debug", `Uploading ${event.file.name}:\nIf your file is large and causes you to exceed your space limit\n(${config.docker.diskQuotaKiB} KiB), the file may be incomplete.`);
			this._log.error("siofu:", event);
		});
		uploader.listen(this.fakeSocket);
	}
}

module.exports = FilesController;
