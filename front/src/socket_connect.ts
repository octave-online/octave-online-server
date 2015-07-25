///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/ot.d.ts'/>
///<reference path='typedefs/idestroyable.d.ts'/>
///<reference path='typedefs/iworkspace.ts'/>
///<reference path='typedefs/iuser.ts'/>

import User = require("./user_model");
import Config = require("./config");
import BackServerHandler = require("./back_server_handler");
import NormalWorkspace = require("./workspace_normal");
import SharedWorkspace = require("./workspace_shared");
import ChildProcess = require("child_process");
import Ot = require("ot");
import Async = require("async");

interface ISocketCustom extends SocketIO.Socket {
	handler: SocketHandler;
	removeAllListeners():ISocketCustom;
}

class SocketHandler implements IDestroyable {
	public socket:ISocketCustom;
	public otServer:Ot.Server;
	public back:BackServerHandler;
	public workspace:IWorkspace;
	public user:IUser = null;
	public sessCode:string;
	public destroyed:boolean = false;

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

		// Set up Redis connection to back server
		this.back = new BackServerHandler();

		// Add event listeners
		this.listen();

		// Startup tasks
		Async.auto({

			// 1. Load user from database
			user: (next) => {
				var sess = self.socket.request.session;
				var userId = sess && sess.passport && sess.passport.user;

				if (userId) User.findById(userId, next);
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
				if (self.destroyed) return;

				self.user = user;

				// Process the user's requested action
				var action = init && init.action;
				var info = init && (init.sessCode || init.info); // backwards compat.

				switch (action) {
					case "workspace":
						if (!info) return;
						this.log("Attaching to colaborative workspace:", info);
						this.workspace = new SharedWorkspace("default", info);
						break;

					case "student":
						if (!info) return;
						this.log("Attaching to a student's workspace:", info)
						this.workspace = new SharedWorkspace("student", info);
						break;

					case "session":
					default:
						this.log("Attaching to default workspace with sessCode", info);
						this.workspace = new NormalWorkspace(info, user);
						break;
				}

				this.workspace.beginOctaveRequest();
				this.listen();

				// Continue down the chain (does not do anything currently)
				next(null, null);
			}]

		}, (err) => {
			// Error Handler
			if (err) {
				this.log("ASYNC ERROR", err);
			}
		});
	}

	private listen() {
		// Prevent duplicate listeners
		this.unlisten();

		// Make listeners on the socket
		this.socket.on("*", this.onDataD);
		this.socket.on("disconnect", this.onDestroyD);

		// Make listeners on Redis
		this.back.on("data", this.onDataU);
		this.back.on("destroy-u", this.onDestroyU);

		// Make listeners on Workspace
		if (this.workspace) {
			this.workspace.on("data", this.onDataW);
			this.workspace.on("sesscode", this.setSessCode);
			this.workspace.on("back", this.onDataWtoU);
			this.workspace.subscribe();
		}

		// Let Redis have listeners too
		this.back.subscribe();
	}

	private unlisten():void {
		this.socket.removeAllListeners();
		this.back.removeAllListeners();
		this.back.unsubscribe();
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

	// Convenience function to post a message in the client's console window
	private sendMessage(message:string):void {
		this.socket.emit("data", {
			type: "stdout",
			data: message+"\n"
		});
	}

	//// MAIN LISTENER FUNCTIONS ////

	// When the client disconnects (destroyed from downstream)
	private onDestroyD = ():void => {
		this.log("Client Disconnect");
		if (this.workspace) this.workspace.destroyD("Client Disconnect");
		this.unlisten();
	};

	// When the back server exits (destroyed from upstream)
	private onDestroyU = (message:string):void => {
		this.log("Upstream Destroyed:", message);
		this.socket.emit("destroy-u", message);
		this.back.setSessCode(null);
		if (this.workspace) this.workspace.destroyU(message);
	};

	// When the client sends a message (data from downstream)
	private onDataD = (obj) => {
		var name = obj.data[0] || "";
		var data = obj.data[1] || null;

		// Check for name matches
		switch(name){
			case "enroll":
				this.onEnroll(data);
				break;
			case "update_students":
				this.onUpdateStudents(data);
				break;
			case "oo.reconnect":
				this.onOoReconnect();
				break;
			default:
				break;
		}

		// Check for prefix matches
		switch(name.substr(0,3)){
			case "ot.":
			case "ws.":
				if (this.workspace) this.workspace.dataD(name, data);
				break;
		}

		// Intercept some commands and fork them into the workspace
		if (name === "data" && this.workspace) this.workspace.dataD(name, data);
		if (name === "save" && this.workspace) this.workspace.dataD(name, data);

		// Send everything else upstream to the back server
		this.back.dataD(name, data);
	};

	// When the back server sends a message (data from upstream)
	// Let everything continue downstream to the client
	private onDataU = (name, data) => {
		if (this.workspace) this.workspace.dataU(name, data);
		this.socket.emit(name, data);
	};

	// When the workspace sends a message (data from workspace)
	// Let everything continue downstream to the client
	private onDataW = (name, data) => {
		this.socket.emit(name, data);
	};

	//// OTHER UTILITY FUNCTIONS ////

	private onOoReconnect = ():void => {
		if (this.workspace) this.workspace.beginOctaveRequest();
	};

	private setSessCode = (sessCode: string): void => {
		// We have our sessCode.
		this.log("SessCode", sessCode);
		this.back.setSessCode(sessCode);
		this.socket.emit("sesscode", {
			sessCode: sessCode
		});
		if (this.workspace) this.workspace.sessCode = sessCode;
	};

	private onDataWtoU = (name:string, value:any):void => {
		this.back.dataD(name, value);
	};

	//// ENROLLING AND STUDENTS LISTENER FUNCTIONS ////

	private onEnroll = (obj)=> {
		if (!this.user || !obj) return;
		var program = obj.program;
		if (!program) return;
		this.log("Enrolling", this.user.consoleText, "in program", program);
		this.user.program = program;
		this.user.save((err)=> {
			if (err) this.log("MONGO ERROR", err);
			this.sendMessage("Successfully enrolled");
		});
	};

	private onUpdateStudents = (obj)=> {
		if (!obj) return;
		if (!this.user)
			return this.sendMessage("Please sign in first");
		if (!this.user.instructor || this.user.instructor.length === 0)
			return this.sendMessage("You're not registered as an instructor");
		if (this.user.instructor.indexOf(obj.program) === -1)
			return this.sendMessage("Check the spelling of your program name");

		this.log("Updating students in program", obj.program);
		this.sendMessage("Updating students...");
		ChildProcess.execFile(
			__dirname+"/../src/program_update.sh",
			[this.user.parametrized, obj.program, Config.mongodb.db],
			(err, stdout, stderr)=> {
				if (err) {
					this.log("ERROR ON UPDATE STUDENTS", err, stdout, stderr);
					this.sendMessage("Error while updating students: " + err);
				} else {
					this.sendMessage("Successfully updated students");
				}
			}
		);
	};
}

export = SocketHandler;