///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

// Mongoose User: stores OpenID information for a user.

import Mongoose = require("mongoose");
import Crypto = require("crypto");
import IUser = require("./user_interface");

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
	program: String
});

// Parametrization function used by Octave Online,
// c. May 2013 - January 2015
function v1Parametrize(id:Mongoose.Types.ObjectId, name:string) {
	// Represent a name such as "John Doe" like "_john_doe".
	// 
	var param_name = name
		.replace(/[^\w\s]|_/g, "")
		.replace(/\s+/g, " ")
		.replace(/(^\s*|\s*$)/g, '')
		.replace(/([A-Z]+)/g, '_$2')
		.replace(/[-\s]+/g, '_')
		.toLowerCase();

	// Add an arbittary, but deterministic, six characters.
	// 
	var param_id = Crypto.createHash("md5")
		.update(id).digest("hex").substr(0, 6);

	// Concatenate them together.
	// 
	return param_id + "_" + param_name;
}

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

// Generate the parametrized name once, upon document creation
userSchema.pre("save", function(next){
	if (!this.parametrized) {
		this.parametrized = v2Parametrize(this.id, this.email);
	}
	next();
});

// Return a file-safe name for this user
userSchema.virtual("v1parametrized").get(function () {
	return v1Parametrize(this.id, this.displayName);
});

// JSON representation: include the virtuals (this object will be transmitted
// to the actual Octave server)
userSchema.set('toJSON', { virtuals: true });

// Export the Mongoose model for the rest of the program
var User = <Mongoose.Model<IUser>> Mongoose.model('User', userSchema);
export = User;
