///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='boris-typedefs/method-override/method-override.d.ts'/>
///<reference path='typedefs/pushover.d.ts'/>

import Pushover = require("pushover");
import Express = require("express");
import Config = require("./config");
import Url = require("url");
import BasicAuth = require("./basic_auth");
import User = require("./user_model");

// Make the Pushover instance
var repos = Pushover(Config.git.path, {
	autoCreate: false
});

// Log some events to the console
repos.on("push", function (push) {
	console.log("repo push: " + push.repo + "/" + push.commit
		+ " (" + push.branch + ")"
		);
	push.accept();
});
repos.on("fetch", function (fetch) {
	console.log("repo fetch: " + fetch.commit);
	fetch.accept();
});

// Make a router to handle requests for the repos
var _router = Express.Router();

// Request authorization
_router.use(BasicAuth.middleware("Octave Online Repos"));

// Check authorization
_router.get("*", function(req, res, next){
	var url = Url.parse(req.url);
	var m = url.pathname.match(/^\/(\w+\.git)/);
	if (!m) return res.sendStatus(404);
	var repo = m[1];

	// Get the user from the database
	User.findOne({ email: req.basic_auth.username }, (err, user) => {
		if (err) {
			console.log("ERROR FINDING GIT USER", err);
			return res.sendStatus(500);
		}

		// Make sure the user exists
		if (!user) {
			return res.sendStatus(400);
		}

		// Check the user's password
		if (user.repo_key !== req.basic_auth.password) {
			return res.sendStatus(403);
		}

		// Check the user's repo name
		if (user.parametrized+".git" !== m[1]) {
			return res.sendStatus(403);
		}

		// We should be all good now.  Give request to Pushover.
		repos.handle(req, res);

	});
});

module PushoverHandler {
	export var router:Express.RequestHandler = _router;
}

export = PushoverHandler;
