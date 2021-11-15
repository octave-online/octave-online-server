/*
 * Copyright © 2019, Octave Online LLC
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

const child_process = require("child_process");
const fsPromises = require("fs").promises;
const jszip = require("jszip");
const os = require("os");
const path = require("path");
const util = require("util");

const execFilePromise = util.promisify(child_process.execFile);

const config = require("./config");
const log = require("./logger")("gitarchive");

async function repoContainsRefs(tld, name) {
	const remote = `git://${config.git.hostname}:${config.git.gitDaemonPort}/${tld}/${name}.git`;

	let stdoutLen = 0;
	const p = child_process.spawn("git", ["ls-remote", remote, "master"]);
	p.stdout.on("data", (data) => {
		stdoutLen += data.length;
	});
	p.stderr.on("data", (data) => {
		log.log(data);
	});

	return new Promise(function(resolve, reject) {
		p.on("close", (code) => {
			if (code) {
				log.trace("Git exited with code " + code);
				resolve(false);
			} else {
				log.trace("Number of bytes from stdout:", stdoutLen);
				resolve(!!stdoutLen);
			}
		});
		p.on("error", reject);
	});
}

async function createRepoSnapshot(tld, name, outStream) {
	const remote = `git://${config.git.hostname}:${config.git.gitDaemonPort}/${tld}/${name}.git`;
	log.info(`Archiving ${remote}`);

	const p = child_process.spawn("git", ["archive", "--format=zip", "--remote="+remote, "master"]);
	p.stdout.pipe(outStream);
	p.stderr.on("data", (data) => {
		log.log(data);
	});

	return new Promise(function(resolve, reject) {
		p.on("close", (code) => {
			if (code) {
				log.error("Git exited with code " + code);
			}
			resolve();
		});
		p.on("error", reject);
	});
}

async function restoreRepoFromZipFile(log, tld, name, branchName, zipFileBlob) {
	const remote = `git://${config.git.hostname}:${config.git.gitDaemonPort}/${tld}/${name}.git`;
	const zip = await jszip.loadAsync(zipFileBlob, { createFolders: true });
	const tmpdir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "oo-reporestore-"));
	const gitdir = path.join(tmpdir, "work");
	log("tmpdir:", tmpdir);
	try {
		log("A-clone",
			await execFilePromise("git", ["clone", remote, "work"],
				{ cwd: tmpdir }));
		log("A-commit-0",
			await execFilePromise("git", ["-c", "user.email='webmaster@octave-online.net'", "-c", "user.name='Octave Online'", "commit", "--allow-empty", "-m", "Prep for restoration"],
				{ cwd: gitdir }));
		log("A-co-orphan",
			await execFilePromise("git", ["checkout", "--no-guess", "--orphan", branchName],
				{ cwd: gitdir }));
		log("A-git-rm", await new Promise((resolve, reject) => {
			child_process.execFile("git", ["rm", "-rf", "."],
				{ cwd: gitdir },
				function(err, stdout, stderr) {
					// Errors are expected here if the repo is empty
					resolve({ stdout, stderr });
				});
		}));
		for (let [relativePath, file] of Object.entries(zip.files)) {
			const fullPath = path.join(gitdir, relativePath);
			if (file.dir) {
				log("Creating directory:", relativePath);
				await fsPromises.mkdir(fullPath);
			} else {
				log("Writing file:", relativePath);
				const fileData = await zip.file(relativePath).async("nodebuffer");
				// TODO: Should we restore "date", "unixPermissions", ... ?
				await fsPromises.writeFile(fullPath, fileData);
			}
		}
		log("A-add-1",
			await execFilePromise("git", ["add", "-A"],
				{ cwd: gitdir }));
		log("A-commit-1",
			await execFilePromise("git", ["-c", "user.email='webmaster@octave-online.net'", "-c", "user.name='Octave Online'", "commit", "-m", "Snapshot: " + branchName],
				{ cwd: gitdir }));
		log("A-checkout-master",
			await execFilePromise("git", ["checkout", "master"],
				{ cwd: gitdir }));
		const mergeOutput = await new Promise((resolve, reject) => {
			child_process.execFile("git", ["merge", "--allow-unrelated-histories", "--squash", "--no-commit", branchName],
				{ cwd: gitdir },
				function(err, stdout, stderr) {
					// Errors are expected here if there was a merge conflict; ignore them gracefully.
					resolve({ stdout, stderr });
				});
		});
		log("A-merge", mergeOutput);
		log("A-add-2",
			await execFilePromise("git", ["add", "-A"],
				{ cwd: gitdir }));
		log("A-commit-2",
			await execFilePromise("git", ["-c", "user.email='webmaster@octave-online.net'", "-c", "user.name='Octave Online'", "commit", "-m", "Restoring: " + branchName + "\n\nGit Merge Output:\n-----\n" + mergeOutput.stdout],
				{ cwd: gitdir }));
		log("A-push",
			await execFilePromise("git", ["push", "origin", "master"],
				{ cwd: gitdir }));
	} catch (e) {
		throw e;
	} finally {
		log("C1", await execFilePromise("rm", ["-rf", tmpdir]));
	}
}

function generateFilename(name) {
	return `oo_${new Date().toISOString()}_${name}.zip`;
}

module.exports = {
	repoContainsRefs,
	createRepoSnapshot,
	generateFilename,
	restoreRepoFromZipFile,
};
