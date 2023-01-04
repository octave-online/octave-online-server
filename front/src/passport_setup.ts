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
import Passport = require("passport");

import * as Utils from "./utils";
import { config, logger } from "./shared_wrap";
import { User, IUser, HydratedUser } from "./user_model";
import { sendLoginToken } from "./email";

type Err = Error | null;

const log = logger("passport-setup");

const baseUrl = `${config.front.protocol}://${config.front.hostname}:${config.front.port}/`;
const googCallbackUrl = baseUrl + "auth/google/callback";

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
	user = new User({
		email: email,
		profile: profile
	});
	await user.save();
	log.info("New User", user.consoleText);
	return user;
}

enum PasswordStatus { UNKNOWN, INCORRECT, VALID }

interface UserWithPasswordResponse {
	user?: HydratedUser;
	status: PasswordStatus;
}

async function findWithPasswordPromise(email: string, password: string): Promise<UserWithPasswordResponse> {
	let user = await User.findOne({
		email: email
	});

	// Returning user
	if (user) {
		return new Promise((resolve, reject) => {
			// Returning user.  Check password
			if (!user) throw new Error("unreachable");
			user.checkPassword(password, function(err, valid) {
				if (!user) throw new Error("unreachable");
				if (err) reject(err);
				if (valid) {
					resolve({
						user,
						status: PasswordStatus.VALID
					});
				} else {
					resolve({
						user,
						status: PasswordStatus.INCORRECT
					});
				}
			});
		})
	} else {
		return {
			status: PasswordStatus.UNKNOWN
		};
	}
}

function findWithPassword(email: string, password: string, done: (err: Err, status?: PasswordStatus, user?: IUser) => void) {
	findWithPasswordPromise(email, password).then((response) => {
		done(null, response.status, response.user);
	}).catch((err) => {
		done(err);
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
	sendLoginToken(email, token, url)
		.then(() => {
			done(null);
		})
		.catch((err: any) => {
			log.error("Failed sending email:", email, err);
			done(err);
		});
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
			log.info("Password Callback Incorrect", status, user!.consoleText);
		} else {
			log.info("Password Callback Success", status, user!.consoleText);
			return done(null, user);
		}
	});
}
);

export function init(){
	Passport.use(googleStrategy);
	Passport.use(easyStrategy);
	Passport.use(passwordStrategy);
	Passport.serializeUser((user: HydratedUser, cb) => {
		cb(null, user.id);
	});
	Passport.deserializeUser((user: HydratedUser, cb) => {
		User.findById(user, cb);
	});

	log.info("Initialized Passport");
}
