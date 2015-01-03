///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

import Mongoose = require("mongoose");
import Config = require("./config");

module Mongo {
	export function connect(next:(err:Error)=>void) {
		var url = "mongodb://" + Config.mongodb.hostname
			+ "/" + Config.mongodb.db;

		console.log("Connecting to Mongo...");

		Mongoose.connect(url, next);
	}

	export var connection = Mongoose.connection;
}

export = Mongo;