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

import EasyNoPassword = require("easy-no-password");
import GoogleOAuth = require("passport-google-oauth");
import Local = require("passport-local");
import Mailgun = require("mailgun-js");
import Passport = require("passport");
import Postmark = require("postmark");

import * as Utils from "./utils";
import { config, logger } from "./shared_wrap";
import { User, IUser } from "./user_model";

type Err = Error | null;

const log = logger("passport-setup");

const baseUrl = `${config.front.protocol}://${config.front.hostname}:${config.front.port}/`;
const googCallbackUrl = baseUrl + "auth/google/callback";

let mailgunClient: Mailgun.Mailgun|null = null;
let postmarkClient: Postmark.ServerClient|null = null;

if (config.email.provider === "mailgun") {
	mailgunClient = Mailgun({
		apiKey: config.mailgun.api_key,
		domain: config.mailgun.domain
	});
} else {
	postmarkClient = new Postmark.ServerClient(config.postmark.serverToken);
}

async function findOrCreateUser(email: string, profile: any) {
	let user = await User.findOne({
		email: email
	});

	// Returning user
	if (user) {
		log.info("Returning User", user.consoleText);
		return user;
	}

	// Make a new user
	log.trace("Creating New User");
	user = await User.create({
		email: email,
		profile: profile
	});
	log.info("New User", user.consoleText);
	return user;
}

enum PasswordStatus { UNKNOWN, INCORRECT, VALID }

function findWithPassword(email: string, password: string, done: (err: Err, status?: PasswordStatus, user?: IUser) => void) {
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
					return done(null, PasswordStatus.INCORRECT, user);
				}
			});

		} else {
			// User creation is not supported
			return done(null, PasswordStatus.UNKNOWN);
		}
	});
}

const googleStrategy = new (GoogleOAuth.OAuth2Strategy)({
	callbackURL: googCallbackUrl,
	clientID: config.auth.google.oauth_key,
	clientSecret: config.auth.google.oauth_secret,
	userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function (accessToken, refreshToken, profile, done) {
	const email = profile.emails?.[0].value;
	if (!email) {
		log.warn("No email returned from Google", profile);
		return done(new Error("No email returned from Google"));
	}
	log.info("Google Login", Utils.emailHash(email));
	findOrCreateUser(email, profile._json).then((user) => {
		done(null, user);
	}, (err) => {
		done(err);
	});
});

const easyStrategy = new (EasyNoPassword.Strategy)({
	secret: config.auth.easy.secret,
	maxTokenAge: config.auth.easy.max_token_age
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
	const url = `${baseUrl}auth/tok?u=${encodeURIComponent(email)}&t=${token}`;
	if (mailgunClient) {
		mailgunClient.messages().send({
			from: config.email.from,
			to: email,
			subject: "Octave Online Login",
			text: `Your login token for Octave Online is: ${token}\n\nYou can also click the following link.\n\n${url}\n\nOnce you have signed into your account, you may optionally set a password to speed up the sign-in process.  To do this, open the menu and click Change Password.`
		}, (err, info) => {
			if (err) {
				log.warn("Failed sending email:", email, info);
			} else {
				log.trace("Sent token email:", Utils.emailHash(email));
			}
			done(null);
		});
	} else if (postmarkClient) {
		postmarkClient.sendEmailWithTemplate({
			TemplateAlias: config.postmark.templateAlias,
			From: config.email.from,
			To: email,
			TemplateModel: {
				product_name: config.email.productName,
				token_string: token,
				action_url: url,
				support_url: config.email.supportUrl
			}
		}).then((response) => {
			log.trace(response);
			done(null);
		}).catch((err) => {
			log.error("Failed sending email:", email, err);
			done(err);
		});
	}
},
function (email: string, done: (err: Err, user?: unknown, info?: any) => void) {
	log.info("Easy Callback", Utils.emailHash(email));
	findOrCreateUser(email, { method: "easy" }).then((user) => {
		done(null, user);
	}, (err) => {
		done(err);
	});
});

const passwordStrategy = new (Local.Strategy)({
	usernameField: "s",
	passwordField: "p"
},
function(username, password, done) {
	findWithPassword(username, password, function(err, status, user) {
		if (err) return done(err);
		if (status === PasswordStatus.UNKNOWN) {
			log.info("Password Callback Unknown User", status, username);
			return done(null, false);
		} else if (status === PasswordStatus.INCORRECT) {
			log.info("Password Callback Incorrect", status, (user as IUser).consoleText);
		} else {
			log.info("Password Callback Success", status, (user as IUser).consoleText);
			return done(null, user);
		}
	});
}
);

export function init(){
	Passport.use(googleStrategy);
	Passport.use(easyStrategy);
	Passport.use(passwordStrategy);
	Passport.serializeUser((user: IUser, cb) => {
		cb(null, user.id);
	});
	Passport.deserializeUser((user: IUser, cb) => {
		User.findById(user, cb);
	});

	log.info("Initialized Passport");
}
