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

// Mongoose Bucket: stores metadata about a bucket.

import Mongoose = require("mongoose");

// Initialize the schema
var bucketSchema = new Mongoose.Schema({
	bucket_id: String,
	user_id: Mongoose.Schema.Types.ObjectId,
	main: String
});

export interface IBucket extends Mongoose.Document {
	_id: Mongoose.Types.ObjectId;
	bucket_id: string;
	user_id: Mongoose.Types.ObjectId;
	main: string;

	createdTime: Date;
};

bucketSchema.virtual("createdTime").get(function (this: IBucket) {
	return this._id.getTimestamp();
});

bucketSchema.set("toJSON", {
	virtuals: true
});

export var Bucket = Mongoose.model<IBucket>("Bucket", bucketSchema);
