/*
 * Copyright © 2018, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/express-session/express-session.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/connect-mongo.d.ts'/>

import ExpressSession = require("express-session");
import ConnectMongo = require("connect-mongo");
import Config = require("./config");
import Express = require("express");
import Mongo = require("./mongo");

var MongoStore = ConnectMongo(ExpressSession);

module M {
	export function init() {

		// Make the store instance
		store = new MongoStore({
			mongooseConnection: Mongo.connection
		});

		// Make the middleware instance
		middleware = ExpressSession({
			name: Config.front.cookie.name,
			secret: Config.front.cookie.secret,
			cookie: {
				maxAge: Config.front.cookie.max_age
			},
			store: store
		});

		console.log("Initialized Session Store");
	}

	export var middleware:Express.RequestHandler;
	export var store:ExpressSession.Store;
}

export = M;