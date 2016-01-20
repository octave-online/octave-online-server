"use strict";

const async = require("async");
const temp = require("temp");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("@oo/shared").logger;
const OnlineOffline = require("@oo/shared").OnlineOffline;

// This file is based on http://souptonuts.sourceforge.net/quota_tutorial.html

const IMG_FILE_NAME = "img.ext3";
const IMG_MNT_DIR = "mnt";
const IMG_DATA_DIR = "data";

class CappedFileSystem extends OnlineOffline {
	constructor(sessCode, size) {
		super();
		this.sessCode = sessCode;
		this._log = logger("capped-file-system:" + sessCode);

		this._size = size;
	}

	_doCreate(next) {
		this._cleanups = [];

		async.series([
			(_next) => {
				this._log.trace("Making temp dir...");
				temp.mkdir(null, (err, tmpdir) => {
					if (tmpdir) this._tmpdir = tmpdir;
					if (!err) this._cleanups.unshift((__next) => {
						fs.rmdir(tmpdir, __next);
					});
					_next(err);
				});
			},
			(_next) => {
				this._log.debug("Created temp dir", this._tmpdir);
				this._log.trace("Allocating space for filesystem...");
				const imgFileName = path.join(this._tmpdir, IMG_FILE_NAME);
				child_process.execFile("dd", ["if=/dev/zero", `of=${imgFileName}`, "bs=1k", `count=${this._size}`], (err, stdout, stderr) => {
					if (!err) this._cleanups.unshift((__next) => {
						fs.unlink(imgFileName, __next);
					});
					_next(err);
				});
			},
			(_next) => {
				this._log.trace("Formatting file system...");
				const imgFileName = path.join(this._tmpdir, IMG_FILE_NAME);
				child_process.execFile("mkfs", ["-t", "ext3", "-q", imgFileName, "-F"], (err, stdout, stderr) => {
					_next(err);
				});
			},
			(_next) => {
				this._log.trace("Creating mount directory...");
				const imgMntDir = path.join(this._tmpdir, IMG_MNT_DIR);
				fs.mkdir(imgMntDir, 0o700, (err) => {
					if (!err) this._cleanups.unshift((__next) => {
						fs.rmdir(imgMntDir, __next);
					});
					_next(err);
				});
			},
			(_next) => {
				this._log.trace("Mounting file system...");
				const imgFileName = path.join(this._tmpdir, IMG_FILE_NAME);
				const imgMntDir = path.join(this._tmpdir, IMG_MNT_DIR);
				child_process.execFile("sudo", ["mount", "-o", "loop,rw", imgFileName, imgMntDir], (err, stdout, stderr) => {
					if (!err) this._cleanups.unshift((__next) => {
						child_process.execFile("sudo", ["umount", imgMntDir], __next);
					});
					_next(err);
				});
			},
			(_next) => {
				this._log.trace("Claiming ownership of file system root...");
				const imgMntDir = path.join(this._tmpdir, IMG_MNT_DIR);
				child_process.execFile("sudo", ["chown", process.env.USER, imgMntDir], (err, stdout, stderr) => {
					_next(err);
				});
			},
			(_next) => {
				this._log.trace("Creating data directory...");
				const imgDataDir = path.join(this._tmpdir, IMG_MNT_DIR, IMG_DATA_DIR);
				fs.mkdir(imgDataDir, 0o700, (err) => {
					// Cleanup function not necessary here because the directory resides in the guest filesystem
					_next(err);
				});
			}
		], (err) => {
			if (err) return this.destroy((_err) => { next(err); });

			const imgDataDir = path.join(this._tmpdir, IMG_MNT_DIR, IMG_DATA_DIR);
			this.dir = imgDataDir;

			return next(null, imgDataDir);
		});
	}

	_doDestroy(next) {
		async.series(this._cleanups, (err) => {
			if (err) return next(err);
			this._enabled = false;
			this._cleanups = null;
			this._tmpdir = null;
			this.dir = null;
			return next(null);
		});
	}
}

module.exports = CappedFileSystem;
