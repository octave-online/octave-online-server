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
	console.log("repo push", push.branch, push.commit, push.repo);
	push.accept();
});
repos.on("fetch", function (fetch) {
	console.log("repo fetch", fetch.branch, fetch.commit, fetch.repo);
	fetch.accept();
});

// Make a router to handle requests for the repos
function _router(req, res, next){
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
		user.checkPassword(req.basic_auth.password, function(err1, isValid) {
			if (err1) {
				console.log("ERROR CHECKING PASSWORD", err1);
				return res.sendStatus(500);
			}
			if (!isValid) {
				return res.sendStatus(403);
			}

			// We should be all good now.  Give request to Pushover.
			// 
			// We need to do this req.pause() hack because Pushover doesn't support
			// Express servers out of the box.
			// 
			// See https://github.com/substack/pushover/issues/30
			// 
			req.pause();
			req.url = "/" + user.parametrized + ".git" + req.url;
			repos.handle(req, res);
			req.resume();
		});
	});
};

module PushoverHandler {
	export var router:Express.RequestHandler = _router;
}

export = PushoverHandler;
