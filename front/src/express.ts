///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/siofu.d.ts'/>

import Config = require("./config");
import Express = require("express");
import Middleware = require("./session_middleware");
import Passport = require("passport");
import Siofu = require("socketio-file-upload");
import Http = require("http");

var preapp = Express()
	.use(Middleware)
	.use(Passport.initialize())
	.use(Passport.session())
	.use(Siofu.router)
	.get("/auth/google", Passport.authenticate("google", {
		failureRedirect: "/login/failure"
	}))
	.get("/auth/google/return", Passport.authenticate("google", {
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
	});

module ExpressApp {
	export function init(){
		var app:Http.Server = preapp.listen(Config.url.port);
		return app;
	}
}

export = ExpressApp;