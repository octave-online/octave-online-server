"use strict";

const async = require("async");
const child_process = require("child_process");
const logger = require("@oo/shared").logger;
const path = require("path");
const config = require("@oo/shared").config;
const silent = require("@oo/shared").silent;

const GIT_SSH_FILE = path.join(__dirname, "..", "git", "git_ssh.sh");

class GitUtil {
	constructor(gitDir, logMemo) {
		this._log = logger(`git-util:${logMemo}`);
		this._mlog = logger(`git-util:${logMemo}:minor`);
		this.execOptions = { cwd: gitDir };
		this.readonly = false;
	}

	initialize(user, workDir, next) {
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
				this._mlog.info("Setting origin:", remote);
				child_process.execFile("git", ["remote", "add", "origin", remote], this.execOptions, _next);
			},
			(_next) => {
				this.pullPush("Scripted initialize repository", _next);
			}
		], next);
	}

	pullPush(message, next) {
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
				child_process.execFile("git", ["merge", "--no-commit", "origin/master"], this.execOptions, silent(/not something we can merge/, silent(/.*/, _next)));
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
				_next();
			}
		], next);
	}

	_pull(next) {
		async.series([
			(_next) => {
				this._mlog.debug("READONLY: Preparing to pull...");
				_next();
			},
			(_next) => {
				// Perform a shallow clone to avoid wasting time and resources downloading old refs from the server
				// This command can fail silently for the case when the remote repo is empty
				child_process.execFile("git", ["fetch", "--depth=1"], this.execOptions, silent(/no matching remote head/, _next));
			},
			(_next) => {
				child_process.execFile("git", ["merge", "origin/master"], this.execOptions, silent(/not something we can merge/, silent(/.*/, _next)));
			},
			(_next) => {
				this._mlog.debug("READONLY: Finished pull");
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
				child_process.execFile("git", ["-c", `user.name="${config.git.author.name}"`, "-c", `user.email="${config.git.author.email}"`, "commit", "-m", message], this.execOptions, silent(/.*/, _next));
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
				// This command can safely fail silently for the case when the remote repo already exists
				child_process.execFile(GIT_SSH_FILE, [`${config.git.helperUser}@${config.git.hostname}`, `./create_repo.sh '${user.parametrized}'`], this.execOptions, silent(/File exists/, _next));
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
				// In this case, the command failing is desirable behavior, right?
				child_process.execFile(GIT_SSH_FILE, [`${config.git.helperUser}@${config.git.hostname}`, `./create_bucket.sh '${bucketId}'`], this.execOptions, _next);
			}
		], next);
	}

	_userToRemote(user) {
		return `git@${config.git.hostname}:repos/${user.parametrized}.git`;
	}

	_bucketToRemote(bucketId) {
		return `git@${config.git.hostname}:buckets/${bucketId}.git`;
	}
}

module.exports = GitUtil;
