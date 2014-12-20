///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

// Mongoose User: stores OpenID information for a user.

import Mongoose = require("mongoose");
import Crypto = require("crypto");
import IUser = require("./user_interface");

// Initialize the schema
var userSchema = new Mongoose.Schema({
	openid: {
		identifier: String,
		profile: Mongoose.Schema.Types.Mixed
	},
	program: String
});

function parametrizeName(name:string) {
	return name
		.replace(/[^\w\s]|_/g, "")
		.replace(/\s+/g, " ")
		.replace(/(^\s*|\s*$)/g, '')
		.replace(/([a-z\d])([A-Z]+)/g, '$1_$2')
		.replace(/[-\s]+/g, '_')
		.toLowerCase();
}

// Return a file-safe name for this user
userSchema.virtual("parametrized").get(function () {
	try {
		var param_name = parametrizeName(this.openid.profile.displayName);
		var param_id = Crypto.createHash("md5")
			.update(this.id).digest("hex").substr(0, 6);
		return param_id + "_" + param_name;
	} catch (e) {
		console.log("CANNOT PARAMETERIZE", this.openid);
		return "cannot_parametrize";
	}
});

// Returns a string containing information about this user
userSchema.virtual("consoleText").get(function () {
	return "[User " + this.id + ": "
		+ this.openid.profile.displayName + ", "
		+ this.parametrized + "]";
});

// JSON representation: include the virtuals (this object will be transmitted
// to the actual Octave server)
userSchema.set('toJSON', { virtuals: true });

// Export the Mongoose model for the rest of the program
var User = <Mongoose.Model<IUser>> Mongoose.model('User', userSchema);
export = User;
