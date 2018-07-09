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
		this.bucketId = null;

		this.fakeSocket = new FakeSocket();
		this.fakeSocket.on("_emit", this._sendMessage.bind(this));
		this._setupUploader();
	}

	_isInitialized() {
		return this.user !== null || this.bucketId !== null;
	}

	receiveMessage(name, content) {
		switch (name) {
			case "user-info":
				this.user = content.user;
				if (this.user) {
					this._log.info("Received user:", this.user.consoleText);
					this._legalTime = content.legalTime; // FIXME: For backwards compatibility
				} else {
					this._log.info("No user this session");
					this._sendMessage("files-ready", {});
					return;
				}

				async.waterfall([
					(_next) => {
						this.gitUtil.initialize(this.user, this.workDir, _next);
					},
					(results, _next) => {
						this._sendMessage("files-ready", {});
						_next(null);
					},
					(_next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) {
						if (/unable to write file/.test(err.message)) {
							return this._fail("filelist", "warn", `Whoops! You are currently exceeding your space limit of ${config.docker.diskQuotaKiB} KiB.\nPlease open a support ticket and we will help you resolve the\nissue. Sorry for the inconvenience!`);
						} else {
							this._log.error("Git Initialize Error:", err);
							return this._fail("filelist", "warn", "Unable to load your files from the server: please try again.");
						}
					}
					this._mlog.debug("User successfully initialized");
					this._sendMessage("filelist", {
						success: true,
						legalTime: this._legalTime, // FIXME: for backwards compatibility
						files: fileData,
						refresh: false
					});
				});
				break;

			case "bucket-info":
				this.bucketId = content.id;
				this._legalTime = content.legalTime; // FIXME: For backwards compatibility
				// If content.readonly is false, this request is for creating the bucket.  If content.readonly is true, this request is for reading from the bucket.
				this._log.info("Received bucket:", this.bucketId);
				async.waterfall([
					(_next) => {
						this.gitUtil.initializeBucket(this.bucketId, this.workDir, content.readonly, _next);
					},
					(results, _next) => {
						this._sendMessage("files-ready", {});
						_next(null);
					},
					(_next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) return this._log.error(err);
					this._mlog.debug("Bucket successfully initialized");
					this._sendMessage("filelist", {
						success: true,
						legalTime: this._legalTime, // FIXME: for backwards compatibility
						files: fileData,
						refresh: false
					});
				});
				break;

			case "list":
				if (!this._isInitialized()) return this._mlog.debug("Won't perform action on uninitialized repository");
				this._mlog.debug("Listing files...");
				async.waterfall([
					(_next) => {
						this.workingUtil.listAll(_next);
					}
				], (err, fileData) => {
					if (err) return this._log.error(err);
					this._log.debug("Files successfully listed");
					this._sendMessage("filelist", {
						success: true,
						legalTime: this._legalTime, // FIXME: for backwards compatibility
						files: fileData,
						refresh: false
					});
				});
				break;

			case "refresh":
				if (!this._isInitialized()) return this._mlog.debug("Won't perform action on uninitialized repository");
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
					this._sendMessage("filelist", {
						success: true,
						files: fileData,
						refresh: true
					});
				});
				break;

			case "commit":
				if (!this._isInitialized()) return this._fail("committed", "debug", "Won't perform action on uninitialized repository");
				// NOTE: In a readonly repository (buckets), this is a no-op.
				var comment = content.comment;
				if (!comment) return this._fail("committed", "warn", "Empty comment:", comment);
				this._mlog.debug("Committing files...");
				async.waterfall([
					(_next) => {
						this.gitUtil.pullPush(comment, _next);
					}
				], (err) => {
					if (err) return this._fail("committed", "warn", err);
					this._log.debug("Files successfully committed (except for readonly)");
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
				], (err, md5sum) => {
					if (err) {
						if (/ENOSPC/.test(err.message)) return this._fail("saved", "warn", `Whoops, you reached your space limit (${config.docker.diskQuotaKiB} KiB).\nYou should free up space to ensure that changes you make get committed.\nRunning the command "system('rm octave-workspace')" might help.`);
						else return this._fail("saved", "error", err);
					}
					this._log.debug("File successfully saved");
					return this._sendMessage("saved", {
						success: true,
						filename,
						md5sum
					});
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
					return this._sendMessage("deleted", {
						success: true,
						filename
					});
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
					return this._sendMessage("binary", {
						success: true,
						filename,
						base64data,
						mime
					});
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
					return this._sendMessage("deleted-binary", {
						success: true,
						filename,
						base64data,
						mime
					});
				});
				break;

			case "multi-binary":
				var filenames = content.filenames;
				var responseName = "multi-binary:" + content.id;
				if (!Array.isArray(filenames)) return this._fail(responseName, "warn", "Invalid filename array:", filenames);
				this._mlog.debug("Loading multiple files", responseName, filenames);
				async.map(filenames, (filename, _next) => {
					async.waterfall([
						(__next) => {
							this.workingUtil.readBinary(filename, __next);
						},
						(base64data, mime, __next) => {
							__next(null, base64data);
						}
					], _next);
				}, (err, results) => {
					if (err) return this._fail(responseName, "error", err);
					this._mlog.trace("Files finished loading", responseName);
					return this._sendMessage(responseName, {
						success: true,
						results
					});
				});
				break;

			case "save-multi-binary":
				var filenames = content.filenames;
				var base64datas = content.base64datas;
				var responseName = "multi-binary-saved:" + content.id;
				if (!Array.isArray(filenames) || !Array.isArray(base64datas) || filenames.length !== base64datas.length) return this._fail(responseName, "warn", "Invalid array:", filenames, base64datas);
				this._mlog.debug("Writing multiple files:", responseName, filenames);
				async.times(filenames.length, (i, _next) => {
					var buffer = new Buffer(base64datas[i], "base64");
					this.workingUtil.saveFile(filenames[i], buffer, _next);
				}, (err, results) => {
					if (err) return this._fail(responseName, "error", err);
					this._mlog.trace("Files finished writing", responseName);
					return this._sendMessage(responseName, {
						success: true,
						results
					});
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
