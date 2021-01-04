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
import { IUser } from "./user_model";
import { logger, ILogger } from "./shared_wrap";

type Err = Error | null;

// Initialize the schema
const bucketSchema = new Mongoose.Schema({
	/// bucket_id is the public ID for the bucket. Generated in octave-session.js
	bucket_id: String,

	/// user_id is the owner of the bucket.
	user_id: Mongoose.Schema.Types.ObjectId,

	/// main is the entrypoint script for the bucket, if the bucket has one.
	main: String,

	/// butype is the bucket type:
	/// - "readonly" = public, read-only (bucket~)
	/// - "editable" = private, read-write (project~)
	/// - "collab" = public, read-write, shared workspace (project~)
	butype: {
		type: String,
		enum: ["readonly", "editable", "collab"],
		default: "readonly",
	},

	// TODO
	/// base_id is the bucket from which this bucket was cloned, if applicable
	// base_id: Mongoose.Schema.Types.ObjectId,

	last_activity: {
		type: Date,
		default: Date.now
	},
});

// Workaround to make TypeScript apply signatures to the method definitions
interface IBucketMethods {
	checkPermissions(user: IUser|null): boolean;
	touchLastActivity(next: (err: Err) => void): void;
	isValidAction(this: IBucket, action: string): boolean;
	logf(): ILogger;
}

export interface IBucket extends Mongoose.Document, IBucketMethods {
	_id: Mongoose.Types.ObjectId;
	bucket_id: string;
	user_id: Mongoose.Types.ObjectId;
	main?: string;
	butype: string;
	base_id?: Mongoose.Types.ObjectId;
	last_activity: Date;

	// Virtuals
	createdTime: Date;
	consoleText: string;
}

// Define the methods in a class to help TypeScript
class BucketMethods implements IBucketMethods {
	isValidAction(this: IBucket, action: string): boolean {
		if (action === "bucket") {
			return this.butype === "readonly";
		} else if (action === "project") {
			return this.butype === "editable" || this.butype === "collab";
		} else {
			return false;
		}
	}

	checkPermissions(this: IBucket, user: IUser|null): boolean {
		if (this.butype === "editable" && (!user || !user._id.equals(this.user_id))) {
			return false;
		}
		return true;
	}

	touchLastActivity(this: IBucket, next: (err: Err) => void): void {
		this.logf().trace("Touching last activity", this.consoleText);
		this.last_activity = new Date();
		this.save(next);
	}

	logf(this: IBucket): ILogger {
		return logger("bucket:" + this.id.valueOf());
	}
}

// Copy the methods into bucketSchema
bucketSchema.methods.isValidAction = BucketMethods.prototype.isValidAction;
bucketSchema.methods.checkPermissions = BucketMethods.prototype.checkPermissions;
bucketSchema.methods.touchLastActivity = BucketMethods.prototype.touchLastActivity;
bucketSchema.methods.logf = BucketMethods.prototype.logf;

bucketSchema.virtual("createdTime").get(function (this: IBucket) {
	return this._id.getTimestamp();
});

bucketSchema.virtual("consoleText").get(function(this: IBucket) {
	return "[Bucket " + this.bucket_id + "; " + this.butype + "]";
});

bucketSchema.set("toJSON", {
	virtuals: true
});

export const Bucket = Mongoose.model<IBucket>("Bucket", bucketSchema);
