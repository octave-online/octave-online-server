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
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

import Mongoose = require("mongoose");
import Config = require("./config");

module Mongo {
	export function connect(next:(err:Error)=>void) {
		var url = "mongodb://" + Config.mongo.hostname
			+ "/" + Config.mongo.db;

		console.log("Connecting to Mongo...");

		// Cast to <any> below because mongoose.d.ts is not up-to-date
		Mongoose.connect(url, <any> {
			useMongoClient: true
		}, next);
	}

	export var connection = Mongoose.connection;
}

export = Mongo;