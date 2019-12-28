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
import Passport = require("passport");
import ServeStatic = require("serve-static");
import Siofu = require("socketio-file-upload");

import * as SessionMiddleware from "./session_middleware";
import { config, logger } from "./shared_wrap";

const log = logger("express-setup");

namespace ExpressApp {
	export function init(){
		const staticPath = Path.join(__dirname, "..", "..", config.front.static_path);
		log.info("Serving static files from:", staticPath);

		app = Express()
			.use(Compression())
			.get(/\/[a-z]+~\w+$/, function(req, res, next) {
				// Internally rewrite the path to index.html
				req.url = "/index.html";
				next("route");
			})
			.use(ServeStatic(staticPath))
			.use(SessionMiddleware.middleware)
			.use(BodyParser.urlencoded({ extended: true }))
			.use(Passport.initialize())
			.use(Passport.session())
			.use(Siofu.router)
			.set("views", "./src/views")
			.set("view engine", "ejs")
			.get("/ping", function(req, res){
				res.sendStatus(204);
			})
			.post("/auth/persona", Passport.authenticate("persona"), function(req, res){
				res.sendStatus(204);
			})
			.get("/auth/tok", Passport.authenticate("easy", {
				successRedirect: "/",
				failureRedirect: "/errors/login.html"
			}))
			.post("/auth/tok", Passport.authenticate("easy"), function(req, res) {
				res.redirect("/auth/entry?s=" + encodeURIComponent(req.body && req.body.s));
			})
			.get("/auth/entry", function(req, res) {
				res.render("token_page", { query: req.query });
			})
			.post("/auth/pwd", function(req, res, next) {
				Passport.authenticate("local", function(err, user, info, status) {
					if (err) return next(err);
					if (!user) return res.redirect("/auth/incorrect?s=" + encodeURIComponent(req.body && req.body.s));
					// Since we overrode the Passport callback function, we need to manually call res.logIn().
					req.logIn(user, {}, function(err) {
						if (err) return next(err);
						res.redirect("/");
					});
				})(req, res, next);
			})
			.get("/auth/incorrect", function(req, res) {
				res.render("incorrect_page", { query: req.query });
			})
			.get("/auth/google", Passport.authenticate("google", {
				scope: "profile email"
			}))
			.get("/auth/google/callback", Passport.authenticate("google", {
				successRedirect: "/",
				failureRedirect: "/errors/login.html"
			}))
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
			.listen(config.front.listen_port);

		log.info("Initialized Express Server on port:", config.front.listen_port);
	}

	export var app: Http.Server;
}

export = ExpressApp;