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

import Fs = require("fs");
import Path = require("path");

import { config, logger } from "./shared_wrap";
import * as Mongo from "./mongo";
import * as Passport from "./passport_setup";
import * as Middleware from "./session_middleware";
import * as ExpressApp from "./express_setup";
import * as SocketIoApp from "./socketio";

const log = logger("app");

async function main() {
	let buildData: ExpressApp.BuildData = {};
	try {
		buildData = require(Path.join(__dirname, "..", "..", config.front.static_path, "build_data.json"));
		log.trace("Loaded buildData:", buildData);
	} catch(err: any) {
		log.warn("Failed to load buildData; will serve development resources:", err?.message);
	}

	try {
		const setupFn = require("../../entrypoint/front_setup");
		await setupFn(buildData);
		log.trace("Successfully ran front_setup. New buildData:", buildData);
	} catch (err: any) {
		if (/Cannot find module/.test(err?.message)) {
			log.warn("Tip: create entrypoint/front_setup.js to run code at startup:", err?.message);
		} else {
			log.error("front_setup error:", err);
		}
	}
	if (!buildData.locales_path) {
		buildData.locales_path = Path.join(__dirname, "..", "..", config.front.locales_path);
	}
	if (!buildData.locales) {
		buildData.locales = config.front.locales;
	}

	buildData.privacy_html = await Fs.promises.readFile(Path.join(__dirname, "..", "..", config.front.static_path, "privacy.txt"), { encoding: "utf-8" });

	try {
		log.trace("Connecting to Mongo...");
		await Mongo.connect();
		log.info("Connected to Mongo");
	} catch(err) {
		log.warn("Could not connect to Mongo:", err);
	}

	Passport.init();
	Middleware.init();
	ExpressApp.init(buildData);
	SocketIoApp.init();
}

main().catch((err) => {
	log.error(err);
});
