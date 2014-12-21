///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='../node_modules/promise-ts/promise-ts.d.ts'/>

import Util = require("util");
import User = require("./user_model");
import Promise = require("promise-ts");
import RedisHandler = require("./redis_handler");

interface ISocketCustom extends SocketIO.Socket {
	once(event:string, listener:Function);
	removeListener(event:string, listener:Function);
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
		this.socket.once("disconnect", this.onDisconnect);
		this.socket.on("*", this.onInput);

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

	private close():void {
		this.socket.removeListener("*", this.onInput);
		if (this.redis) {
			this.redis.close();
			this.redis.removeAllListeners();
		}
	}


	private onInit = (data:any):void => {
		// Set up Redis
		this.redis = new RedisHandler(data && data.sessCode);
		this.redis.on("oo.sesscode", (sessCode)=> {
			this.socket.emit("sesscode", {
				sesscode: sessCode
			});
		});

		// Blindly pass all data from Redis to the client
		this.redis.on("oo.data", (obj)=> {
			this.socket.emit(obj.name, obj.data);
		});
	};

	private onDisconnect = ():void => {
		this.close();
	};

	private onInput = (name:string, data):void=> {
		this.redis.input({
			name: name,
			data: data
		});
	};
}

export = SocketHandler;