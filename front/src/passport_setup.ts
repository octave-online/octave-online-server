///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/passport/passport.d.ts'/>
///<reference path='typedefs/passport-google.d.ts'/>
///<reference path='user_interface.ts'/>

import Passport = require("passport");
import Config = require("./config");
import GoogleOAuth = require("passport-google-oauth");
import Persona = require("passport-persona");
import User = require("./user_model");

var baseUrl = Config.url.protocol + "://" + Config.url.hostname
	+ ":" + Config.url.port + "/";
var callbackUrl = baseUrl + "auth/google/callback";

var googleStrategy = new (GoogleOAuth.OAuth2Strategy)({
		callbackURL: callbackUrl,
		clientID: Config.google.oauth_key,
		clientSecret: Config.google.oauth_secret
	},
	function (accessToken, refreshToken, profile, done) {
		console.log("Google Callback", arguments);
		console.log(profile.emails);
		/*
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
		*/
	});

var personaStrategy = new (Persona.Strategy)({
		audience: baseUrl
	},
	function (email, done) {
		console.log("Persona Callback", email);
	});

module PassportSetup {
	export function init(){
		Passport.use(googleStrategy);
		Passport.use(personaStrategy);
		Passport.serializeUser((user, cb) => {
			cb(null, user.id);
		});
		Passport.deserializeUser((user, cb) => {
			User.findById(user, cb);
		});

		console.log("Initialized Passport");
	}
}

export = PassportSetup