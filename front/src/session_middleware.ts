///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express-session/express-session.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/connect-mongo.d.ts'/>

import ExpressSession = require("express-session");
import ConnectMongo = require("connect-mongo");
import Config = require("./config");
import Mongo = require("./mongo");
import Express = require("express");

module M {
	export function init() {
		store = new (ConnectMongo(ExpressSession))({
			mongoose_connection: Mongo.connection
		});
		middleware = ExpressSession({
			name: Config.cookie.name,
			secret: Config.cookie.secret,
			cookie: {
				maxAge: Config.cookie.max_age
			},
			store: store
		});

		console.log("Initialized Session Store");
	}

	export var middleware:Express.RequestHandler;
	export var store:ExpressSession.Store;
}

export = M;