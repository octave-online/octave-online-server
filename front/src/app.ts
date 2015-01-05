///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mime/mime.d.ts'/>

import Mime = require("mime");
import Config = require("./config");
import Mongo = require("./mongo");
import Passport = require("./passport_setup");
import ExpressApp = require("./express_setup");
import Middleware = require("./session_middleware");
import SocketIoApp = require("./socketio");
import RedisHelper = require("./redis_helper");

Mongo.connect((err)=>{
	if (err) {
		console.log("Error Connecting to Mongo", err);
		return;
	}

	console.log("Connected to Mongo");

	Passport.init();
	Middleware.init();
	ExpressApp.init();
	SocketIoApp.init();
});

RedisHelper.startHeartbeat();
