///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='../node_modules/promise-ts/promise-ts.d.ts'/>

import Util = require("util");
import User = require("./user_model");
import Promise = require("promise-ts");
import RedisHandler = require("./redis_handler");

interface ISocketCustom extends SocketIO.Socket {
	once(event:string, listener:Function);
	handler: SocketHandler;
}

class SocketHandler {
	public socket:ISocketCustom;
	public redis:RedisHandler;

	constructor(socket:SocketIO.Socket) {
		this.socket = <ISocketCustom> socket;

		// Set up the socket
		this.socket.emit("init");
		this.socket.once("init", this.onInit);

		// Set up Redis
		this.redis = new RedisHandler();
		this.redis.on("oo.sesscode", (sessCode)=>{
			this.socket.emit("sesscode", {
				sesscode: sessCode
			});
		});

		Util.log("Socket Connected");
	}

	public static onConnection(socket:SocketIO.Socket) {
		var handler = new SocketHandler(socket);
		handler.socket.handler = handler;
	}

	public getUserId():string {
		var sess = this.socket.request.session;
		return sess && sess.passport && sess.passport.user;
	}

	private onInit = (data:any):void => {
		this.redis.setSessCode(data && data.sessCode).then(()=>{
			Util.log("All done");
		});
	}
}

export = SocketHandler;