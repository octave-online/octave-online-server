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
const repo = require("../src/repo");

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
	let queryObject;
	try {
		queryObject = JSON.parse(queryString);
	} catch(e) {
		res.status(400).type("txt").send(`JSON parse error: ${e.message}\n\n${queryString}`);
		return;
	}
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
	const buckets = await db.find("buckets", {
		"user_id": user._id,
	});
	res.render("user", {
		title: `OO: ${user.email || `Deleted User ${user.deleted_email}`}`,
		user,
		buckets,
		randomString: randomString(12),
		config
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
	let newDoc;
	try {
		newDoc = JSON.parse(req.body.document);
	} catch(e) {
		res.status(400).type("txt").send(`JSON parse error: ${e.message}\n\n${req.body.document}`);
		return;
	}
	await db.replaceById("users", userId, newDoc);
	res.redirect(".");
});

router.postAsync("/:userId/delete-data.do", async function(req, res) {
	const userId = req.params.userId || "";
	const user = await db.findById("users", userId);
	if (req.body.deleteRepo) {
		await repo.deleteRepo(user);
	}
	if (req.body.deleteMongo) {
		const newDoc = {
			deleted_email: user.email,
			parametrized: user.parametrized,
		};
		await db.replaceById("users", userId, newDoc);
	}
	res.redirect(".");
});

module.exports = router;
