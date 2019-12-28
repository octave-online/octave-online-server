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

// Mongoose User: stores OpenID information for a user.

import Bcrypt = require("bcrypt");
import Crypto = require("crypto");
import Mongoose = require("mongoose");

import * as Utils from "./utils";
import { config, logger, ILogger } from "./shared_wrap";
import { Program, IProgram } from "./program_model";

type Err = Error | null;

// Initialize the schema
var userSchema = new Mongoose.Schema({
	email: String,
	parametrized: String,
	profile: Mongoose.Schema.Types.Mixed,
	openid: {
		identifier: String,
		profile: Mongoose.Schema.Types.Mixed
	},
	repo_key: String,
	share_key: String,
	password_hash: String,
	tier_override: String,
	legal_time_override: Number,
	payload_limit_override: Number,
	countdown_extra_time_override: Number,
	countdown_request_time_override: Number,
	flavors_enabled: Boolean,
	last_activity: {
		type: Date,
		default: Date.now
	},
	program: String,
	instructor: [String]
});

// Workaround to make TypeScript apply signatures to the method definitions
interface IUserMethods {
	createShareKey(next?: (err: Err) => void): void;
	removeShareKey(next?: (err: Err) => void): void;
	setPassword(password: string, next?: (err: Err) => void): void;
	checkPassword(password: string, next: (err: Err, success: boolean) => void): void;
	touchLastActivity(next: (err: Err) => void): void;
	loadDependencies(next: (err: Err, user?: IUser) => void): void;
	isFlavorOK(flavor: string, next: (err: Err, result: boolean) => void): void;
	logf(): ILogger;
};

export interface IUser extends Mongoose.Document, IUserMethods {
	_id: Mongoose.Types.ObjectId;
	email: string;
	parametrized: string;
	profile: any;
	openid: {
		identifier: string;
		profile: any;
	};
	repo_key: string;
	share_key?: string;
	password_hash: string;
	tier_override: string;
	legal_time_override: number;
	payload_limit_override: number;
	countdown_extra_time_override: number;
	countdown_request_time_override: number;
	flavors_enabled: boolean;
	last_activity: Date;
	program: string;
	instructor: string[];

	// Virtuals
	displayName: string;
	consoleText: string;
	tier: string;

	// Extra internal slots
	_program: IProgram | null;
};

// Parametrization function used by Octave Online,
// c. January 2015 - ?
function v2Parametrize(id: Mongoose.Types.ObjectId, email: string) {
	// Represent a name such as "a.b@c.org" like "a_b_c_org".
	// Note that this method may have funny results with non-english
	// email addresses, if such a thing exists.
	// 
	// Adds a human-readable characteristic to the filename.
	// 
	var param_email = email
		.trim()
		.replace(/[-\s@\.]+/g, '_') // replace certain chars with underscores
		.replace(/[^\w]/g, '') // remove all other non-ASCII characters
		.replace(/([A-Z]+)/g, '_$1') // add underscores before caps
		.replace(/_+/g, '_') // remove duplicate underscores
		.replace(/^_/, '') // remove leading underscore if it exists
		.toLowerCase(); // convert to lower case

	// Add an arbitrary, but deterministic, eight characters to the
	// begining of the filename.
	// 
	// Helps with indexing of filenames, and mostly prevents filename
	// collisions arising from similar email addresses.
	// 
	var param_md5 = Crypto
		.createHash("md5")
		.update(id.toHexString())
		.digest("base64")
		.replace(/[^a-zA-Z]/g, '')
		.toLowerCase();

	// In the rare case when this returns a string less than eight,
	// characters, add arbitrary characters to the end.
	// 
	param_md5 = (param_md5+"00000000").substr(0, 8);

	// Concatenate it together.
	// 
	return param_md5 + "_" + param_email;
}

// Returns the user's display name
userSchema.virtual("displayName").get(function(this: IUser) {
	if (this.profile && this.profile.displayName) return this.profile.displayName;
	if (this.openid && this.openid.profile && this.openid.profile.displayName)
		return this.openid.profile.displayName;
	if (this.email) return this.email;
	return "Signed In";
});

// Returns a string containing information about this user
// May 2018: Do not log email in consoleText
userSchema.virtual("consoleText").get(function(this: IUser) {
	const safeEmail = Utils.emailHash(this.email);
	const safeParameterized = this.parametrized && this.parametrized.substr(0, 8);
	return "[User " + this.id + "; " + safeEmail + "; param:" + safeParameterized + "_…]";
});

// Return the tier for this user, including resource-specific overrides.  These items usually fall back to the default unless a value is explicitly set in the database.  The camel-case name of these fields is for backwards compatibility.
const validTiers = Object.keys(config.tiers);
userSchema.virtual("tier").get(function(this: IUser) {
	let candidate: string|undefined = this.tier_override;
	if (candidate && validTiers.indexOf(candidate) !== -1) {
		return candidate;
	}
	candidate = this._program?.tier_override;
	if (candidate && validTiers.indexOf(candidate) !== -1) {
		return candidate;
	}
	// Default value:
	return validTiers[0];
});

// Add all of the resource-specific overrides to work in the same way.
[
	{
		field: "legalTime",
		overrideKey: "legal_time_override",
		tierKey: "session.legalTime.user",
		defaultValue: config.session.legalTime.user
	},
	{
		field: "payloadLimit",
		overrideKey: "payload_limit_override",
		tierKey: "session.payloadLimit.user",
		defaultValue: config.session.payloadLimit.user
	},
	{
		field: "countdownExtraTime",
		overrideKey: "countdown_extra_time_override",
		tierKey: "session.countdownExtraTime",
		defaultValue: config.session.countdownExtraTime
	},
	{
		field: "countdownRequestTime",
		overrideKey: "countdown_request_time_override",
		tierKey: "session.countdownRequestTime",
		defaultValue: config.session.countdownRequestTime
	},
].forEach(({field, overrideKey, tierKey, defaultValue})=>{
	userSchema.virtual(field).get(function(this: IUser) {
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		let candidate: any = (<any>this)[overrideKey];
		if (candidate) {
			return candidate;
		}
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		candidate = (<any|null>this._program)?.[overrideKey];
		if (candidate) {
			return candidate;
		}
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		candidate = (<any>config.tiers)[this.tier]?.[tierKey];
		if (candidate) {
			return candidate;
		}
		return defaultValue;
	});
});

function randomAlphaString(length: number): string {
	var str = "";
	while (str.length < length) {
		str += Crypto
			.createHash("md5")
			.update(Math.random().toString())
			.digest("base64")
			.replace(/[^a-zA-Z]/g, '');
	}
	return str.substr(0, length);
}

// Auto-fill static fields once, upon creation (or update for old users)
userSchema.pre("save", function(this: IUser, next){
	if (!this.parametrized) {
		this.parametrized = v2Parametrize(this.id, this.email);
	}
	if (!this.repo_key) {
		this.repo_key = randomAlphaString(8);
	}

	next();
});

// Define the methods in a class to help TypeScript
class UserMethods implements IUserMethods {

	// Instance methods for shared workspace keys
	createShareKey(this: IUser, next?: (err: Err) => void): void {
		this.share_key = randomAlphaString(48);
		this.logf().trace("Creating share key", this.consoleText, this.share_key);
		this.save(next);
	};

	removeShareKey(this: IUser, next?: (err: Err) => void): void {
		this.share_key = undefined;
		this.logf().trace("Removing share key", this.consoleText);
		this.save(next);
	};

	// Instance methods for password hashes
	setPassword(this: IUser, password: string, next?: (err: Err) => void): void {
		var self = this;
		this.logf().trace("Setting password", this.consoleText);
		if (!password) {
			process.nextTick(function() {
				self.password_hash = "";
				self.save(next);
			});
		} else {
			// To create a new password manually, run:
			// $ node -e "require('bcrypt').hash('foo', 10, console.log)"
			Bcrypt.hash(password, config.auth.password.salt_rounds, function(err, hash) {
				self.password_hash = hash;
				self.save(next);
			});
		}
	};

	checkPassword(this: IUser, password: string, next: (err: Err, success: boolean) => void): void {
		this.logf().trace("Checking password", this.consoleText);
		if (!this.password_hash || !password) {
			// Fail if no password is set on user
			process.nextTick(function() {
				next(null, false);
			});
		} else {
			Bcrypt.compare(password, this.password_hash, next);
		}
	};

	// Other instance methods
	touchLastActivity(this: IUser, next: (err: Err) => void): void {
		this.logf().trace("Touching last activity", this.consoleText);
		this.last_activity = new Date();
		this.save(next);
	};

	loadDependencies(this: IUser, next: (err: Err, user?: IUser) => void): void {
		if (!this.program) {
			next(null, this);
		}
		Program.findOne({
			program_name: this.program
		}, (err, _program) => {
			if (err) return next(err);
			this._program = _program;
			next(null, this);
		});
	};

	isFlavorOK(this: IUser, flavor:string, next: (err: Err, result: boolean) => void): void {
		// Note: This function must at least validate that the flavor is valid; to this point, the flavor is unsanitized user input.
		const availableFlavors = Object.keys(config.flavors);
		if (availableFlavors.indexOf(flavor) !== -1) {
			// TODO: Implement this when more interesting logic is available.
			// next(null, !!this.flavors_enabled);
			next(null, true);
		} else if (flavor) {
			this.logf().trace("WARNING: User requested illegal flavor", flavor);
			next(null, false);
		} else {
			next(null, false);
		}
	};

	logf(this: IUser): ILogger {
		return logger("user:" + this.id.toHexString());
	};
};

// Copy the methods into userSchema
userSchema.methods.createShareKey = UserMethods.prototype.createShareKey;
userSchema.methods.removeShareKey = UserMethods.prototype.removeShareKey;
userSchema.methods.setPassword = UserMethods.prototype.setPassword;
userSchema.methods.checkPassword = UserMethods.prototype.checkPassword;
userSchema.methods.touchLastActivity = UserMethods.prototype.touchLastActivity;
userSchema.methods.loadDependencies = UserMethods.prototype.loadDependencies;
userSchema.methods.isFlavorOK = UserMethods.prototype.isFlavorOK;
userSchema.methods.logf = UserMethods.prototype.logf;


// Make sure the fields are initialized
userSchema.post("init", function(this: IUser, doc){
	if (this.program && this.program !== "default" && !this.share_key) {
		this.createShareKey();
	}
});

// JSON representation: include the virtuals (this object will be transmitted
// to the actual Octave server)
// Leave out the password_hash field to avoid leaking it to the front end.
// Also leave out the *_override fields since the information in those fields is available via the corresponding camel-case virtuals.
userSchema.set("toJSON", {
	virtuals: true,
	transform: function(doc, ret, options) {
		delete ret.password_hash;
		delete ret.tier_override;
		delete ret.legal_time_override;
		delete ret.payload_limit_override;
		delete ret.countdown_extra_time_override;
		delete ret.countdown_request_time_override;
		return ret;
	}
});

export var User = Mongoose.model<IUser>("User", userSchema);
