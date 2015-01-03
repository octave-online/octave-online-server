///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>

import User = require("./user_model");
import IUser = require("./user_interface");
import RedisHandler = require("./redis_handler");
import RedisHelper = require("./redis_helper");

interface ISocketCustom extends SocketIO.Socket {
	once(event:string, listener:Function):void;
	removeListener(event:string, listener:Function):void;
	removeAllListeners():void;
	disconnect():void;
	handler: SocketHandler;
	handshake: {
		address: string;
	}
}

enum ReadyState{
	New,
	Active,
	Destroyed
}

class SocketHandler {
	public socket:ISocketCustom;
	public redis:RedisHandler;
	public user:IUser = null;
	public sessCode:string;
	public readyState:ReadyState = ReadyState.New;

	public static onConnection(socket:SocketIO.Socket) {
		var handler = new SocketHandler(socket);
		handler.socket.handler = handler;
	}

	constructor(socket:SocketIO.Socket) {

		// Set up the socket
		this.socket = <ISocketCustom> socket;
		this.listen();
		this.log("New Connection", this.socket.handshake.address);

		// Concurrently ask socket for its sessCode and load user from MongoDB
		var _socketInitDone = false;
		var _mongoInitDone = false;
		var _sessCodeGuess:string = null;

		// Send the init message over the socket and wait for a response
		this.socket.emit("init");
		this.socket.once("init", (data)=> {
			_sessCodeGuess = data && data.sessCode;
			_socketInitDone = true;
			this.log("Claimed sessCode", data.sessCode);

			// Attempt to continue to callback
			if (_socketInitDone && _mongoInitDone) {
				this.initSessCode(_sessCodeGuess);
			}
		});

		// Load the user from MongoDB
		var sess = this.socket.request.session;
		var userId = sess && sess.passport && sess.passport.user;
		if (userId) {
			User.findById(userId, (err, user)=> {
				if (err) return this.log("MONGO ERROR", err);
				this.user = user;
				_mongoInitDone = true;
				this.log("Loaded from Mongo");

				// Attempt to continue to callback
				if (_socketInitDone && _mongoInitDone) {
					this.initSessCode(_sessCodeGuess);
				}
			});
		} else {
			_mongoInitDone = true;
		}
	}

	private listen() {
		// Prevent duplicate listeners
		this.unlisten();

		// Make listeners on the socket
		this.socket.on("disconnect", this.onDisconnect);
		this.socket.on("*", this.onInput);

		// Make listeners on Redis
		if (this.redis) {
			this.redis.on("data", this.onOutput);
			this.redis.on("destroy-u", this.onDestroyU);
		}
	}

	private unlisten():void {
		this.socket.removeAllListeners();
		if (this.redis) {
			this.redis.removeAllListeners();
		}
	}

	private log(..._args:any[]):void {
		var args = Array.prototype.slice.apply(arguments);
		args.unshift("[" + this.socket.id + "]");
		console.log.apply(this, args);
	}

	//// LISTENER FUNCTIONS ////

	private onDisconnect = ():void => {
		this.readyState = ReadyState.Destroyed;
		this.unlisten();
		if (this.redis) this.redis.destroyD("Client Disconnect");
		this.log("Destroying: Client Disconnect");
	};

	private onDestroyU = (message:string):void=> {
		this.readyState = ReadyState.Destroyed;
		this.unlisten();
		this.socket.emit("destroy-u", message);
		this.socket.disconnect();
		this.log("Destroying:", message);
	};

	private onInput = (obj)=> {
		if (!this.redis) return;

		// Blindly pass all data from the client to Redis
		this.redis.input(obj.data[0], obj.data[1]);
	};

	private onOutput = (name, data) => {
		// Blindly pass all data from Redis to the client
		this.socket.emit(name, data);
	};

	//// SESSION INITIALIZATION FUNCTIONS ////

	private initSessCode(sessCodeGuess:string) {
		if (this.readyState !== ReadyState.New) return;

		RedisHelper.getNewSessCode(sessCodeGuess, this.onSessCode);
	}

	private onSessCode = (err, sessCode:string, needsOctave:boolean)=> {
		if (err) return this.log("REDIS ERROR", err);
		if (this.readyState !== ReadyState.New) return;
		this.sessCode = sessCode;

		// We have our sessCode.  Log it.
		this.log("SessCode Ready", sessCode);

		if (needsOctave) {
			// Tell the client and make the Octave session.
			this.socket.emit("sesscode", {
				sessCode: sessCode
			});
			RedisHelper.askForOctave(sessCode, this.user, this.onOctaveRequested);
		} else {
			// Make Redis, update ready state, and send prompt message to client
			this.redis = new RedisHandler(this.sessCode);
			this.readyState = ReadyState.Active;
			this.listen();
			this.socket.emit("prompt", {});
		}
	};

	private onOctaveRequested = (err)=> {
		if (err) return this.log("REDIS ERROR", err);

		// Make Redis
		this.redis = new RedisHandler(this.sessCode);
		this.listen();

		// Check and update ready state
		switch (this.readyState) {
			case ReadyState.Destroyed:
				this.redis.destroyD("Client Gone");
				this.unlisten();
				break;
			case ReadyState.New:
				this.readyState = ReadyState.Active;
				break;
			default:
				break;
		}
	};
}

export = SocketHandler;