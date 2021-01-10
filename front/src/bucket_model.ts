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

// Mongoose Bucket: stores metadata about a bucket or project.

import Mongoose = require("mongoose");
// const got = require("got");
// import { Got } from "got";
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

bucketSchema.index({
	bucket_id: 1
});

// Workaround to make TypeScript apply signatures to the method definitions
interface IBucketMethods {
	checkAccessPermissions(user: IUser|null): boolean;
	isOwnedBy(user: IUser|null): boolean;
	touchLastActivity(next: (err: Err) => void): void;
	removeRepo(next: (err: Err) => void): void;
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

	checkAccessPermissions(this: IBucket, user: IUser|null): boolean {
		if (this.butype === "editable" && (!user || !user._id.equals(this.user_id))) {
			return false;
		}
		return true;
	}

	isOwnedBy(this: IBucket, user: IUser|null): boolean {
		if (!user || !user._id.equals(this.user_id)) {
			return false;
		}
		return true;
	}

	touchLastActivity(this: IBucket, next: (err: Err) => void): void {
		this.logf().trace("Touching last activity", this.consoleText);
		this.last_activity = new Date();
		this.save(next);
	}

	removeRepo(this: IBucket, next: (err: Err) => void): void {
		// See comment in socket_connect.ts
		next(new Error("Unimplemented"));
		/*
		(got as Got)("http://" + config.git.hostname + ":" + config.git.createRepoPort, {
			searchParams: {
				type: "buckets",
				name: this.bucket_id,
				action: "delete",
			},
			retry: 0,
		}).then((response) => {
			if (response.statusCode === 200) {
				next(null);
				return;
			}
			next(new Error(response.body));
		}).catch(next);
		*/
	}

	logf(this: IBucket): ILogger {
		return logger("bucket:" + this.id.valueOf());
	}
}

// Copy the methods into bucketSchema
bucketSchema.methods.isValidAction = BucketMethods.prototype.isValidAction;
bucketSchema.methods.checkAccessPermissions = BucketMethods.prototype.checkAccessPermissions;
bucketSchema.methods.isOwnedBy = BucketMethods.prototype.isOwnedBy;
bucketSchema.methods.touchLastActivity = BucketMethods.prototype.touchLastActivity;
bucketSchema.methods.removeRepo = BucketMethods.prototype.removeRepo;
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

Bucket.on("index", err => {
	if (err) logger("bucket-index").error(err);
	else logger("bucket-index").info("Init Success");
});
