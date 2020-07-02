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

const mongodb = require("mongodb");

let mongoClient = null;
let db = null;

async function connect(url, dbName) {
	mongoClient = new mongodb.MongoClient(url);
	await mongoClient.connect();
	db = mongoClient.db(dbName);
}

async function find(collectionName, query) {
	const collection = db.collection(collectionName);
	return await collection.find(query).limit(10).toArray();
}

async function findById(collectionName, id) {
	const collection = db.collection(collectionName);
	const result = await collection.findOne({
		_id: new mongodb.ObjectId(id)
	});
	if (!result) {
		throw new Error("Could not find user with id: " + id);
	}
	return result;
}

async function updateById(collectionName, id, update) {
	const collection = db.collection(collectionName);
	return await collection.updateOne({
		_id: new mongodb.ObjectId(id)
	}, update);
}

async function replaceById(collectionName, id, newDoc) {
	const collection = db.collection(collectionName);
	return await collection.replaceOne({
		_id: new mongodb.ObjectId(id)
	}, newDoc);
}

async function createDocument(collectionName, newDoc) {
	const collection = db.collection(collectionName);
	return await collection.insertOne(newDoc);
}

module.exports = {
	connect,
	find,
	findById,
	updateById,
	replaceById,
	createDocument
};
