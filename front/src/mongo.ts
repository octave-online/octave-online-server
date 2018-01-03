///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

import Mongoose = require("mongoose");
import Config = require("./config");

module Mongo {
	export function connect(next:(err:Error)=>void) {
		var url = "mongodb://" + Config.mongodb.hostname
			+ "/" + Config.mongodb.db;

		console.log("Connecting to Mongo...");

		// Cast to <any> below because mongoose.d.ts is not up-to-date
		Mongoose.connect(url, <any> {
			useMongoClient: true
		}, next);
	}

	export var connection = Mongoose.connection;
}

export = Mongo;