///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/basic_auth.d.ts'/>

import Express = require("express");

function _middleware(realm:string):Express.RequestHandler {
	return function(req, res, next){
		// Handle authorization
		var raw = req.header("Authorization");
		if(!raw){
			res.header("WWW-Authenticate", "Basic realm='" + realm.replace(/'/g, '\\\'') + "'");
			res.sendStatus(401);
		}else{
			try{
				var m = new Buffer(raw.substr(6), "base64").toString("ascii").split(":");
				req.basic_auth = {
					username: m[0],
					password: m[1]
				};
				next();
			} catch(e) {
				console.log("ERROR PARSING REPO AUTH", e);
				res.sendStatus(500);
			}
		}
	}
}

module BasicAuth {
	export var middleware = _middleware;
}

export = BasicAuth;
