/*
 * Copyright © 2020, Octave Online LLC
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

const crypto = require("crypto");
const util = require("util");

const bcryptjs = require("bcryptjs");
const express = require("express");
const { addAsync } = require("@awaitjs/express");

const config = require("@oo/shared").config;
const db = require("../src/db");

const router = addAsync(express.Router());

function randomString(length) {
	const base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
	const bytes = crypto.randomBytes(length);
	let str = "";
	for (var i = 0; i < length; i++) {
		str += base[bytes[i] % base.length];
	}
	return str;
}

router.getAsync("/", async function(req, res) {
	const queryString = req.query.mq || "{}";
	const queryObject = JSON.parse(queryString);
	const users = await db.find("users", queryObject);
	res.render("user-list", {
		title: "OO User Search",
		users,
		queryString
	});
});

router.getAsync("/:userId", async function(req, res) {
	const userId = req.params.userId || "";
	const user = await db.findById("users", userId);
	res.render("user", {
		title: `OO: ${user.email}`,
		user,
		randomString: randomString(12)
	});
});

router.postAsync("/:userId/add-code.do", async function(req, res) {
	const userId = req.params.userId || "";
	await db.updateById("users", userId, {
		$addToSet: {
			instructor: req.body.courseCode
		}
	});
	res.redirect(".");
});

router.postAsync("/:userId/set-password.do", async function(req, res) {
	const userId = req.params.userId || "";
	const rawPassword = req.body.string;
	const salt = await util.promisify(bcryptjs.genSalt)(config.auth.password.salt_rounds);
	const hash = await util.promisify(bcryptjs.hash)(rawPassword, salt);
	await db.updateById("users", userId, {
		$set: {
			password_hash: hash
		}
	});
	res.redirect(".");
});

router.postAsync("/:userId/overwrite.do", async function(req, res) {
	const userId = req.params.userId || "";
	const newDoc = JSON.parse(req.body.document);
	await db.replaceById("users", userId, newDoc);
	res.redirect(".");
});

module.exports = router;
