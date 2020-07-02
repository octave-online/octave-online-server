/*
 * Copyright © 2019, Octave Online LLC
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

import ConnectMongo = require("connect-mongo");
import Express = require("express");
import ExpressSession = require("express-session");

import * as Mongo from "./mongo";
import { config, logger } from "./shared_wrap";

const MongoStore = ConnectMongo(ExpressSession);

const log = logger("session-middleware");

export let middleware: Express.RequestHandler;
export let store: ExpressSession.Store;

export function init() {
	// Make the store instance
	store = new MongoStore({
		mongooseConnection: Mongo.connection
	});

	// Make the middleware instance
	middleware = ExpressSession({
		name: config.front.cookie.name,
		secret: config.front.cookie.secret,
		cookie: {
			maxAge: config.front.cookie.max_age
		},
		store: store
	});

	log.info("Initialized Session Store");
}
