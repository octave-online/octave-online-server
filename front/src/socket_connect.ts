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
import BaseX = require("base-x");
import Hjson = require("hjson");
import SocketIO = require("socket.io");
import Uuid = require("uuid");

import { BackServerHandler } from "./back_server_handler";
import { Bucket, IBucket } from "./bucket_model";
import { logger, ILogger, gcp } from "./shared_wrap";
import { FlavorRecord } from "./flavor_record_model";
import { IDestroyable, IWorkspace } from "./utils";
import { NormalWorkspace } from "./workspace_normal";
import { SharedWorkspace } from "./workspace_shared";
import { User, HydratedUser } from "./user_model";
import { sendZipArchive } from "./email";

const TOKEN_REGEX = /^\w*$/;
const SHORTLINK_REGEX = /^[\p{L}\p{Nd}_-]{5,}$/u;

const Base58 = BaseX("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz");

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
	user: HydratedUser|null;
	raw_init: any;
	init: InitData;
	bucket: IBucket|null;
	init_session: null;
}

interface DeleteBucketAsyncAuto {
	bucket: IBucket|null;
	deleted: any;
	repo: any;
}

export class SocketHandler implements IDestroyable {
	public socket: ISocketCustom;
	public back: BackServerHandler;
	public workspace: IWorkspace|null = null;
	public user: HydratedUser|null = null;
	public bucket: IBucket|null = null;
	public flavor: string|null = null;
	public destroyed = false;

	private _log: ILogger;

	public static onConnection(socket: SocketIO.Socket) {
		const handler = new SocketHandler(socket);
		handler.socket.handler = handler;
	}

	constructor(socket: SocketIO.Socket) {
		// Set up the socket
		this.socket = socket as ISocketCustom;
		this._log = logger("socker-handler:" + socket.id);
		this._log.info("New Connection", this.socket.handshake.address);
		this.socket.emit("init");

		// Set up Redis connection to back server
		this.back = new BackServerHandler();

		// Add event listeners
		this.listen();

		// Startup tasks
		Async.auto<SocketAsyncAuto>({

			// 1. Load user from database
			user: (next) => {
				const sess = (this.socket.request as any).session;
				const userId = sess?.passport?.user;

				if (userId) User.findById(userId)
					.populate("programModel")
					.exec(next);
				else next(null, null);
			},

			// 2. Process init data from client and load bucket info
			raw_init: (next) => {
				this.socket.once("init", (data) => {
					next(null, data);
				});
			},
			init: ["user", "raw_init", ({user, raw_init}, next) => {
				raw_init = raw_init || {};

				// Send back auth user info
				this.socket.emit("oo.authuser", { user });

				// Process the user's requested action
				let action = raw_init.action;
				let info = raw_init.info;
				let oldSessCode = raw_init.sessCode;
				let skipCreate = raw_init.skipCreate;
				const flavor = raw_init.flavor;
				if (action === "session" && !oldSessCode) {
					oldSessCode = info; // backwards compat.
				}

				// Sanitize the inputs (don't add flavor yet)
				action = TOKEN_REGEX.test(action) ? action : null;
				info = TOKEN_REGEX.test(info) ? info : null;
				oldSessCode = TOKEN_REGEX.test(oldSessCode) ? oldSessCode : null;
				skipCreate = !!skipCreate;
				const init = { action, info, oldSessCode, skipCreate, flavor: null };

				if (flavor && user) {
					let flavorOK = user.isFlavorOK(flavor);
					if (flavorOK) {
						this._log.info("User connected with flavor:", flavor);
						init.flavor = flavor;
					}
					next(null, init);
				} else {
					next(null, init);
				}
			}],
			bucket: ["init", ({init}, next) => {
				const { action, info } = init;
				if (action !== "bucket" && action !== "project") {
					next(null, null);
					return;
				}
				Bucket.findOne({ bucket_id: info as string })
					.populate("baseModel")
					.exec(next);
			}],

			// Callback (depends on 1 and 2)
			init_session: ["user", "init", "bucket", ({user, init, bucket}, next) => {
				if (this.destroyed) return;

				// Unpack and save init settings
				const { action, info, oldSessCode, skipCreate, flavor } = init;
				this.user = user;
				this.flavor = flavor;
				this.bucket = bucket;

				// Check for a valid bucket
				if (action === "bucket" || action === "project") {
					if (!bucket || !bucket.isValidAction(action)) {
						this._log.info("Invalid bucket/project:", action, (bucket?.consoleText));
						this.sendMessage("Unable to find bucket or project: " + (info as string));
						this.socket.emit("destroy-u", "Invalid Bucket or Project");
						return;
					}
					if (!bucket.checkAccessPermissions(user)) {
						this._log.info("Permission denied:", bucket.consoleText);
						this.sendMessage("Permission denied: " + bucket.bucket_id);
						this.socket.emit("destroy-u", "Permission Denied");
						return;
					}
					this.socket.emit("bucket-info", bucket);
				}

				// Fork to load instructor data and buckets
				this.loadInstructor();
				this.loadUserBuckets();
				this.touchUser();
				this.touchBucket();

				if (this.user) {
					this._log.info("Tier:", this.user.tier);
				}

				switch (action) {
					case "workspace":
						this._log.warn("Attempted to create no-context workspace:", info);
						return;

					case "student":
						if (!info) return;
						// Note: this is not necesarilly a student.  It can be any user.
						this._log.info("Attaching to a student's workspace:", info);
						this.workspace = new SharedWorkspace(info as string, null, null, socket.id);
						break;

					case "bucket":
					case "project":
						if (!bucket) return;
						if (bucket.butype === "collab") {
							// TODO(#41): Initialize the shared workspace with the project owner, not the auth user. Maybe pass null as the user here and then load the project owner inside SharedWorkspace.
							this._log.info("Attaching to a collaborative project:", bucket.consoleText);
							this.workspace = new SharedWorkspace(null, user, bucket, socket.id);
						} else {
							this._log.info("Attaching to a bucket/project:", bucket.consoleText);
							this.workspace = new NormalWorkspace(oldSessCode, user, bucket);
						}
						break;

					case "session":
					default:
						if (user && user.share_key) {
							this._log.info("Attaching as host to student's workspace:", user.share_key);
							this.workspace = new SharedWorkspace(null, user, null, socket.id);
						} else {
							this._log.info("Attaching to default workspace with sessCode", oldSessCode);
							this.workspace = new NormalWorkspace(oldSessCode, user, null);
						}
						break;
				}

				this.listen();
				if (!skipCreate) {
					this.workspace.beginOctaveRequest(this.flavor);
				}

				// Continue down the chain (does not do anything currently)
				next(null, null);
			}]

		}, (err) => {
			// Error Handler
			if (err) {
				this._log.error("ASYNC ERROR", err);
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
	private sendMessage(message: string): void {
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
		this._log.info("Client Disconnect");
		if (this.workspace) this.workspace.destroyD("Client Disconnect");
		this.unlisten();
	}

	// When the back server exits (destroyed from upstream)
	private onDestroyU(message: string): void {
		this._log.info("Upstream Destroyed:", message);
		this.socket.emit("destroy-u", message);
		this.back.setSessCode(null);
		if (this.workspace) this.workspace.destroyU(message);
	}

	// When the client sends a message (data from downstream)
	private onDataD(obj: any): void {
		const name: string = obj.data[0] || "";
		const data: any|null = obj.data[1] || null;

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
			case "oo.generate_zip":
				this.onGenerateZip(data);
				return;
			case "oo.create_bucket":
				this.onCreateBucket(data);
				return;
			case "oo.change_bucket_shortlink":
				this.onChangeBucketShortlink(data);
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
	}

	// When the back server sends a message (data from upstream)
	// Let (almost) everything continue downstream to the client
	private onDataU(name: string, data: any): void {
		if (this.workspace) this.workspace.dataU(name, data);

		switch(name){
			case "bucket-repo-created":
				this.onBucketRepoCreated(data);
				return;

			case "oo.touch-flavor":
				this.onTouchFlavor(data);
				break;
		}

		this.socket.emit(name, data);
	}

	// When the workspace sends a message (data from workspace)
	// Let everything continue downstream to the client
	private onDataW(name: string, data: any): void {
		this.socket.emit(name, data);
	}

	//// OTHER UTILITY FUNCTIONS ////

	private async loadInstructor(): Promise<void> {
		if (!this.user || !this.user.instructor || !this.user.instructor.length)
			return;

		let user = await this.user.loadInstructorModels();
		user.instructorModels?.forEach((program) => {
			this.socket.emit("instructor", {
				program: program.program_name,
				users: program.students,
			});
		});
	}

	private async loadUserBuckets(): Promise<void> {
		if (!this.user) return;
		let buckets = await Bucket.find({ user_id: this.user._id });
		this._log.trace("Loaded", buckets.length, "buckets for user", this.user!.consoleText);
		this.socket.emit("all-buckets", { buckets });
	}

	private touchUser(): void {
		if (!this.user) return;
		this.user.touchLastActivity((err) => {
			if (err) {
				this._log.error("TOUCH USER ACTIVITY ERROR", err);
				return;
			}
		});
	}

	private touchBucket(): void {
		if (!this.bucket) return;
		this.bucket.touchLastActivity((err) => {
			if (err) {
				this._log.error("TOUCH BUCKET ACTIVITY ERROR", err);
				return;
			}
		});
	}

	private onSetPassword(obj: any): void {
		if (!obj) return;
		if (!this.user) return;
		this.user.setPassword(obj.new_pwd, (err) => {
			if (err) return this._log.error("SET PASSWORD ERROR", err);
			this.sendMessage("Your password has been changed.");
		});
	}

	private parseDuplicateKeyError(err: Error): object | void {
		if (err.message.indexOf("duplicate key error") !== -1) {
			let dup;
			try {
				this._log.trace("Caught duplicate key error:", err.message);
				dup = Hjson.parse(err.message.substr(err.message.indexOf("dup key:") + 9));
			} catch(e) {
				this._log.error("ERROR: Could not parse duplicate key error:", e, err);
				return;
			}
			return dup;
		}
	}

	private onCreateBucket(obj: any): void {
		if (!obj) return;
		if (!this.user) return;
		if (!obj.shortlink) return;

		// Validate the shortlink
		if (!SHORTLINK_REGEX.test(obj.shortlink)) {
			this.socket.emit("oo.create-bucket-error", {
				type: "invalid-shortlink"
			});
			return;
		}

		// Generate the Bucket ID
		const bucketIdBuffer = new Buffer(16);
		Uuid.v4(null, bucketIdBuffer, 0);
		const bucketId = Base58.encode(bucketIdBuffer);

		const bucket = new Bucket();
		bucket.bucket_id = bucketId;
		bucket.user_id = this.user._id;
		bucket.butype = obj.butype;
		bucket.base_bucket_id = obj.base_bucket_id;
		bucket.shortlink = obj.shortlink;
		if (obj.butype === "readonly") {
			bucket.main = obj.main;
		}
		bucket.save((err) => {
			if (err) {
				let dup = this.parseDuplicateKeyError(err);
				if (dup) {
					this._log.info("Failed to create bucket with duplicate key:", dup, bucket.consoleText, this.user!.consoleText);
					this.socket.emit("oo.create-bucket-error", {
						type: "duplicate-key",
						data: dup,
					});
					return;
				} else {
					this._log.error("ERROR from Mongo:", err);
					return;
				}
			}

			// Success creating the Mongo entry. Now create the repo.
			this._log.info("Created bucket:", bucket.consoleText, this.user!.consoleText);
			const backData = bucket.toJSON();
			backData.filenames = obj.filenames;
			this.back.dataD("oo.create_bucket", backData);
		});
	}

	private onBucketRepoCreated(bucket: any): void {
		this.socket.emit("bucket-created", { bucket });
	}

	private onChangeBucketShortlink(obj: any): void {
		const bucket = this.bucket;
		if (!bucket) return;
		if (!this.user) return;
		if (!this.user._id.equals(bucket.user_id)) {
			this._log.warn("Attempt to change shortlink for another user's bucket");
			return;
		}
		if (bucket.shortlink !== obj.old_shortlink) {
			this._log.warn("Attempt to change stale shortlink:", bucket.consoleText, obj);
			return;
		}

		// Validate the shortlink
		if (!SHORTLINK_REGEX.test(obj.new_shortlink)) {
			this.socket.emit("oo.change-bucket-shortlink-response", {
				success: false,
				type: "invalid-shortlink"
			});
			return;
		}

		// Attempt to save the new shortlink
		this._log.info("Changing shortlink:", bucket.consoleText, obj.new_shortlink);
		bucket.shortlink = obj.new_shortlink;
		bucket.save((err) => {
			if (err) {
				let dup = this.parseDuplicateKeyError(err);
				if (dup) {
					this._log.info("Failed to update bucket with duplicate key:", dup, bucket.consoleText, this.user!.consoleText);
					this.socket.emit("oo.change-bucket-shortlink-response", {
						success: false,
						type: "duplicate-key",
						data: dup,
					});
					// Reset the shortlink for future calls
					bucket.shortlink = obj.old_shortlink;
					return;
				} else {
					this._log.error("ERROR from Mongo:", err);
					return;
				}
			}

			this.socket.emit("oo.change-bucket-shortlink-response", {
				success: true,
				bucket
			});
		});
	}

	private onDeleteBucket(obj: any): void {
		if (!obj) return;
		if (!obj.bucket_id) return;
		if (!this.user) return;
		this._log.info("Deleting bucket:", obj.bucket_id);

		Async.auto<DeleteBucketAsyncAuto>({
			bucket: (next) => {
				Bucket.findOne({ bucket_id: obj.bucket_id }, next);
			},
			deleted: ["bucket", ({bucket}, next) => {
				if (!bucket) {
					next(new Error("Unable to find bucket"));
					return;
				}
				if (!bucket.isOwnedBy(this.user)) {
					next(new Error("Bad owner: " + bucket.consoleText + " " + this.user?.consoleText));
					return;
				}
				bucket.remove(next);
			}],
			repo: ["bucket", "deleted", ({bucket}, next) => {
				// Note: It would be nice to request repo removal here, but there may be back server instances running that still require it. Instead, there should be a job that periodically scans for and removes orphaned bucket repos.
				if (bucket) {
					// bucket.removeRepo(next);
					next(null);
				} else {
					next(null);
				}
			}],
		}, (err) => {
			if (err) {
				this._log.warn("DELETE BUCKET", err);
				this.sendMessage("Encountered error while deleting bucket");
			} else {
				this.socket.emit("bucket-deleted", {
					bucket_id: obj.bucket_id
				});
			}
		});
	}

	private onTouchFlavor(obj: any): void {
		if (!obj) return;
		if (!this.user) {
			this._log.error("ERROR: No user on a flavor session");
			return;
		}

		// Step 1: insert a new FlavorRecord
		const flavorRecord = new FlavorRecord();
		flavorRecord.user_id = this.user._id;
		flavorRecord.sesscode = this.back.sessCode || "null";
		flavorRecord.start = new Date(obj.start);
		flavorRecord.current = new Date(obj.current);
		flavorRecord.flavor = obj.flavor;
		flavorRecord.save((err) => {
			if (err) return this._log.error("ERROR creating FlavorRecord:", err);

			// Step 2: delete older FlavorRecords from the same sessCode
			FlavorRecord.deleteMany({
				sesscode: flavorRecord.sesscode,
				current: { $lt: flavorRecord.current }
			}, (err /* , writeOpResult */) => {
				if (err) return this._log.error("ERROR deleting old FlavorRecords:", err);
				// this._log.trace("Added new FlavorRecord and deleted " + (writeOpResult && writeOpResult.result && writeOpResult.result.n) + " old ones");
			});
		});
	}

	private onOoReconnect(): void {
		if (this.workspace) {
			this.workspace.beginOctaveRequest(this.flavor);
		} else {
			this.socket.emit("destroy-u", "Invalid Session");
		}
	}

	private setSessCode(sessCode: string): void {
		// We have our sessCode.
		this._log.info("SessCode", sessCode);
		this.back.setSessCode(sessCode);
		this.socket.emit("sesscode", {
			sessCode: sessCode
		});
		if (this.workspace) this.workspace.sessCode = sessCode;
	}

	private onDataWtoU(name: string, value: any): void {
		this.back.dataD(name, value);
	}

	//// ENROLLING AND STUDENTS LISTENER FUNCTIONS ////

	private onEnroll(obj: any): void {
		if (!this.user || !obj) return;
		const program = obj.program;
		if (!program) return;
		this._log.info("Enrolling", this.user.consoleText, "in program", program);
		this.user.program = program;
		this.user.save((err)=> {
			if (err) return this._log.error("MONGO ERROR", err);
			this.sendMessage("Successfully enrolled");
		});
	}

	private onUpdateStudents(obj: any): void {
		if (!obj) return;
		return this.sendMessage("The update_students command has been replaced.\nOpen a support ticket for more information.");
	}

	private async onUnenrollStudent(obj: any): Promise<void> {
		if (!obj) return;
		if (!obj.userId) return;
		if (!this.user) return;
		let student = await User.findById(obj.userId);
		if (!student) return this._log.warn("Warning: student not found", obj.userId);
		if (this.user!.instructor.indexOf(student.program) === -1) return this._log.warn("Warning: illegal call to unenroll student");
		this._log.info("Un-enrolling", this.user!.consoleText, "from program", student.program);
		student.program = "default";
		await student.save();
		this.sendMessage("Student successfully unenrolled: " + student.displayName);
	}

	private async onReenrollStudent(obj: any): Promise<void> {
		if (!obj) return;
		if (!obj.userId) return;
		if (!obj.program) return;
		if (!this.user) return;
		if (this.user.instructor.indexOf(obj.program) === -1) {
			this.sendMessage("Student not re-enrolled: Cannot use the course code " + obj.program);
			return this._log.warn("Warning: illegal call to re-enroll student");
		}
		let student = await User.findById(obj.userId);
		if (!student) return this._log.warn("Warning: student not found", obj.userId);
		if (this.user!.instructor.indexOf(student.program) === -1) return this._log.warn("Warning: illegal call to reenroll student");
		this._log.info("Re-enrolling", this.user!.consoleText, "from program", student.program, "to program", obj.program);
		student.program = obj.program;
		await student.save();
		this.sendMessage("Student successfully re-enrolled: " + student.displayName);
	}

	private onPing(obj: any): void {
		if (!obj) return;
		this.socket.emit("oo.pong", {
			startTime: parseInt(obj.startTime)
		});
	}

	private onToggleSharing(obj: any): void {
		const enabled: boolean = obj?.enabled;
		const warning = new Error("warning");

		Async.series([
			(next) => {
				if (this.bucket) {
					if (!this.bucket.isOwnedBy(this.user)) {
						this.sendMessage("Permission denied");
						this._log.warn("Could not toggle sharing: permission denied:", this.bucket.consoleText, this.user?.consoleText);
						next(warning);
					} else if (this.bucket.butype === "editable" && enabled) {
						this.bucket.butype = "collab";
						this.bucket.save(next);
					} else if (this.bucket.butype === "collab" && !enabled) {
						if (this.workspace) this.workspace.destroyD("Sharing Disabled");
						this.bucket.butype = "editable";
						this.bucket.save(next);
					} else {
						this.sendMessage("Could not toggle sharing");
						this._log.warn("Could not toggle sharing:", this.bucket.consoleText, obj);
						next(warning);
					}
				} else if (this.user) {
					if (this.user.program && this.user.program !== "default") {
						this.sendMessage("You must unenroll before changing sharing settings.\nTo unenroll, run the command \"enroll('default')\".");
						next(warning);
					} else if (!this.user.share_key && enabled) {
						this.user.createShareKey(next);
					} else if (this.user.share_key && !enabled) {
						if (this.workspace) this.workspace.destroyD("Sharing Disabled");
						this.user.removeShareKey(next);
					} else {
						this.sendMessage("Could not toggle sharing");
						this._log.warn("Could not toggle sharing:", this.user.consoleText, obj);
						next(warning);
					}
				}
			}
		], (err) => {
			if (err === warning) {
				// no-op
			} else if (err) {
				this._log.error("TOGGLE SHARING", err);
				this.sendMessage("Could not toggle sharing");
			} else {
				this.socket.emit("reload", {});
			}
		});
	}

	private onFlavorUpgrade(obj: any): void {
		if (!this.user || !obj) return;
		const flavor = obj.flavor;

		const flavorOK = this.user.isFlavorOK(flavor);
		if (!flavorOK) {
			this._log.warn("Failed to upgrade user to flavor:", flavor);
			return;
		}
		if (!this.workspace) {
			this._log.warn("No workspace on flavor upgrade attempt");
			return;
		}
		this._log.info("User upgraded to flavor:", flavor);
		this.flavor = flavor;
		this.workspace.destroyD("Flavor Upgrade");
		this.workspace.beginOctaveRequest(this.flavor);
	}

	private onGenerateZip(obj: any): void {
		if (!this.user && !this.bucket) {
			this._log.error("Nothing to archive:", obj);
			return;
		}
		if (!gcp) {
			this._log.warn("Cannot generate zip: gcp unavailable");
			return;
		}
		const log = logger("create-repo-snapshot:" + this.socket.id);

		let [tld, name, desc] = (this.bucket) ? ["buckets", this.bucket.bucket_id, this.bucket.displayName] : ["repos", this.user!.parametrized, this.user!.displayName];

		this.sendMessage("Your zip archive is being generated…");
		gcp.uploadRepoSnapshot(log.log, tld, name).then((url: any) => {
			this.socket.emit("data", {
				type: "url",
				url: url,
				linkText: "Zip Archive Ready",
			});
			if (this.user) {
				sendZipArchive(this.user.email, desc, url).catch((err) => {
					log.error("Error sending email:", err);
				});
			}
		}).catch((err: any) => {
			this._log.error("onGenerateZip:", err);
		});
	}
}
