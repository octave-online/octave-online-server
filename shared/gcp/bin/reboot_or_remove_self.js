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

const child_process = require("child_process");
const util = require("util");

const gcp = require("../index");

const execFile = util.promisify(child_process.execFile);

async function reboot() {
	return execFile("sudo", ["/usr/sbin/reboot"], { stdio: "inherit" });
};

async function main() {
	const { recommendedSize, targetSize } = await gcp.getAutoscalerInfo();
	if (targetSize > recommendedSize) {
		console.log("Removing self from group");
		return await gcp.removeSelfFromGroup();
	} else {
		console.log("Requesting reboot");
		return await reboot();
	}
}

main().then(console.log).catch(console.error);
