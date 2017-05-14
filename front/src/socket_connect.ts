///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/easy-no-password.d.ts'/>
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

const enp = require("easy-no-password")(Config.easy.secret);

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

				// Fork to load instructor data
				this.loadInstructor();

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
						// Note: this is not necesarilly a student.  It can be any user.
						this.log("Attaching to a student's workspace:", info)
						this.workspace = new SharedWorkspace("student", info);
						break;

					case "session":
					default:
						if (user && user.share_key) {
							this.log("Attaching as host to student's workspace:", user.share_key);
							this.workspace = new SharedWorkspace("host", user);
						} else {
							this.log("Attaching to default workspace with sessCode", info);
							this.workspace = new NormalWorkspace(info, user);
						}
						break;
				}

				this.listen();
				this.workspace.beginOctaveRequest();

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
			this.workspace.on("message", this.sendMessage);
			this.workspace.on("sesscode", this.setSessCode);
			this.workspace.on("back", this.onDataWtoU);
			this.workspace.on("log", this.onLogW);
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
	private sendMessage = (message:string):void => {
		this.socket.emit("data", {
			type: "stdout",
			data: message+"\n"
		});
	};

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
			case "oo.unenroll_student":
				this.onUnenrollStudent(data);
				break;
			case "oo.reenroll_student":
				this.onReenrollStudent(data);
				break;
			case "oo.ping":
				this.onPing(data);
				break;
			case "oo.toggle_sharing":
				this.onToggleSharing(data);
				break;
			case "oo.reconnect":
				this.onOoReconnect();
				break;
			case "oo.set_password":
				this.onSetPassword(data);
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

	// When the workspace instance wants to log something
	private onLogW = (data) => {
		this.log.apply(this, data);
	};

	//// OTHER UTILITY FUNCTIONS ////

	private loadInstructor = ():void => {
		if (!this.user || !this.user.instructor || !this.user.instructor.length)
			return;

		var programs = this.user.instructor;
		programs.forEach((program:string) => {
			User.find({ program: program }, (err,users) => {
				this.socket.emit("instructor", {
					program: program,
					users: users
				})
			});
		});
	}

	private onSetPassword = (obj)=> {
		if (!obj) return;
		if (!this.user) return;
		this.user.setPassword(obj.new_pwd, (err) => {
			if (err) return this.log("SET PASSWORD ERROR", err);
			this.sendMessage("Your password has been changed.");
		});
	}

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
			if (err) return this.log("MONGO ERROR", err);
			this.sendMessage("Successfully enrolled");
		});
	};

	private onUpdateStudents = (obj)=> {
		if (!obj) return;
		return this.sendMessage("The update_students command has been replaced.\nOpen a support ticket for more information.");
	};

	private onUnenrollStudent = (obj)=> {
		if (!obj) return;
		if (!obj.userId) return;
		User.findById(obj.userId, (err, student)=> {
			if (err) return this.log("MONGO ERROR", err);
			if (this.user.instructor.indexOf(student.program) === -1) return this.log("Warning: illegal call to unenroll student");
			student.program = "default";
			student.save((err1) =>{
				if (err1) return this.log("MONGO ERROR", err1);
				this.sendMessage("Student successfully unenrolled");
			});
		});
	}

	private onReenrollStudent = (obj)=> {
		if (!obj) return;
		if (!obj.userId) return;
		if (!obj.program) return;
		if (this.user.instructor.indexOf(obj.program) === -1) return this.log("Warning: illegal call to reenroll student");
		User.findById(obj.userId, (err, student)=> {
			if (err) return this.log("ERROR ON UNENROLL STUDENT", err);
			if (this.user.instructor.indexOf(student.program) === -1) return this.log("Warning: illegal call to reenroll student");
			student.program = obj.program;
			student.save((err1) =>{
				if (err1) return this.log("MONGO ERROR", err1);
				this.sendMessage("Student successfully re-enrolled");
			});
		});
	}

	private onPing = (obj)=> {
		if (!obj) return;
		this.socket.emit("oo.pong", {
			startTime: parseInt(obj.startTime)
		});
	};

	private onToggleSharing = (obj)=> {
		if (!this.user || !obj) return;
		var enabled = obj.enabled;

		if (enabled) {
			this.user.createShareKey((err)=> {
				if (err) this.log("MONGO ERROR", err);
				this.socket.emit("reload", {});
			});
		} else {
			if (this.workspace) this.workspace.destroyD("Sharing Disabled");
			this.user.removeShareKey((err)=> {
				if (err) this.log("MONGO ERROR", err);
				this.socket.emit("reload", {});
			});
		}
	};
}

export = SocketHandler;