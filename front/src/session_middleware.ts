///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express-session/express-session.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/connect-redis.d.ts'/>

import ExpressSession = require("express-session");
import ConnectRedis = require("connect-redis");
import Config = require("./config");
import Express = require("express");
import IRedis = require("./typedefs/iredis");

var RedisStore = ConnectRedis(ExpressSession);

module M {
	export function init() {

		// Make the Redis client
		client = IRedis.createClient();

		// Make the store instance
		store = new RedisStore({
			client: client
		});

		// Make the middleware instance
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

	export var client:IRedis.Client;
	export var middleware:Express.RequestHandler;
	export var store:ExpressSession.Store;
}

export = M;