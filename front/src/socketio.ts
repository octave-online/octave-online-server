///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/socketio-wildcard.d.ts'/>

import SocketIO = require("socket.io");
import Http = require("http");
import SocketIOWildcard = require("socketio-wildcard");
import Middleware = require("./session_middleware");
import SocketConnect = require("./socket_connect");
import ExpressApp = require("./express_setup");
import Express = require("express");
import Util = require("util");

module S {
	export function init(){
		var io = SocketIO(ExpressApp.app)
			.use(SocketIOWildcard())
			.use((socket,next)=>{
				// Parse the session using middleware
				Middleware.middleware(socket.request, <Express.Response>{}, next);
			})
			.on("connection", SocketConnect.onConnection);

		Util.log("Initialized Socket.IO Server");
	}
}

export = S;