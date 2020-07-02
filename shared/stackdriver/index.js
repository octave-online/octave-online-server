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

const util = require("util");

const { ErrorReporting } = require("@google-cloud/error-reporting");
const { Logging } = require("@google-cloud/logging");

const errors = new ErrorReporting();

// TODO: Allow each project to customize this?
let gcpLog = new Logging().log("oo-projects");

function reportError(label, message) {
	const errorEvent = errors.event()
		.setMessage(message)
		.setUser(label);
	errors.report(errorEvent);
}

function writeLog(level, label, args) {
	if (label.indexOf(":minor") !== -1) {
		return;
	}

	const message = util.format(...args);
	const data = { label, message, objects: args };
	const entry = gcpLog.entry(data);
	gcpLog[level](entry);

	if (level === "error") {
		reportError(label, label + " " + message);
	}
}

module.exports = {
	reportError,
	writeLog
};
