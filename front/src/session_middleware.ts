///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express-session/express-session.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='typedefs/connect-mongo.d.ts'/>

import ExpressSession = require("express-session");
import ConnectMongo = require("connect-mongo");
import Config = require("./config");
import Mongoose = require("mongoose");

var middleware = ExpressSession({
	name: Config.cookie.name,
	secret: Config.cookie.secret,
	cookie: {
		maxAge: Config.cookie.max_age
	},
	store: new (ConnectMongo(ExpressSession))({
		mongoose_connection: Mongoose.connection
	})
});

export = middleware;