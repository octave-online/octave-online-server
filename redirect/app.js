/*
 * Copyright © 2021, Octave Online LLC
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

const express = require("express");
const asyncify = require("express-asyncify");
const path = require("path");
const logger = require("morgan");
const config = require("@oo/shared").config;
const db = require("./src/db");

const log = require("@oo/shared").logger("app");

const app = asyncify(express());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));

app.get("/", async (req, res) => {
	res.redirect(302, `//${config.front.hostname}:${config.front.port}/`);
});

app.get("/:shortlink", async (req, res) => {
	const shortlink = req.params.shortlink;
	const bucket = await db.findBucketWithShortlink(shortlink);
	if (!bucket) {
		res.status(404);
		res.render("error", { config, shortlink });
		return;
	}
	const token = (bucket.butype === "readonly") ? "bucket" : "project";
	log.info(`Redirecting ${shortlink} to ${bucket.bucket_id}`);
	res.redirect(302, `//${config.front.hostname}:${config.front.port}/${token}~${bucket.bucket_id}`);
});

module.exports = app;
