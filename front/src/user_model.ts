///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='typedefs/iuser.ts'/>

// Mongoose User: stores OpenID information for a user.

import Mongoose = require("mongoose");
import Crypto = require("crypto");

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
userSchema.virtual("consoleText").get(function () {
	return "[User " + this.id + ": "
		+ this.displayName + ", "
		+ this.parametrized + "]";
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
	console.log("Creating share key for user", this.parametrized, this.share_key);
	this.save(next);
};
(<any>userSchema).methods.removeShareKey = function(next){
	this.share_key = null;
	console.log("Removing share key from user", this.parametrized);
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
userSchema.set('toJSON', { virtuals: true });

// Export the Mongoose model for the rest of the program.
// The casting mania in the line below bypasses TypeScript.  If you want to
// spend another five hours pulling your hair out to make IUser work the way
// TypeScript wants it to work, go right ahead.
var User = <Mongoose.Model<IUser>> (<any> Mongoose.model('User', userSchema));
export = User;
