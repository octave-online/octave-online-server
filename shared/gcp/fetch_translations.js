#!/usr/bin/env node

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

const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const execFile = util.promisify(require("child_process").execFile);

const gcp = require("./index");
const { config, logger } = require("@oo/shared");

const log = logger("fetch_translations");

module.exports = async function fetchTranslations(buildData) {
	const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "oo-translations-"));
	log.trace("Made tmpdir:", tmpdir);
	const targzPath = path.join(tmpdir, "i18next_locales.tar.gz");
	log.trace("Making request to Google Cloud Storage to download translations…");
	await gcp.downloadFile(log.log, config.gcp.artifacts_bucket, config.gcp.i18next_locales_tar_gz, targzPath);
	log.trace("Translations succesfully downloaded");
	const { stdout, stderr } = await execFile("tar", ["zxf", "i18next_locales.tar.gz"], { cwd: tmpdir });
	log.trace("Unpacked i18next_locales.tar.gz", stdout, stderr);
	const i18nextLocalesDir = path.join(tmpdir, "i18next_locales");

	buildData.locales_path = path.join(i18nextLocalesDir, "{{lng}}.json");
	buildData.locales = [];

	const re = new RegExp("^(\\w+)\\.json");
	const filenames = await fs.promises.readdir(i18nextLocalesDir);
	log.trace("filenames present in unpacked tar.gz:", filenames);
	for (let filename of filenames) {
		let match = re.exec(filename);
		if (match) {
			buildData.locales.push(match[1]);
		}
	}
};
