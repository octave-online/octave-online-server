const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("@oo/shared").config;
const path = require("path");

const PORT = 5123;

mongoose.connect("mongodb://" + config.mongo.hostname + ": " + config.mongo.port + "/" + config.mongo.db);
const User = mongoose.model("User", {
	email: String,
	parametrized: String,
	password_hash: String
});

console.log("Listening on port " + PORT);
const server = http.createServer((req, res) => {
	const originalUri = path.normalize(path.parse(req.headers["x-original-uri"]).dir);
	const match = /^\/(\w+)\.git\/.+$/.exec(originalUri);
	if (match === null) {
		res.writeHead(403);
		res.end();
	}
	const parametrized = match[1];
	console.log(req);
	res.writeHead(401, {
		"WWW-Authenticate": "Basic realm='User Visible Realm'"
	});
	res.end();
});
server.listen(PORT);

