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

import Http = require("http");
import Path = require("path");

import BodyParser = require("body-parser");
import Compression = require("compression");
import Express = require("express");
import Flatten = require("flat");
import I18next = require("i18next");
import I18nextFsBackend = require("i18next-fs-backend");
import I18nextMiddleware = require("i18next-http-middleware");
import PseudoLocalization = require("pseudo-localization");
import Passport = require("passport");
import ReCAPTCHA = require("recaptcha2");
import ServeStatic = require("serve-static");
import Siofu = require("socketio-file-upload");

import * as SessionMiddleware from "./session_middleware";
import * as Patreon from "./patreon";
import { config, logger } from "./shared_wrap";

const log = logger("express-setup");

const recaptcha = new ReCAPTCHA({
	siteKey: config.recaptcha.siteKey,
	secretKey: config.recaptcha.secretKey,
});

const PORT = process.env.PORT || config.front.listen_port;
const STATIC_PATH_1 = Path.join(__dirname, "..", "..", config.front.static_path);
const STATIC_PATH_2 = Path.join(__dirname, "..", "static");
const STATIC_OPTS: ServeStatic.ServeStaticOptions = {
	maxAge: "7d",
	setHeaders: (res, path, stat) => {
		switch (Path.extname(path)) {
			case ".html":
				res.setHeader("Cache-Control", "public, max-age=0");
				break;
			default:
				break;
		}
	}
};

export let app: Express.Application;
export let server: Http.Server;

export interface BuildData {
	locales_path?: string;
	locales?: string[];
}

export function init(buildData: BuildData){
	log.info("Serving static files from:", STATIC_PATH_1);
	log.info("Loading locales from:", buildData.locales_path);

	// Work around bug in i18next TypeScript definition?
	const i18next = (I18next as unknown as I18next.i18n);
	i18next
		.use(I18nextMiddleware.LanguageDetector)
		.use(I18nextFsBackend)
		.init({
			backend: {
				loadPath: buildData.locales_path!,
			},
			fallbackLng: "en",
			preload: buildData.locales!,
			saveMissing: true,
			missingKeyHandler: function(lng, ns, key, fallbackValue) {
				log.error("i18next missing key:", lng, ns, key, fallbackValue);
			},
			missingInterpolationHandler: function(text, value) {
				log.error("i18next missing interpolation:", text, value);
			}
		}, (err) => {
			if (err) {
				log.error("i18next failed to initialize:", err);
			} else {
				log.info("i18next initialized with languages:", Object.keys(i18next.store.data));
			}
		});

	app = Express()
		.use(function(req, res, next) {
			// Redirect HTTP to HTTPS
			if (!config.front.require_https) return next();
			if (req.headers["x-forwarded-proto"] === "https") return next();
			if (req.protocol === "https") return next();
			res.redirect(301, `https://${req.hostname}${req.url}`);
		})
		.use(Compression())
		.get(/\/[a-z]+~\w+$/, function(req, res, next) {
			// Internally rewrite the path to index.html
			req.url = "/index.html";
			next("route");
		})
		.use(ServeStatic(STATIC_PATH_1, STATIC_OPTS))
		.use(ServeStatic(STATIC_PATH_2, STATIC_OPTS))
		.use(SessionMiddleware.middleware)
		.use(BodyParser.urlencoded({ extended: true }))
		.use(BodyParser.json({
			verify: function(req, res, buf, encoding) {
				// Save the buffer for verification later
				(req as any).rawBody = buf;
			}
		}))
		.use(I18nextMiddleware.handle(i18next))
		.use(Passport.initialize())
		.use(Passport.session())
		.use(Siofu.router)
		.set("views", Path.join(__dirname, "..", "src", "views"))
		.set("view engine", "ejs")
		.get("/ping", function(req, res){
			res.sendStatus(204);
		})
		.get(["/", "/index.html"], function(req, res) {
			res.setHeader("Cache-Control", "public, max-age=0");
			let t = (req as any).t as I18next.TFunction;
			const requestedLanguage = (req as any).language as string;
			if (requestedLanguage === "en-XA") {
				let old_t = t;
				t = function(key: string, options: any) {
					return PseudoLocalization.localize(old_t(key, options));
				};
			}
			// Figure out the current language from the resource bundles
			const resolvedLanguages = (req as any).languages as string[];
			let currentLanguage;
			for (let language of resolvedLanguages) {
				if (buildData.locales!.indexOf(language) !== -1) {
					currentLanguage = language;
					break;
				}
			}
			// Get the JavaScript translations
			let oo_translations: {[key: string]: string} = {};
			let jsKeys: {[key: string]: unknown} = Flatten((req as any).i18n.getDataByLanguage("en").translation.javascript);
			for (let key of Object.keys(jsKeys)) {
				let key_string = key as string;
				oo_translations[key_string] = t(`javascript.${key_string}`, { config });
			}
			res.status(200).render("index", {
				config,
				buildData,
				t,
				oo_translations,
				currentLanguage,
			});
		})
		.post("/auth/persona", Passport.authenticate("persona"), function(req, res){
			res.sendStatus(204);
		})
		.get("/auth/tok", Passport.authenticate("easy", {
			successRedirect: "/",
			failureRedirect: "/auth/failure"
		}))
		.post("/auth/tok", function(req, res, next) {
			recaptcha.validateRequest(req, req.ip).then(function(){
				// validated and secure
				log.trace("/auth/tok: ReCAPTCHA OK");
				next();
			}).catch(function(errorCodes){
				// invalid
				// NOTE: The "p" field is a honeypot in /auth/tok.
				log.info("/auth/tok: ReCAPTCHA Failure: Query:", JSON.stringify(req.body), "Message:", recaptcha.translateErrors(errorCodes));
				res.status(400).render("captcha_error", { config });
			});
		}, Passport.authenticate("easy"), function(req, res) {
			res.redirect("/auth/entry?s=" + encodeURIComponent(req.body && req.body.s));
		})
		.get("/auth/entry", function(req, res) {
			res.status(200).render("token_page", { config, query: req.query });
		})
		.post("/auth/pwd", function(req, res, next) {
			// One star to disable ReCAPTCHA; two stars to enable it
			/*/
			recaptcha.validateRequest(req, req.ip).then(function(){
				// validated and secure
				log.trace("/auth/pwd: ReCAPTCHA OK");
				next();
			}).catch(function(errorCodes){
				// invalid
				// NOTE: "p" could contain plaintext passwords, so scrub it from the log
				if ("p" in req.body) req.body.p = "<redacted>";
				log.info("/auth/pwd: ReCAPTCHA Failure: Query:", JSON.stringify(req.body), "Message:", recaptcha.translateErrors(errorCodes));
				res.status(400).render("captcha_error", { config });
			});
			/*/
			next();
			/**/
		}, function(req, res, next) {
			Passport.authenticate("local", function(err, user, /* info, status */) {
				if (err) return next(err);
				if (!user) return res.redirect("/auth/incorrect?s=" + encodeURIComponent(req.body && req.body.s));
				// Since we overrode the Passport callback function, we need to manually call res.logIn().
				req.logIn(user, {}, function(err) {
					if (err) return next(err);
					// Administrative user, first sign-in; generate default fields
					if (user && !user.parametrized) {
						log.trace("Administrative User", user.consoleText);
						user.save().then(() => {
							log.info("Administrative User Fields Set", user.consoleText);
							res.redirect("/");
						}).catch(next);
					} else {
						res.redirect("/");
					}
				});
			})(req, res, next);
		})
		.get("/auth/incorrect", function(req, res) {
			res.status(400).render("incorrect_page", { config, query: req.query });
		})
		.get("/auth/google", Passport.authenticate("google", {
			scope: "profile email"
		}))
		.get("/auth/google/callback", Passport.authenticate("google", {
			successRedirect: "/",
			failureRedirect: "/auth/failure"
		}))
		.get("/auth/patreon", Patreon.phase1)
		.get("/auth/patreon/callback", Patreon.phase2)
		.get("/auth/patreon/revoke", Patreon.revoke)
		.get("/auth/patreon/webhook", Patreon.webhook)
		.post("/auth/patreon/webhook", Patreon.webhook)
		.get("/auth/patreon/plans", function(req, res) {
			res.redirect(config.patreon.login_redirect);
		})
		.get("/auth/failure", function(req, res) {
			res.status(400).render("login_error", { config });
		})
		.get("/logout", function(req, res){
			req.logout();
			res.redirect("/");
		})
		.get("/js-default/:id.js", function(req, res){
			res.setHeader("Content-Type", "text/javascript");
			res.end("define('"+req.params.id+"',function(){return function(){}});");
		})
		.get("*", function(req, res){
			res.sendStatus(404);
		})
		.use(function (err: any, req: any, res: any, next: any) {
			log.error("Express Error", err);
			res.sendStatus(500);
		});

	server = app.listen(PORT);

	log.info("Initialized Express Server on port:", PORT);
	log.debug("App Settings:", (app as any).settings);

	if (app.get("view cache") && config.front.view_cache_clear_interval) {
		setInterval(() => {
			log.trace("Clearing EJS Cache:", Object.keys(require("ejs").cache._data));
			require("ejs").clearCache();
		}, config.front.view_cache_clear_interval);
	}
}
