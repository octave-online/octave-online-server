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

import Async = require("async");
import Bcrypt = require("bcrypt");
import Crypto = require("crypto");
import Mongoose = require("mongoose");

import * as Utils from "./utils";
import { config, logger, ILogger } from "./shared_wrap";
import { Program, IProgram } from "./program_model";

type Err = Error | null;
type UserModel = Mongoose.Model<IUser, {}, IUserMethods>;
export type HydratedUser = Mongoose.HydratedDocument<IUser>;

// Initialize the schema
const userSchema = new Mongoose.Schema<IUser, UserModel, IUserMethods>({
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
	flavors_enabled: Boolean,
	patreon: {
		user_id: String,
		currently_entitled_amount_cents: Number,
		currently_entitled_tier: String,
		oauth2: Mongoose.Schema.Types.Mixed
	},
	last_activity: {
		type: Date,
		default: Date.now
	},
	program: String,
	instructor: [String],

	// Feature overrides
	tier_override: String,
	legal_time_override: Number,
	payload_limit_override: Number,
	countdown_extra_time_override: Number,
	countdown_request_time_override: Number,
	ads_disabled_override: Boolean,
});

userSchema.index({
	share_key: 1
});

interface IUserMethods {
	createShareKey(next?: (err: Err) => void): void;
	removeShareKey(next?: (err: Err) => void): void;
	setPassword(password: string, next?: (err: Err) => void): void;
	checkPassword(password: string): Promise<boolean>;
	touchLastActivity(next: (err: Err) => void): void;
	loadInstructorModels(next: (err: Err, user: IUser) => void): void;
	isFlavorOK(flavor: string, next: (err: Err, result: boolean) => void): void;
	logf(): ILogger;
}

export interface IUser {
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
	flavors_enabled: boolean;
	patreon?: {
		user_id: string;
		currently_entitled_amount_cents: number;
		currently_entitled_tier: string|null;
		oauth2: any;
		tier_name?: string; // virtual
	};
	last_activity: Date;
	program: string;
	instructor: string[];

	// Feature overrides
	tier_override?: string;
	legal_time_override?: number;
	payload_limit_override?: number;
	countdown_extra_time_override?: number;
	countdown_request_time_override?: number;
	ads_disabled_override?: boolean;

	// Virtuals
	displayName: string;
	consoleText: string;
	tier: string;
	programModel: IProgram | null | undefined;
	instructorModels: IProgram[] | undefined;

	// Cached sub-models
	_instructorModels?: IProgram[];
}

// Parametrization function used by Octave Online,
// c. January 2015 - ?
function v2Parametrize(id: Mongoose.Types.ObjectId, email: string) {
	// Represent a name such as "a.b@c.org" like "a_b_c_org".
	// Note that this method may have funny results with non-english
	// email addresses, if such a thing exists.
	// 
	// Adds a human-readable characteristic to the filename.
	// 
	const param_email = email
		.trim()
		.replace(/[-\s@.]+/g, "_") // replace certain chars with underscores
		.replace(/[^\w]/g, "") // remove all other non-ASCII characters
		.replace(/([A-Z]+)/g, "_$1") // add underscores before caps
		.replace(/_+/g, "_") // remove duplicate underscores
		.replace(/^_/, "") // remove leading underscore if it exists
		.toLowerCase(); // convert to lower case

	// Add an arbitrary, but deterministic, eight characters to the
	// begining of the filename.
	// 
	// Helps with indexing of filenames, and mostly prevents filename
	// collisions arising from similar email addresses.
	// 
	let param_md5 = Crypto
		.createHash("md5")
		.update(id.toString())
		.digest("base64")
		.replace(/[^a-zA-Z]/g, "")
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
userSchema.virtual("displayName").get(function() {
	if (this.profile && this.profile.displayName) return this.profile.displayName;
	if (this.openid && this.openid.profile && this.openid.profile.displayName)
		return this.openid.profile.displayName;
	if (this.email) return this.email;
	return "Signed In";
});

// Returns a string containing information about this user
// May 2018: Do not log email in consoleText
userSchema.virtual("consoleText").get(function() {
	const safeEmail = Utils.emailHash(this.email);
	const safeParameterized = this.parametrized && this.parametrized.substr(0, 8);
	return "[User " + this.id + "; " + safeEmail + "; param:" + safeParameterized + "_…]";
});

// Return the tier for this user, including resource-specific overrides.  These items usually fall back to the default unless a value is explicitly set in the database.  The camel-case name of these fields is for backwards compatibility.
const validTiers = Object.keys(config.tiers);
userSchema.virtual("tier").get(function() {
	// First try: tier_override
	let candidate: string|undefined = this.tier_override;
	if (candidate && validTiers.indexOf(candidate) !== -1) {
		return candidate;
	}

	// Second try: Patreon
	const patreonTier = this.patreon?.currently_entitled_tier;
	if (patreonTier) {
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		candidate = (config.patreon.tiers as any)[patreonTier].oo_tier;
		if (candidate && validTiers.indexOf(candidate) !== -1) {
			return candidate;
		}
	}

	// Third try: program
	candidate = this.programModel?.tier_override;
	if (candidate && validTiers.indexOf(candidate) !== -1) {
		return candidate;
	}

	// Default value:
	return validTiers[0];
});

// Returns the Patreon tier name for the user
userSchema.virtual("patreon.tier_name").get(function() {
	const patreonTier = this.patreon?.currently_entitled_tier;
	if (patreonTier) {
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		return (config.patreon.tiers as any)[patreonTier].name;
	}
});

// Virtuals to return results from sub-models
userSchema.virtual("programModel", {
	ref: "Program",
	localField: "program",
	foreignField: "program_name",
	justOne: true,
});
userSchema.virtual("instructorModels").get(function() {
	return this._instructorModels;
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
	{
		field: "adsDisabled",
		overrideKey: "ads_disabled_override",
		tierKey: "ads.disabled",
		defaultValue: config.ads.disabled
	}
].forEach(({field, overrideKey, tierKey, defaultValue})=>{
	userSchema.virtual(field).get(function() {
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		let candidate: any = (this as any)[overrideKey];
		if (candidate) {
			return candidate;
		}
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		candidate = (this.programModel as any|null)?.[overrideKey];
		if (candidate) {
			return candidate;
		}
		// <any> cast: https://stackoverflow.com/a/35209016/1407170
		candidate = (config.tiers as any)[this.tier]?.[tierKey];
		if (candidate) {
			return candidate;
		}
		return defaultValue;
	});
});

function randomAlphaString(length: number): string {
	let str = "";
	while (str.length < length) {
		str += Crypto
			.createHash("md5")
			.update(Math.random().toString())
			.digest("base64")
			.replace(/[^a-zA-Z]/g, "");
	}
	return str.substr(0, length);
}

// Auto-fill static fields once, upon creation (or update for old users)
userSchema.pre("save", function(next){
	if (!this.parametrized) {
		this.parametrized = v2Parametrize(this.id, this.email);
	}
	if (!this.repo_key) {
		this.repo_key = randomAlphaString(8);
	}

	next();
});

userSchema.method("createShareKey",
	// Instance methods for shared workspace keys
	function(next?: (err: Err) => void): void {
		this.share_key = randomAlphaString(48);
		this.logf().trace("Creating share key", this.consoleText, this.share_key);
		this.save(next);
	}
);

userSchema.method("removeShareKey",
	function(next?: (err: Err) => void): void {
		this.share_key = undefined;
		this.logf().trace("Removing share key", this.consoleText);
		this.save(next);
	}
);

userSchema.method("setPassword",
	// Instance methods for password hashes
	function(password: string, next?: (err: Err) => void): void {
		this.logf().trace("Setting password", this.consoleText);
		if (!password) {
			process.nextTick(() => {
				this.password_hash = "";
				this.save(next);
			});
		} else {
			// To create a new password manually, run:
			// $ node -e "require('bcrypt').hash('foo', 10, console.log)"
			Bcrypt.hash(password, config.auth.password.salt_rounds, (err, hash) => {
				this.password_hash = hash;
				this.save(next);
			});
		}
	}
);

userSchema.method("checkPassword",
	async function(password: string): Promise<boolean> {
		this.logf().trace("Checking password", this.consoleText);
		if (!this.password_hash || !password) {
			// Fail if no password is set on user
			return false;
		} else {
			return Bcrypt.compare(password, this.password_hash);
		}
	}
);

userSchema.method("touchLastActivity",
	// Other instance methods
	function(next: (err: Err) => void): void {
		this.logf().trace("Touching last activity", this.consoleText);
		this.last_activity = new Date();
		this.save(next);
	}
);

userSchema.method("loadInstructorModels",
	function(next: (err: Err, user: IUser) => void): void {
		Async.map<string, IProgram>(this.instructor, (program_name, __next) => {
			Program.findOne({ program_name }, (err, program) => {
				if (err) {
					return __next(err);
				}
				if (!program) {
					program = new Program();
					program.program_name = program_name;
				}
				program.populate("students").execPopulate()
					.then(() => { __next(null, program!) })
					.catch(__next);
			});
		}, (err, results) => {
			if (err) return next(err, this);
			this.logf().trace("Loaded instructor models:", results?.length);
			this._instructorModels = results!.map((v) => v!);
			next(null, this);
		});
	}
);

userSchema.method("isFlavorOK",
	function(flavor: string, next: (err: Err, result: boolean) => void): void {
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
	}
);

userSchema.method("logf",
	function(): ILogger {
		return logger("user:" + this.id.valueOf());
	}
);

// Make sure the fields are initialized
userSchema.post("init", function(){
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
	transform: function(doc: IUser, ret /* , options */) {
		delete ret.password_hash;
		delete ret.tier_override;
		if (ret.patreon) {
			delete ret.patreon.oauth2;
		}
		delete ret.legal_time_override;
		delete ret.payload_limit_override;
		delete ret.countdown_extra_time_override;
		delete ret.countdown_request_time_override;
		return ret;
	}
});

export const User = Mongoose.model<IUser, UserModel>("User", userSchema);

User.on("index", err => {
	if (err) logger("user-index").error(err);
	else logger("user-index").info("Init Success");
});
