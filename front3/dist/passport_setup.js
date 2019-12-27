"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const Passport = require("passport");
const EasyNoPassword = require("easy-no-password");
const GoogleOAuth = require("passport-google-oauth");
const Local = require("passport-local");
const Mailgun = require("mailgun-js");
const user_model_1 = require("./user_model");
const utils_1 = require("./utils");
const shared_1 = require("@oo/shared");
const log = shared_1.logger("passport-setup");
var baseUrl = `${shared_1.config.front.protocol}://${shared_1.config.front.hostname}:${shared_1.config.front.port}/`;
var googCallbackUrl = baseUrl + "auth/google/callback";
var mailgun = Mailgun({
    apiKey: shared_1.config.mailgun.api_key,
    domain: shared_1.config.mailgun.domain
});
function findOrCreateUser(email, profile, done) {
    user_model_1.User.findOne({
        email: email
    }, (err, user) => {
        if (err) {
            return done(err);
        }
        if (user) {
            // Returning user
            console.log("Returning User", user.consoleText);
            done(null, user);
        }
        else {
            // Make a new user
            console.log("Creating New User");
            user_model_1.User.create({
                email: email,
                profile: profile
            }, (err, user) => {
                console.log("New User", user.consoleText);
                done(err, user);
            });
        }
    });
}
var PasswordStatus;
(function (PasswordStatus) {
    PasswordStatus[PasswordStatus["UNKNOWN"] = 0] = "UNKNOWN";
    PasswordStatus[PasswordStatus["INCORRECT"] = 1] = "INCORRECT";
    PasswordStatus[PasswordStatus["VALID"] = 2] = "VALID";
})(PasswordStatus || (PasswordStatus = {}));
function findWithPassword(email, password, done) {
    user_model_1.User.findOne({
        email: email
    }, (err, user) => {
        if (err)
            return done(err);
        if (user) {
            // Returning user.  Check password
            user.checkPassword(password, function (err, valid) {
                if (err)
                    return done(err);
                if (valid) {
                    return done(null, PasswordStatus.VALID, user);
                }
                else {
                    return done(null, PasswordStatus.INCORRECT);
                }
            });
        }
        else {
            // User creation is not supported
            return done(null, PasswordStatus.UNKNOWN);
        }
    });
}
var googleStrategy = new (GoogleOAuth.OAuth2Strategy)({
    callbackURL: googCallbackUrl,
    clientID: Config.auth.google.oauth_key,
    clientSecret: Config.auth.google.oauth_secret,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, function (accessToken, refreshToken, profile, done) {
    const email = profile.emails[0].value;
    console.log("Google Login", utils_1.Utils.emailHash(email));
    findOrCreateUser(email, profile._json, done);
});
var personaStrategy = new (Persona.Strategy)({
    audience: baseUrl
}, function (email, done) {
    console.log("Persona Callback", utils_1.Utils.emailHash(email));
    findOrCreateUser(email, { method: "persona" }, done);
});
var easyStrategy = new (EasyNoPassword.Strategy)({
    secret: Config.auth.easy.secret,
    maxTokenAge: Config.auth.easy.max_token_age
}, function (req) {
    if (req.body && req.body.s) {
        return { stage: 1, username: req.body.s };
    }
    else if (req.query && req.query.u && req.query.t) {
        return { stage: 2, username: req.query.u, token: req.query.t };
    }
    else {
        return null;
    }
}, function (email, token, done) {
    var url = `${baseUrl}auth/tok?u=${encodeURIComponent(email)}&t=${token}`;
    mailgun.messages().send({
        from: "Octave Online <webmaster@octave-online.net>",
        to: email,
        subject: "Octave Online Login",
        text: `Your login token for Octave Online is: ${token}\n\nYou can also click the following link.\n\n${url}\n\nOnce you have signed into your account, you may optionally set a password to speed up the sign-in process.  To do this, open the menu and click Change Password.`
    }, (err, info) => {
        if (err) {
            console.error("Failed sending email:", email, info);
        }
        else {
            console.log("Sent token email:", utils_1.Utils.emailHash(email));
        }
        done(null);
    });
}, function (email, done) {
    console.log("Easy Callback", utils_1.Utils.emailHash(email));
    findOrCreateUser(email, { method: "easy" }, done);
});
var passwordStrategy = new (Local.Strategy)({
    usernameField: "s",
    passwordField: "p"
}, function (username, password, done) {
    findWithPassword(username, password, function (err, status, user) {
        if (err)
            return done(err);
        if (status === PasswordStatus.UNKNOWN || status == PasswordStatus.INCORRECT) {
            console.log("Password Callback Failure", status);
            return done(null, false);
        }
        else {
            console.log("Password Callback Success", status, user.consoleText);
            return done(null, user);
        }
    });
});
function init() {
    Passport.use(googleStrategy);
    Passport.use(personaStrategy);
    Passport.use(easyStrategy);
    Passport.use(passwordStrategy);
    Passport.serializeUser((user, cb) => {
        cb(null, user.id);
    });
    Passport.deserializeUser((user, cb) => {
        user_model_1.User.findById(user, cb);
    });
    log.info("Initialized Passport");
}
exports.init = init;
