///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

// Mongoose Bucket: stores metadata about a bucket.

import Mongoose = require("mongoose");
import Config = require("./config");

// Patch for https://github.com/Automattic/mongoose/issues/4951
Mongoose.Promise = <any> global.Promise

// Initialize the schema
var bucketSchema = new Mongoose.Schema({
	bucket_id: String,
	user_id: Mongoose.Schema.Types.ObjectId,
	main: String
});

bucketSchema.virtual("createdTime").get(function () {
	return this._id.getTimestamp();
});

bucketSchema.set("toJSON", {
	virtuals: true
});

// See comment in user_model.ts about the casting.
var Bucket = <Mongoose.Model<IBucket>> (<any> Mongoose.model("Bucket", bucketSchema));
export = Bucket;
