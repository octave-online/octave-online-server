const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("@oo/shared").config;
const path = require("path");
const basicAuth = require("basic-auth");

const PORT = 5123;

mongoose.connect("mongodb://127.0.0.1: " + config.mongo.port + "/" + config.mongo.db);
const User = mongoose.model("User", {
	email: String,
	parametrized: String,
	password_hash: String
});

console.log("Listening on port " + PORT);
const server = http.createServer((req, res) => {
	const originalUri = path.normalize(req.headers["x-original-uri"] || "");
	const match = /^\/(\w+)\.git\/.+$/.exec(originalUri);
	if (match === null) {
		res.writeHead(403);
		return res.end();
	}
	const parametrized = match[1];
	if (req.headers["authorization"]) {
		// Check username/password
		const creds = basicAuth.parse(req.headers["authorization"]);
		if (!creds) {
			res.writeHead(400);
			return res.end("Invalid credentials");
		}
		User.findOne({ email: creds.name }, (err, user) => {
			if (err || !user) {
				console.error(err || "User not found");
				return prompt(res, "Make sure you entered the correct email/password");
			}
			if (!user.password_hash) {
				return prompt(res, "Make sure you have set a password");
			}
			if (user.parametrized !== parametrized) {
				return prompt(res, "Make sure your repository path is correct");
			}
			bcrypt.compare(creds.pass, user.password_hash, (err, valid) => {
				if (err) {
					console.error(err);
					res.writeHead(400);
					return res.end("Problem validating password");
				}
				if (!valid) {
					return prompt(res, "Make sure you entered the correct email/password");
				}
				res.writeHead(204);
				return res.end();
			});
		});
	} else {
		// Prompt for username/password
		prompt(res, "Please enter your email and password");
	}
});
server.listen(PORT);

function prompt(res, message) {
	res.writeHead(401, {
		"WWW-Authenticate": "Basic realm='"+message+"'"
	});
	return res.end();
}
