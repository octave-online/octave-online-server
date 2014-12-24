///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mime/mime.d.ts'/>

import Mime = require("mime");
import Config = require("./config");
import Mongo = require("./mongo");
import Passport = require("./passport_setup");
import ExpressApp = require("./express_setup");
import Middleware = require("./session_middleware");
import SocketIoApp = require("./socketio");

Mongo.connect()
	.then(Passport.init)
	.then(Middleware.init)
	.then(ExpressApp.init)
	.then(SocketIoApp.init);