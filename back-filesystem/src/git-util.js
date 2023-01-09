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
const child_process = require("child_process");
const logger = require("@oo/shared").logger;
const config = require("@oo/shared").config;
const silent = require("@oo/shared").silent;

class GitUtil {
	constructor(gitDir, logMemo) {
		this._log = logger(`git-util:${logMemo}`);
		this._mlog = logger(`git-util:${logMemo}:minor`);
		this.execOptions = { cwd: gitDir };
		this.readonly = false;
		this._initialized = false;
		// TODO: Prevent multiple git operations from taking place simultaneously.
	}

	initialize(user, workDir, next) {
		if (this._initialized) {
			this._log.error("Initializing a repository for a user that was already initialized");
			return;
		}
		const remote = this._userToRemote(user);
		async.series([
			(_next) => {
				this._createUserOnRemote(user, _next);
			},
			(_next) => {
				this._initialize(remote, workDir, _next);
			}
		], next);
	}

	initializeBucket(bucketId, workDir, readonly, next) {
		if (this._initialized) {
			this._log.error("Initializing a repository for a bucket that was already initialized");
			return;
		}
		this.readonly = readonly;
		const remote = this._bucketToRemote(bucketId);
		async.series([
			(_next) => {
				if (!readonly) {
					this._createBucketOnRemote(bucketId, _next);
				} else {
					_next(null);
				}
			},
			(_next) => {
				this._initialize(remote, workDir, _next);
			}
		], next);
	}

	_initialize(remote, workDir, next) {
		async.series([
			(_next) => {
				this._mlog.trace("Running git init...");
				child_process.execFile("git", ["--git-dir=.", `--work-tree=${workDir}`, "init"], this.execOptions, _next);
			},
			(_next) => {
				// May 2018: Do not log email-based Git URL
				const idx = remote.indexOf("_");
				const safeOrigin = (idx === -1) ? remote : remote.substr(0, idx) + "_…";
				this._mlog.info("Setting origin:", safeOrigin);
				child_process.execFile("git", ["remote", "add", "origin", remote], this.execOptions, _next);
			},
			(_next) => {
				this._pull(_next);
			},
			(_next) => {
				this._initialized = true;
				_next(null);
			}
		], next);
	}

	pullPush(message, next) {
		if (!this._initialized) {
			// Trying to sync the repo before it has been initialized; do not attempt to push, because no local changes are possible.
			return next(null);
		}
		if (this.readonly) {
			return this._pull(next);
		} else {
			return this._pullPush(message, next);
		}
	}

	_pullPush(message, next) {
		async.series([
			(_next) => {
				this._mlog.debug("Preparing to pull-push...");
				_next();
			},
			(_next) => {
				this._commit(message, _next);
			},
			(_next) => {
				// Perform a shallow clone to avoid wasting time and resources downloading old refs from the server
				// This command can fail silently for the case when the remote repo is empty
				child_process.execFile("git", ["fetch", "--depth=1"], this.execOptions, silent(/no matching remote head/, _next));
			},
			(_next) => {
				// Resolve merge conflicts by committing all the conflicts into the repository, and let the user manually fix the conflict next time the log in.
				// This command can fail silently for the case when origin/master does not exist
				const mergeArgs = config.git.supportsAllowUnrelatedHistories ? ["merge", "--no-commit", "--allow-unrelated-histories", "origin/master"] : ["merge", "--no-commit", "origin/master"];
				child_process.execFile("git", this._gitConfigArgs().concat(mergeArgs), this.execOptions, silent(/fix conflicts|not something we can merge/, _next).stdout);
			},
			(_next) => {
				this._commit("Scripted merge", _next);
			},
			(_next) => {
				// Push the changes up
				// This command can fail silently for the case when the local branch "master" is empty
				child_process.execFile("git", ["push", "origin", "master"], this.execOptions, silent(/src refspec master does not match any/, _next));
			},
			(_next) => {
				this._mlog.debug("Finished pull-push");
				_next(null);
			}
		], next);
	}

	_pull(next) {
		async.series([
			(_next) => {
				this._mlog.debug("Preparing to pull...");
				_next();
			},
			(_next) => {
				// Perform a shallow clone to avoid wasting time and resources downloading old refs from the server
				// This command can fail silently for the case when the remote repo is empty
				child_process.execFile("git", ["fetch", "--depth=1"], this.execOptions, silent(/no matching remote head/, _next));
			},
			(_next) => {
				child_process.execFile("git", this._gitConfigArgs().concat(["merge", "origin/master"]), this.execOptions, silent(/not something we can merge/, _next));
			},
			(_next) => {
				this._mlog.debug("Finished pull");
				_next();
			}
		], next);
	}

	_commit(message, next) {
		async.series([
			(_next) => {
				child_process.execFile("git", ["add", "--all"], this.execOptions, _next);
			},
			// Remove the following check since the new "capped file system" should take care of this for us
			// (_next) => {
			// 	// Do not commit files greater than 1MB in size
			// 	child_process.exec("find . -size +1M -type f -exec git reset {} \\;", this.execOptions, _next);
			// },
			(_next) => {
				// This command can safely fail silently for the case when there are no files to commit (in that case, the error is empty)
				// Note that specifying --author here does not seem to work; I have to do -c ... instead
				child_process.execFile("git", this._gitConfigArgs().concat(["commit", "-m", message]), this.execOptions, silent(/nothing to commit/, _next).stdout);
			}
		], next);
	}

	_createUserOnRemote(user, next) {
		async.series([
			(_next) => {
				this._mlog.debug("Preparing remote repo...");
				_next();
			},
			(_next) => {
				fetch(`http://${config.git.hostname}:${config.git.createRepoPort}/?` + new URLSearchParams({
					type: "repos",
					name: user.parametrized
				})).then((response) => {
					if (!response.ok) {
						return _next(new Error("Not 2xx response", { cause: response }));
					}
					_next();
				}).catch(_next);
			}
		], next);
	}

	_createBucketOnRemote(bucketId, next) {
		async.series([
			(_next) => {
				this._mlog.debug("Preparing remote bucket...");
				_next();
			},
			(_next) => {
				fetch(`http://${config.git.hostname}:${config.git.createRepoPort}/?` + new URLSearchParams({
					type: "buckets",
					name: bucketId
				})).then((response) => {
					if (!response.ok) {
						return _next(new Error("Not 2xx response", { cause: response }));
					}
					_next();
				}).catch(_next);
			}
		], next);
	}

	_userToRemote(user) {
		return `git://${config.git.hostname}:${config.git.gitDaemonPort}/repos/${user.parametrized}.git`;
	}

	_bucketToRemote(bucketId) {
		return `git://${config.git.hostname}:${config.git.gitDaemonPort}/buckets/${bucketId}.git`;
	}

	_gitConfigArgs() {
		return ["-c", `user.name="${config.git.author.name}"`, "-c", `user.email="${config.git.author.email}"`];
	}
}

module.exports = GitUtil;
