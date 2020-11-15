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

const express = require("express");
const { addAsync } = require("@awaitjs/express");

const db = require("../src/db");

const router = addAsync(express.Router());

router.get("/", function(req, res) {
	res.render("index", {
		title: "OO Admin Portal",
		top: true
	});
});

router.getAsync("/find/", async function(req, res) {
	const queryString = req.query.mq || "{}";
	let queryObject;
	try {
		queryObject = JSON.parse(queryString);
	} catch(e) {
		res.status(400).type("txt").send(`JSON parse error: ${e.message}\n\n${queryString}`);
		return;
	}
	const docs = await db.find(req.query.collection, queryObject);
	res.render("find", {
		title: "OO Find",
		docs,
		query: req.query
	});
});

router.postAsync("/create.do", async function(req, res) {
	const newDoc = JSON.parse(req.body.document);
	const result = await db.createDocument("users", newDoc);
	res.redirect(`users/${result.ops[0]._id}`);
});

module.exports = router;
