///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/siofu.d.ts'/>
///<reference path='typedefs/express-static.d.ts'/>

import Config = require("./config");
import Express = require("express");
import Middleware = require("./session_middleware");
import Passport = require("passport");
import Siofu = require("socketio-file-upload");
import Http = require("http");
import ServeStatic = require("serve-static");
import Compression = require("compression");
import BodyParser = require("body-parser");
import PushoverHandler = require("./pushover_setup");

module ExpressApp {
	export function init(){
		app = Express()
			.use(Compression())
			.use(ServeStatic(Config.static.path))
			.use(Middleware.middleware)
			.use(BodyParser.urlencoded({ extended: true }))
			.use(Passport.initialize())
			.use(Passport.session())
			.use("/repos", PushoverHandler.router)
			.use(Siofu.router)
			.post("/auth/persona", Passport.authenticate("persona", {
				successRedirect: "/",
				failureRedirect: "/login/failure"
			}))
			.get("/auth/google", Passport.authenticate("google", {
				scope: "profile email"
			}))
			.get("/auth/google/callback", Passport.authenticate("google", {
				successRedirect: "/",
				failureRedirect: "/login/failure"
			}))
			.get("/login/failure", function(req, res){
				res.setHeader("Content-Type", "text/plain");
				res.end("Login failed; please try again later");
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
				res.send(404, "Unknown route");
			}).listen(Config.url.port);

		console.log("Initialized Express Server");
	}

	export var app:Http.Server;
}

export = ExpressApp;