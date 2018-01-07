///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/passport/passport.d.ts'/>
///<reference path='boris-typedefs/passport-local/passport-local.d.ts'/>
///<reference path='typedefs/passport-google.d.ts'/>
///<reference path='typedefs/easy-no-password.d.ts'/>
///<reference path='typedefs/mailgun.d.ts'/>
///<reference path='typedefs/iuser.ts'/>

import Passport = require("passport");
import Config = require("./config");
import EasyNoPassword = require("easy-no-password");
import GoogleOAuth = require("passport-google-oauth");
import Local = require("passport-local");
import Mailgun = require("mailgun-js");
import Persona = require("passport-persona");
import User = require("./user_model");

var baseUrl = Config.url.protocol + "://" + Config.url.hostname
	+ ":" + Config.url.port + "/";
var googCallbackUrl = baseUrl + "auth/google/callback";

var mailgun = Mailgun({
	apiKey: Config.mailgun.api_key,
	domain: Config.mailgun.domain
});

function findOrCreateUser(email:string, profile:any,
		done:(err:Error, user?:IUser)=>void) {
	User.findOne({
		email: email
	}, (err, user) => {
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
				email: email,
				profile: profile
			}, (err, user) => {
				console.log("New User", user.consoleText);
				done(err, user);
			});
		}
	});
}

enum PasswordStatus { UNKNOWN, INCORRECT, VALID }

function findWithPassword(email:string, password:string,
		done:(err:Error, status?:PasswordStatus, user?:IUser)=>void) {
	User.findOne({
		email: email
	}, (err, user) => {
		if (err) return done(err);

		if (user) {
			// Returning user.  Check password
			user.checkPassword(password, function(err, valid) {
				if (err) return done(err);
				if (valid) {
					return done(null, PasswordStatus.VALID, user);
				} else {
					return done(null, PasswordStatus.INCORRECT);
				}
			});

		} else {
			// User creation is not supported
			return done(null, PasswordStatus.UNKNOWN);
		}
	});
}

var googleStrategy = new (GoogleOAuth.OAuth2Strategy)({
		callbackURL: googCallbackUrl,
		clientID: Config.google.oauth_key,
		clientSecret: Config.google.oauth_secret
	},
	function (accessToken, refreshToken, profile, done) {
		console.log("Google Login", profile.emails[0].value);
		findOrCreateUser(profile.emails[0].value, profile._json, done);
	});	

var personaStrategy = new (Persona.Strategy)({
		audience: baseUrl
	},
	function (email, done) {
		console.log("Persona Callback", email);
		findOrCreateUser(email, { method: "persona" }, done);
	});

var easyStrategy = new (EasyNoPassword.Strategy)({
		secret: Config.easy.secret
	},
	function (req) {
		if (req.body && req.body.s) {
			return { stage: 1, username: req.body.s };
		} else if (req.query && req.query.u && req.query.t) {
			return { stage: 2, username: req.query.u, token: req.query.t };
		} else {
			return null;
		}
	},
	function (email, token, done) {
		var url = `${baseUrl}auth/tok?u=${encodeURIComponent(email)}&t=${token}`;
		mailgun.messages().send({
			from: "Octave Online <webmaster@octave-online.net>",
			to: email,
			subject: "Octave Online Login",
			text: `Your login token for Octave Online is: ${token}\n\nYou can also click the following link.\n\n${url}\n\nOnce you have signed into your account, you may optionally set a password to speed up the sign-in process.  To do this, open the menu and click Change Password.`
		}, (err, info) => {
			if (err) {
				console.error("Failed sending email:", email, info);
			} else {
				console.log("Sent token email:", email);
			}
			done(null);
		});
	},
	function (email, done) {
		console.log("Easy Callback", email);
		findOrCreateUser(email, { method: "easy" }, done);
	});

var passwordStrategy = new (Local.Strategy)({
		usernameField: "s",
		passwordField: "p"
	},
	function(username, password, done) {
		findWithPassword(username, password, function(err, status, user) {
			if (err) return done(err);
			console.log("Password Callback", status, username);
			if (status === PasswordStatus.UNKNOWN || status == PasswordStatus.INCORRECT) {
				return done(null, false);
			} else {
				return done(null, user);
			}
		});
	}
);

module PassportSetup {
	export function init(){
		Passport.use(googleStrategy);
		Passport.use(personaStrategy);
		Passport.use(easyStrategy);
		Passport.use(passwordStrategy);
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