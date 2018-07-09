/*
 * Copyright © 2018, Octave Online LLC
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

///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='boris-typedefs/bcrypt/bcrypt.d.ts'/>
///<reference path='typedefs/iuser.ts'/>

// Mongoose User: stores OpenID information for a user.

import Mongoose = require("mongoose");
import Crypto = require("crypto");
import Bcrypt = require("bcrypt");
import Config = require("./config");
import Utils = require("./utils");

// Patch for https://github.com/Automattic/mongoose/issues/4951
Mongoose.Promise = <any> global.Promise

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
	legal_time_override: Number,
	payload_limit_override: Number,
	last_activity: {
		type: Date,
		default: Date.now
	},
	program: String,
	instructor: [String]
});

// Parametrization function used by Octave Online,
// c. January 2015 - ?
function v2Parametrize(id:Mongoose.Types.ObjectId, email:string) {
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
		.update(id)
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
userSchema.virtual("displayName").get(function () {
	if (this.profile && this.profile.name) return this.profile.name;
	if (this.openid && this.openid.profile && this.openid.profile.displayName)
		return this.openid.profile.displayName;
	if (this.email) return this.email;
	return "Signed In";
});

// Returns a string containing information about this user
// May 2018: Do not log email in consoleText
userSchema.virtual("consoleText").get(function () {
	const safeEmail = Utils.emailHash(this.email);
	const safeParameterized = this.parametrized && this.parametrized.substr(0, 8);
	return "[User " + this.id + "; " + safeEmail + "; param:" + safeParameterized + "_…]";
});

// Return the legalTime and payloadLimit for this user, which usually falls back to the default unless a value is explicitly set in the database.  The camel-case name of these fields is for backwards compatibility.
userSchema.virtual("legalTime").get(function () {
	if (this.legal_time_override) return this.legal_time_override;
	return Config.session.legalTime.user;
});
userSchema.virtual("payloadLimit").get(function () {
	if (this.payload_limit_override) return this.payload_limit_override;
	return Config.session.payloadLimit.user;
});

function randomAlphaString(length){
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
userSchema.pre("save", function(next){
	if (!this.parametrized) {
		this.parametrized = v2Parametrize(this.id, this.email);
	}
	if (!this.repo_key) {
		this.repo_key = randomAlphaString(8);
	}

	next();
});

// Instance methods for shared workspace keys
(<any>userSchema).methods.createShareKey = function(next){
	this.share_key = randomAlphaString(48);
	console.log("Creating share key for user", this.consoleText, this.share_key);
	this.save(next);
};
(<any>userSchema).methods.removeShareKey = function(next){
	this.share_key = null;
	console.log("Removing share key from user", this.consoleText);
	this.save(next);
};

// Instance methods for password hashes
(<any>userSchema).methods.setPassword = function(password, next){
	var self = this;
	console.log("Setting password for user", this.consoleText);
	if (!password) {
		process.nextTick(function() {
			self.password_hash = "";
			self.save(next);
		});
	} else {
		// To create a new password manually, run:
		// $ node -e "require('bcrypt').hash('foo', 10, console.log)"
		Bcrypt.hash(password, Config.password.salt_rounds, function(err, hash) {
			self.password_hash = hash;
			self.save(next);
		});
	}
};
(<any>userSchema).methods.checkPassword = function(password, next){
	console.log("Checking password for user", this.consoleText);
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
(<any>userSchema).methods.touchLastActivity = function(next){
	console.log("Touching last activity", this.consoleText);
	this.last_activity = new Date();
	this.save(next);
};

// Make sure the fields are initialized
userSchema.post("init", function(doc){
	if (this.program && this.program !== "default" && !this.share_key) {
		this.createShareKey();
	}
});

// JSON representation: include the virtuals (this object will be transmitted
// to the actual Octave server)
// Leave out the password_hash field to avoid leaking it to the front end.
// Also leave out the two *_override fields since the information in those fields is available via the corresponding camel-case virtuals.
userSchema.set('toJSON', {
	virtuals: true,
	transform: function(doc, ret, options) {
		delete ret.password_hash;
		delete ret.legal_time_override;
		delete ret.payload_limit_override;
		return ret;
	}
});

// Export the Mongoose model for the rest of the program.
// The casting mania in the line below bypasses TypeScript.  If you want to
// spend another five hours pulling your hair out to make IUser work the way
// TypeScript wants it to work, go right ahead.
var User = <Mongoose.Model<IUser>> (<any> Mongoose.model('User', userSchema));
export = User;
