///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>

import Redis = require("redis");

function onSocketConnect(socket:SocketIO.Socket){
	console.log("Socket Conected");
}

export = onSocketConnect;