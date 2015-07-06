///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/ot.d.ts'/>

import User = require("./user_model");
import IUser = require("./user_interface");
import Config = require("./config");
import RedisHandler = require("./redis_handler");
import RedisHelper = require("./redis_helper");
import Workspace = require("./workspace");
import ChildProcess = require("child_process");
import Ot = require("ot");
import Async = require("async");

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
	Idle,
	Requested,
	Active,
	Destroyed,
	Workspace
}

class SocketHandler {
	public socket:ISocketCustom;
	public otServer:Ot.Server;
	public redis:RedisHandler;
	public workspace:Workspace;
	public user:IUser = null;
	public sessCode:string;
	public readyState:ReadyState = ReadyState.Idle;

	public static onConnection(socket:SocketIO.Socket) {
		var handler = new SocketHandler(socket);
		handler.socket.handler = handler;
	}

	constructor(socket:SocketIO.Socket) {
		var self = this;

		// Set up the socket
		this.socket = <ISocketCustom> socket;
		this.log("New Connection", this.socket.handshake.address);
		this.socket.emit("init");

		// Set up Redis connection
		this.redis = new RedisHandler();

		// Add event listeners
		this.listen();

		// Startup tasks
		Async.auto({

			// 1. Load user from database
			user: (next) => {
				var sess = self.socket.request.session;
				var userId = sess && sess.passport && sess.passport.user;

				if (userId) User.findById(userId, (err, user) => {
					if (err) return self.log("MONGO ERROR", err);
					self.log("Loaded from Mongo");
					next(null, user);
				});
				else next(null, null);
			},

			// 2. User requested to connect
			init: (next) => {
				self.socket.once("init", (data) => {
					next(null, data);
				});
			},

			// Callback (depends on 1 and 2)
			init_session: ["user", "init", (next, {user, init}) => {
				self.user = user;

				// Process the user's requested action
				var action = init && init.action;
				switch (action) {
					case "workspace":
						var wsId = init && init.wsId;
						if (!wsId) return;
						self.log("Attaching to workspace", wsId);
						self.attachToWorkspace(wsId);
						break;

					case "session":
					default:
						var sessCodeGuess = init && init.sessCode;
						self.log("Claimed sessCode", sessCodeGuess);
						self.beginOctaveRequest(sessCodeGuess);
						break;
				}

				// Continue down the chain (does not do anything currently)
				next(null, null);
			}]

		}, (err) => {
			// Error Handler
			if (err) {
				console.log("ASYNC ERROR", err);
			}
		});
	}

	private listen() {
		// Prevent duplicate listeners
		this.unlisten();

		// Make listeners on the socket
		this.socket.on("disconnect", this.onDisconnect);
		this.socket.on("enroll", this.onEnroll);
		this.socket.on("update_students", this.onUpdateStudents);
		this.socket.on("oo.reconnect", this.onOoReconnect);
		this.socket.on("*", this.onInput);

		// Make listeners on Redis
		this.redis.on("data", this.onOutput);
		this.redis.on("destroy-u", this.onDestroyU);

		// Make listeners on Workspace
		if (this.workspace) {
			this.workspace.on("data", this.onWsData);
			this.workspace.on("sesscode", this.onWsSessCode);
			this.workspace.subscribe();
		}

		// Let Redis have listeners too
		this.redis.subscribe();
	}

	private unlisten():void {
		this.socket.removeAllListeners();
		this.redis.removeAllListeners();
		this.redis.unsubscribe();
		if (this.workspace) {
			this.workspace.removeAllListeners();
			this.workspace.unsubscribe();
		}
	}

	private log(..._args:any[]):void {
		var args = Array.prototype.slice.apply(arguments);
		args.unshift("[" + this.socket.id + "]");
		console.log.apply(this, args);
	}

	private sendData(message:string):void {
		this.socket.emit("data", {
			type: "stdout",
			data: message+"\n"
		});
	}

	//// LISTENER FUNCTIONS ////

	private onDisconnect = ():void => {
		this.readyState = ReadyState.Destroyed;
		this.unlisten();
		if (this.redis && !this.workspace)
			this.redis.destroyD("Client Disconnect");
		this.log("Destroying: Client Disconnect");
	};

	private onDestroyU = (message:string):void => {
		this.readyState = ReadyState.Idle;
		this.socket.emit("destroy-u", message);
		this.redis.setSessCode(null);
		this.log("Upstream Destroyed:", message);
	};

	private onOoReconnect = ():void => {
		if (this.workspace) {
			this.workspace.beginOctaveRequest();
		} else {
			this.beginOctaveRequest(null);
		}
	};

	private onWsSessCode = (sessCode: string, live: boolean): void => {
		this.redis.setSessCode(sessCode);

		if (live) this.socket.emit("prompt", {});
	};

	private onInput = (obj)=> {
		if (!this.redis) return;

		// Check if the event name is prefixed with ot. or ws.
		var name = obj.data[0] || "";
		var val = obj.data[1] || null;
		if (this.workspace
			&& (name.substr(0,3) === "ot."
				|| name.substr(0,3) === "ws.")) {
			this.workspace.onSocket(name, val);
			return;
		}

		// Blindly pass all remaining data from the client to Redis
		this.redis.input(name, val);
	};

	private onWsData = (name, data)=> {
		// Blindly pass all data from the Workspace to the client
		this.socket.emit(name, data);
	}

	private onOutput = (name, data) => {
		// Blindly pass all data from Redis to the client
		this.socket.emit(name, data);
	};

	private onEnroll = (obj)=> {
		if (!this.user || !obj) return;
		var program = obj.program;
		if (!program) return;
		console.log("Enrolling", this.user.consoleText, "in program", program);
		this.user.program = program;
		this.user.save((err)=> {
			if (err) console.log("MONGO ERROR", err);
			this.sendData("Successfully enrolled");
		});
	};

	private onUpdateStudents = (obj)=> {
		if (!obj) return;
		if (!this.user)
			return this.sendData("Please sign in first");
		if (!this.user.instructor || this.user.instructor.length === 0)
			return this.sendData("You're not registered as an instructor");
		if (this.user.instructor.indexOf(obj.program) === -1)
			return this.sendData("Check the spelling of your program name");

		console.log("Updating students in program", obj.program);
		this.sendData("Updating students...");
		ChildProcess.execFile(
			__dirname+"/../src/program_update.sh",
			[this.user.parametrized, obj.program, Config.mongodb.db],
			(err, stdout, stderr)=> {
				if (err) {
					console.log("ERROR ON UPDATE STUDENTS", err, stdout, stderr);
					this.sendData("Error while updating students: " + err);
				} else {
					this.sendData("Successfully updated students");
				}
			}
		);
	};

	//// SHARED WORKSPACE INITIALIZATION FUNCTIONS ////

	private attachToWorkspace(wsId:string) {
		if (this.readyState !== ReadyState.Idle) return;
		this.readyState = ReadyState.Workspace;

		this.workspace = new Workspace(wsId);
		this.workspace.beginOctaveRequest();
		this.listen();
	};

	//// SESSION INITIALIZATION FUNCTIONS ////

	private beginOctaveRequest(sessCodeGuess:string) {
		if (this.readyState !== ReadyState.Idle) return;
		this.readyState = ReadyState.Requested;

		RedisHelper.getNewSessCode(sessCodeGuess, this.onSessCode);
	}

	private onSessCode = (err, sessCode:string, needsOctave:boolean)=> {
		if (err) return this.log("REDIS ERROR", err);
		this.sessCode = sessCode;

		// We have our sessCode.  Log it.
		this.log("SessCode Ready", sessCode);

		if (needsOctave) {
			// Make sure the client didn't leave.
			if (this.readyState !== ReadyState.Requested) return;

			// Tell the client and make the Octave session.
			this.socket.emit("sesscode", {
				sessCode: sessCode
			});
			RedisHelper.askForOctave(sessCode, this.user, this.onOctaveRequested);

		} else {
			// The client's requested sessCode session exists.
			// Add sessCode to Redis
			this.redis.setSessCode(this.sessCode);

			if (this.readyState === ReadyState.Destroyed) {
				// The client abandoned us.  Destroy their session.
				this.redis.destroyD("Client Gone 1");
				this.unlisten();

			} else {
				// Update ready state and send prompt message to the client
				this.readyState = ReadyState.Active;
				this.socket.emit("prompt", {});
			}
		}
	};

	private onOctaveRequested = (err)=> {
		if (err) return this.log("REDIS ERROR", err);

		// A new Octave session with the desired sessCode has been opened.
		// Add sessCode to Redis
		this.redis.setSessCode(this.sessCode);

		// Check and update ready state
		switch (this.readyState) {
			case ReadyState.Destroyed:
				this.redis.destroyD("Client Gone 2");
				this.unlisten();
				break;
			case ReadyState.Requested:
				this.readyState = ReadyState.Active;
				break;
			default:
				console.log("UNEXPECTED READY STATE", this.readyState);
				break;
		}
	};
}

export = SocketHandler;