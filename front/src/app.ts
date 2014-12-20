///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mime/mime.d.ts'/>
///<reference path='../node_modules/promise-ts/promise-ts.d.ts'/>

import Mime = require("mime");
import Util = require("util");
import Config = require("./config");
import Mongo = require("./mongo");
import Passport = require("./passport");
import ExpressApp = require("./express");
import SocketIoApp = require("./socketio");

Mongo.connect().then(function(){
	Passport.init();
	var app = ExpressApp.init();
	var io = SocketIoApp.init(app);
});