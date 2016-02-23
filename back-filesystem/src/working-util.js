"use strict";

const async = require("async");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const charsetDetector = require("node-icu-charset-detector");
const Iconv = require("iconv").Iconv;
const log = require("@oo/shared").logger("working-util");
const config = require("@oo/shared").config;

// Load extra MIME types
mime.load(path.join(__dirname, "mime.types"));

const ACCEPTABLE_MIME_REGEX = /^(text\/.*)$/;
const UNACCEPTABLE_FILENAME_REGEX = /^(\..*|octave-\w+)$/;

class WorkingUtil {
	static listAll(next) {
		async.waterfall([
			(_next) => {
				fs.readdir(this.cwd, _next);
			},
			(files, _next) => {
				async.map(files, this.getFileInfo.bind(this), _next);
			},
			(fileInfos, _next) => {
				const dict = {};
				fileInfos.forEach((fileInfo) => {
					if (!fileInfo) return;
					let filename = fileInfo.filename;
					delete fileInfo.filename;
					dict[filename] = fileInfo;
				});
				_next(null, dict);
			}
		], next);
	}

	static getFileInfo(filename, next) {
		const _mime = mime.lookup(filename);
		if (ACCEPTABLE_MIME_REGEX.test(_mime)) {
			async.waterfall([
				(_next) => {
					fs.readFile(path.join(this.cwd, filename), _next);
				},
				(buf, _next) => {
					this._convertCharset(buf, _next)
				},
				(buf, _next) => {
					_next(null, {
						filename,
						isText: true,
						content: buf.toString("base64")
					});
				}
			], next);
		} else if (!UNACCEPTABLE_FILENAME_REGEX.test(filename)) {
			return next(null, {
				filename,
				isText: false
			});
		} else {
			return next(null, null);
		}
	}

	static _convertCharset(buf, next) {
		var encoding;

		// Detect and attempt to convert charset
		if (buf.length > 0) {
			try {
				encoding = charsetDetector.detectCharset(buf);
				if (encoding.toString() !== "UTF-8"){
					buf = new Iconv(encoding.toString(), "UTF-8").convert(buf);
				}
			} catch(err) {
				log.warn("Could not convert encoding:", encoding);
			}
		}

		// Convert line endings
		// TODO: Is there a better way than converting to a string here?
		buf = new Buffer(buf.toString("utf8").replace(/\r\n/g, "\n"));

		return next(null, buf);
	}

	static saveFile(filename, value, next) {
		// Create backup of file in memory in case there are any I/O errors
		async.waterfall([
			(_next) => {
				fs.readFile(
					path.join(this.cwd, filename),
						(err, buf) => {
						if (!err) return _next(null, buf);
						if (/ENOENT/.test(err.message)) {
							log.info("Creating new file:", filename);
							return _next(null, new Buffer(0));
						}
						return _next(err);
					});
			},
			(buf, _next) => {
				fs.writeFile(
					path.join(this.cwd, filename),
					value,
					(err) => {
						_next(null, buf, err);
					});
			},
			(buf, err, _next) => {
				if (err) {
					fs.writeFile(
						path.join(this.cwd, filename),
						buf,
						() => {
							_next(err);
						});
				} else {
					async.nextTick(() => {
						_next(null);
					});
				}
			}
		], next);
	}

	static renameFile(oldname, newname, next) {
		fs.rename(
			path.join(this.cwd, oldname),
			path.join(this.cwd, newname),
			next);
	}

	static deleteFile(filename, next) {
		fs.unlink(
			path.join(this.cwd, filename),
			next);
	}

	static readBinary(filename, next) {
		async.waterfall([
			(_next) => {
				fs.readFile(path.join(this.cwd, filename), _next);
			},
			(buf, _next) => {
				const base64data = buf.toString("base64");
				const _mime = mime.lookup(filename);
				_next(null, base64data, _mime);
			}
		], next);
	}
}

WorkingUtil.cwd = null;  // to be set in app.js

module.exports = WorkingUtil;
