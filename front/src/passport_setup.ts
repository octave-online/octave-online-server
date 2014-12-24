///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/passport/passport.d.ts'/>
///<reference path='../node_modules/promise-ts/promise-ts.d.ts'/>
///<reference path='typedefs/passport-google.d.ts'/>
///<reference path='user_interface.ts'/>

import Passport = require("passport");
import Config = require("./config");
import Google = require("passport-google");
import User = require("./user_model");

var baseUrl = Config.url.protocol + "://" + Config.url.hostname + "/";
var returnUrl = baseUrl + "auth/google/return";

var strategy = new (Google.Strategy)({
		returnURL: returnUrl,
		realm: baseUrl,
		stateless: true
	},
	function (identifier, profile, done) {
		User.findOne({
			"openid.identifier": identifier
		}, (err, user)=> {
			if (err) {
				return done(err);
			}
			if (user) {
				// Returning user
				console.log("Returning User", user.consoleText);
				done(null, user);
			} else {
				// Make a new user
				console.log("Creating New User");
				User.create({
					openid: {
						identifier: identifier,
						profile: profile
					}
				}, (err, user) => {
					console.log("New User", user.consoleText);
					done(err, user);
				});
			}
		});
	});

module P {
	export function init(){
		Passport.use(strategy);
		Passport.serializeUser((user, cb) => {
			cb(null, user.id);
		});
		Passport.deserializeUser((user, cb) => {
			User.findById(user, cb);
		});

		console.log("Initialized Passport");
	}
}

export = P