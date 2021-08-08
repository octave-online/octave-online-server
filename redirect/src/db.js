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

const mongodb = require("mongodb");

let mongoClient = null;
let db = null;

async function connect(url, dbName) {
	mongoClient = new mongodb.MongoClient(url);
	await mongoClient.connect();
	db = mongoClient.db(dbName);
}

async function close() {
	mongoClient.close();
}

async function findBucketWithShortlink(shortlink) {
	const collection = db.collection("buckets");
	const result = await collection.findOne({
		shortlink: shortlink
	});
	return result;
}

module.exports = {
	connect,
	close,
	findBucketWithShortlink,
};
