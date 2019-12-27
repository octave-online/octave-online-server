/*
 * Copyright © 2019, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

import Async = require("async");

import { BackServerHandler } from "./back_server_handler";
import { Bucket } from "./bucket_model";
import { logger } from "@oo/shared";
import { FlavorRecord } from "./flavor_record_model";
import { IDestroyable, IWorkspace } from "./utils";
import { NormalWorkspace } from "./workspace_normal";
import { SharedWorkspace } from "./workspace_shared";
import { User, IUser } from "./user_model";

const TOKEN_REGEX = /^\w*$/;

interface ISocketCustom extends SocketIO.Socket {
	handler: SocketHandler;
	removeAllListeners(): this;
}

interface InitData {
	action: string|null;
	info: string|null;
	oldSessCode: string|null;
	skipCreate: boolean;
	flavor: string|null;
}

interface SocketAsyncAuto {
	raw_user: IUser|null;
	user: IUser|null;
	raw_init: any;
	init: InitData;
	init_session: null;
}

export class SocketHandler implements IDestroyable {
	public socket: ISocketCustom;
	public back: BackServerHandler;
	public workspace: IWorkspace|null = null;
	public user: IUser|null = null;
	public bucketId: string|null = null;
	public flavor: string|null = null;
	public destroyed: boolean = false;

	private log: (...arg0: any) => void;

	public static onConnection(socket:SocketIO.Socket) {
		var handler = new SocketHandler(socket);
		handler.socket.handler = handler;
	}

	constructor(socket:SocketIO.Socket) {
		// Set up the socket
		this.socket = <ISocketCustom> socket;
		this.log = logger("socker-handler:" + socket.id);
		this.log("New Connection", this.socket.handshake.address);
		this.socket.emit("init");

		// Set up Redis connection to back server
		this.back = new BackServerHandler();

		// Add event listeners
		this.listen();

		// Startup tasks
		Async.auto<SocketAsyncAuto>({

			// 1. Load user from database
			raw_user: (next) => {
				var sess = this.socket.request.session;
				var userId = sess && sess.passport && sess.passport.user;

				if (userId) User.findById(userId, next);
				else next(null, null);
			},
			user: ["raw_user", ({raw_user}, next) => {
				if (!raw_user) return next(null, null);
				raw_user.loadDependencies(next);
			}],

			// 2. User requested to connect
			raw_init: (next) => {
				this.socket.once("init", (data) => {
					next(null, data);
				});
			},
			init: ["user", "raw_init", ({user, raw_init}, next) => {
				raw_init = raw_init || {};

				// Process the user's requested action
				var action = raw_init.action;
				var info = raw_init.info;
				var oldSessCode = raw_init.sessCode;
				var skipCreate = raw_init.skipCreate;
				var flavor = raw_init.flavor;
				if (action === "session" && !oldSessCode) {
					oldSessCode = info; // backwards compat.
				}

				// Sanitize the inputs (don't add flavor yet)
				action = TOKEN_REGEX.test(action) ? action : null;
				info = TOKEN_REGEX.test(info) ? info : null;
				oldSessCode = TOKEN_REGEX.test(oldSessCode) ? oldSessCode : null;
				skipCreate = !!skipCreate;
				var init = { action, info, oldSessCode, skipCreate, flavor: null };

				if (flavor && user) {
					user.isFlavorOK(flavor, (err, flavorOK) => {
						if (err) return next(err);
						if (flavorOK) {
							this.log("User connected with flavor:", flavor);
							init.flavor = flavor;
						}
						next(null, init);
					});
				} else {
					next(null, init);
				}
			}],

			// Callback (depends on 1 and 2)
			init_session: ["user", "init", ({user, init}, next) => {
				if (this.destroyed) return;

				// Unpack and save init settings
				var { action, info, oldSessCode, skipCreate, flavor } = init;
				this.user = user;
				this.flavor = flavor;

				// Fork to load instructor data and buckets
				this.loadInstructor();
				this.loadUserBuckets();
				this.touchUser();

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

					case "bucket":
						if (!info) return;
						this.log("Attaching to a bucket:", info);
						this.workspace = new NormalWorkspace(oldSessCode, user, <string> info);
						break;

					case "session":
					default:
						if (user && user.share_key) {
							this.log("Attaching as host to student's workspace:", user.share_key);
							this.workspace = new SharedWorkspace("host", user);
						} else {
							this.log("Attaching to default workspace with sessCode", oldSessCode);
							this.workspace = new NormalWorkspace(oldSessCode, user, null);
						}
						break;
				}

				this.listen();
				if (action === "bucket") {
					this.bucketId = <string> info;
					this.loadBucket(skipCreate);
				} else if (!skipCreate) {
					(this.workspace as IWorkspace).beginOctaveRequest(this.flavor);
				}

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

	private listen(): void {
		// Prevent duplicate listeners
		this.unlisten();

		// Make listeners on the socket
		this.socket.on("*", this.onDataD.bind(this));
		this.socket.on("disconnect", this.onDestroyD.bind(this));

		// Make listeners on Redis
		this.back.on("data", this.onDataU.bind(this));
		this.back.on("destroy-u", this.onDestroyU.bind(this));

		// Make listeners on Workspace
		if (this.workspace) {
			this.workspace.on("data", this.onDataW.bind(this));
			this.workspace.on("message", this.sendMessage.bind(this));
			this.workspace.on("sesscode", this.setSessCode.bind(this));
			this.workspace.on("back", this.onDataWtoU.bind(this));
			this.workspace.on("log", this.onLogW.bind(this));
			this.workspace.subscribe();
		}

		// Let Redis have listeners too
		this.back.subscribe();
	}

	private unlisten(): void {
		this.socket.removeAllListeners();
		this.back.removeAllListeners();
		this.back.unsubscribe();
		if (this.workspace) {
			this.workspace.removeAllListeners();
			this.workspace.unsubscribe();
		}
	}

	// Convenience function to post a message in the client's console window
	private sendMessage(message:string): void {
		// Log to console for backwards compatibility with older clients.
		// TODO: Remove this and send the alert box only
		this.socket.emit("data", {
			type: "stdout",
			data: message+"\n"
		});
		this.socket.emit("alert", message);
	}

	//// MAIN LISTENER FUNCTIONS ////

	// When the client disconnects (destroyed from downstream)
	private onDestroyD(): void {
		this.log("Client Disconnect");
		if (this.workspace) this.workspace.destroyD("Client Disconnect");
		this.unlisten();
	}

	// When the back server exits (destroyed from upstream)
	private onDestroyU(message:string): void {
		this.log("Upstream Destroyed:", message);
		this.socket.emit("destroy-u", message);
		this.back.setSessCode(null);
		if (this.workspace) this.workspace.destroyU(message);
	};

	// When the client sends a message (data from downstream)
	private onDataD(obj: any): void {
		var name: string = obj.data[0] || "";
		var data: any|null = obj.data[1] || null;

		// Check for name matches
		switch(name){
			case "init":
				return;
			case "enroll":
				this.onEnroll(data);
				return;
			case "update_students":
				this.onUpdateStudents(data);
				return;
			case "oo.unenroll_student":
				this.onUnenrollStudent(data);
				return;
			case "oo.reenroll_student":
				this.onReenrollStudent(data);
				return;
			case "oo.ping":
				this.onPing(data);
				return;
			case "oo.toggle_sharing":
				this.onToggleSharing(data);
				return;
			case "oo.reconnect":
				this.onOoReconnect();
				return;
			case "oo.set_password":
				this.onSetPassword(data);
				return;
			case "oo.delete_bucket":
				this.onDeleteBucket(data);
				return;
			case "oo.flavor_upgrade":
				this.onFlavorUpgrade(data);
				return;

			default:
				break;
		}

		// Check for prefix matches
		switch(name.substr(0,3)){
			case "ot.":
			case "ws.":
				if (this.workspace) this.workspace.dataD(name, data);
				return;
		}

		// Intercept some commands and fork them into the workspace
		if (name === "data" && this.workspace) this.workspace.dataD(name, data);
		if (name === "save" && this.workspace) this.workspace.dataD(name, data);

		// Send everything else upstream to the back server
		this.back.dataD(name, data);
	};

	// When the back server sends a message (data from upstream)
	// Let (almost) everything continue downstream to the client
	private onDataU(name: string, data: any): void {
		if (this.workspace) this.workspace.dataU(name, data);

		switch(name){
			case "bucket-repo-created":
				this.onBucketCreated(data);
				return;

			case "oo.touch-flavor":
				this.onTouchFlavor(data);
				break;
		}

		this.socket.emit(name, data);
	};

	// When the workspace sends a message (data from workspace)
	// Let everything continue downstream to the client
	private onDataW(name: string, data: any): void {
		this.socket.emit(name, data);
	};

	// When the workspace instance wants to log something
	private onLogW(data: any): void {
		this.log.apply(this, data);
	};

	//// OTHER UTILITY FUNCTIONS ////

	private loadInstructor(): void {
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

	private loadUserBuckets(): void {
		if (!this.user) return;
		Bucket.find({ user_id: this.user._id }, (err, buckets) => {
			if (err) {
				this.log("LOAD USER BUCKETS ERROR", err);
				return;
			}
			this.log("Loaded", buckets.length, "buckets for user", this.user!.consoleText);
			this.socket.emit("all-buckets", { buckets });
		});
	}

	private touchUser(): void {
		if (!this.user) return;
		this.user.touchLastActivity((err) => {
			if (err) {
				this.log("TOUCH ACTIVITY ERROR", err);
				return;
			}
		});
	}

	private loadBucket(skipCreate: boolean): void {
		if (!this.bucketId) return;
		Bucket.findOne({ bucket_id: this.bucketId }, (err, bucket) => {
			if (err) {
				this.log("LOAD BUCKET ERROR", err);
				this.sendMessage("Encountered error while initializing bucket.");
				return;
			}
			if (!bucket) {
				this.sendMessage("Unable to find bucket: " + this.bucketId);
				this.socket.emit("destroy-u", "Unknown Bucket");
				this.workspace = null;
				return;
			}
			this.log("Bucket loaded:", bucket.bucket_id);
			this.socket.emit("bucket-info", bucket);
			if (!skipCreate && this.workspace) {
				this.workspace.beginOctaveRequest(this.flavor);
			}
		});
	}

	private onSetPassword(obj: any): void {
		if (!obj) return;
		if (!this.user) return;
		this.user.setPassword(obj.new_pwd, (err) => {
			if (err) return this.log("SET PASSWORD ERROR", err);
			this.sendMessage("Your password has been changed.");
		});
	}

	private onBucketCreated(obj: any): void {
		if (!obj) return;
		if (!obj.bucket_id) return;
		if (!this.user) {
			this.log("ERROR: No user but got bucket-created message!", obj.bucket_id);
			return;
		}

		var bucket = new Bucket();
		this.log("Creating bucket:", obj.bucket_id, this.user.consoleText);
		bucket.bucket_id = obj.bucket_id;
		bucket.user_id = this.user._id;
		bucket.main = obj.main;
		bucket.save((err) => {
			if (err) return this.log("ERROR creating bucket:", err);
			this.socket.emit("bucket-created", { bucket });
		});
	}

	private onDeleteBucket(obj: any): void {
		if (!obj) return;
		if (!obj.bucket_id) return;
		if (!this.user) return;
		this.log("Deleting bucket:", obj.bucket_id);
		// NOTE: This deletes the bucket from mongo, but not from the file server.  A batch job can be run to delete bucket repos that are not in sync with mongo.
		Bucket.findOne({ bucket_id: obj.bucket_id }, (err, bucket) => {
			if (err) {
				this.log("LOAD BUCKET ERROR", err);
				this.sendMessage("Encountered error while finding bucket.");
				return;
			}
			if (!bucket) {
				this.sendMessage("Unable to find bucket; did you already delete it?");
				return;
			}
			if (!this.user!._id.equals(bucket.user_id)) {
				this.log("ERROR: Bad owner:", bucket.user_id, this.user!.consoleText);
				this.sendMessage("You are not the owner of that bucket");
				return;
			}
			bucket.remove((err, bucket) => {
				if (err) {
					this.log("REMOVE BUCKET ERROR", err);
					this.sendMessage("Encountered error while removing bucket.");
					return;
				}
				this.socket.emit("bucket-deleted", {
					bucket_id: obj.bucket_id
				});
			});
		});
	}

	private onTouchFlavor(obj: any): void {
		if (!obj) return;
		if (!this.user) {
			this.log("ERROR: No user on a flavor session");
			return;
		}

		// Step 1: insert a new FlavorRecord
		var flavorRecord = new FlavorRecord();
		flavorRecord.user_id = this.user._id;
		flavorRecord.sesscode = this.back.sessCode || "null";
		flavorRecord.start = new Date(obj.start);
		flavorRecord.current = new Date(obj.current);
		flavorRecord.flavor = obj.flavor;
		flavorRecord.save((err) => {
			if (err) return this.log("ERROR creating FlavorRecord:", err);

			// Step 2: delete older FlavorRecords from the same sessCode
			FlavorRecord.deleteMany({
				sesscode: flavorRecord.sesscode,
				current: { $lt: flavorRecord.current }
			}, (err /* , writeOpResult */) => {
				if (err) return this.log("ERROR deleting old FlavorRecords:", err);
				// this.log("Added new FlavorRecord and deleted " + (writeOpResult && writeOpResult.result && writeOpResult.result.n) + " old ones");
			});
		});
	}

	private onOoReconnect(): void {
		if (this.workspace) {
			this.workspace.beginOctaveRequest(this.flavor);
		} else {
			this.socket.emit("destroy-u", "Invalid Session");
		}
	};

	private setSessCode(sessCode: string): void {
		// We have our sessCode.
		this.log("SessCode", sessCode);
		this.back.setSessCode(sessCode);
		this.socket.emit("sesscode", {
			sessCode: sessCode
		});
		if (this.workspace) this.workspace.sessCode = sessCode;
	};

	private onDataWtoU(name:string, value:any): void {
		this.back.dataD(name, value);
	};

	//// ENROLLING AND STUDENTS LISTENER FUNCTIONS ////

	private onEnroll(obj: any): void {
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

	private onUpdateStudents(obj: any): void {
		if (!obj) return;
		return this.sendMessage("The update_students command has been replaced.\nOpen a support ticket for more information.");
	};

	private onUnenrollStudent(obj: any): void {
		if (!obj) return;
		if (!obj.userId) return;
		if (!this.user) return;
		User.findById(obj.userId, (err, student)=> {
			if (err) return this.log("MONGO ERROR", err);
			if (!student) return this.log("Warning: student not found", obj.userId);
			if (this.user!.instructor.indexOf(student.program) === -1) return this.log("Warning: illegal call to unenroll student");
			this.log("Un-enrolling", this.user!.consoleText, "from program", student.program);
			student.program = "default";
			student.save((err1) =>{
				if (err1) return this.log("MONGO ERROR", err1);
				this.sendMessage("Student successfully unenrolled: " + student.displayName);
			});
		});
	}

	private onReenrollStudent(obj: any): void {
		if (!obj) return;
		if (!obj.userId) return;
		if (!obj.program) return;
		if (!this.user) return;
		if (this.user.instructor.indexOf(obj.program) === -1) {
			this.sendMessage("Student not re-enrolled: Cannot use the course code " + obj.program);
			return this.log("Warning: illegal call to re-enroll student");
		}
		User.findById(obj.userId, (err, student)=> {
			if (err) return this.log("ERROR ON REENROLL STUDENT", err);
			if (!student) return this.log("Warning: student not found", obj.userId);
			if (this.user!.instructor.indexOf(student.program) === -1) return this.log("Warning: illegal call to reenroll student");
			this.log("Re-enrolling", this.user!.consoleText, "from program", student.program, "to program", obj.program);
			student.program = obj.program;
			student.save((err1) =>{
				if (err1) return this.log("MONGO ERROR", err1);
				this.sendMessage("Student successfully re-enrolled: " + student.displayName);
			});
		});
	}

	private onPing(obj: any): void {
		if (!obj) return;
		this.socket.emit("oo.pong", {
			startTime: parseInt(obj.startTime)
		});
	};

	private onToggleSharing(obj: any): void {
		if (!this.user || !obj) return;
		var enabled = obj.enabled;

		if (!enabled && this.user.program && this.user.program !== "default") {
			this.sendMessage("You must unenroll before disabling sharing.\nTo unenroll, run the command \"enroll('default')\".");
		} else if (enabled) {
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

	private onFlavorUpgrade(obj: any): void {
		if (!this.user || !obj) return;
		var flavor = obj.flavor;

		this.user.isFlavorOK(flavor, (err, flavorOK) => {
			if (err) this.log("FLAVOR OK ERROR", err);
			if (!flavorOK) {
				this.log("Failed to upgrade user to flavor:", flavor);
				return;
			}
			if (!this.workspace) {
				this.log("No workspace on flavor upgrade attempt");
				return;
			}
			this.log("User upgraded to flavor:", flavor);
			this.flavor = flavor;
			this.workspace.destroyD("Flavor Upgrade");
			this.workspace.beginOctaveRequest(this.flavor);
		});
	};
}
