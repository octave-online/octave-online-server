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

import { EventEmitter } from "events";
import Crypto = require("crypto");

import Async = require("async");
import Uuid = require("uuid");

import { config, newRedisMessenger, logger, ILogger } from "./shared_wrap";
import { IWorkspace } from "./utils";
import { octaveHelper, SessionState } from "./octave_session_helper";
import { OtDocument } from "./ot_document";
import { User, IUser } from "./user_model";
import { IBucket } from "./bucket_model";

interface BeginOctaveRequestAsyncAuto {
	user: IUser|null;
	ready: void;
}

type Err = Error|null;


// Make Redis connections for Shared Workspace
const redisMessenger = newRedisMessenger();
const wsSessClient = newRedisMessenger();
wsSessClient.subscribeToWorkspaceMsgs();

wsSessClient.setMaxListeners(30);

export class SharedWorkspace
	extends EventEmitter
	implements IWorkspace {
	public wsId: string|null = null;
	public safeWsId: string|null = null;  // ID with no username
	public sessCode: string|null = null;
	public destroyed = false;
	private shareKey: string|null = null;
	private user: IUser|null = null;
	private bucket: IBucket|null = null;
	private docs: { [key: string]: OtDocument } = {};
	private msgIds: string[] = [];
	private otEventCounter = 0;
	private wsMessageCounter = 0;
	private statsInterval: any;
	private touchInterval: any;
	private _log: ILogger;
	private logId: string;

	constructor(shareKey: string|null, user: IUser|null, bucket: IBucket|null, logId: string) {
		super();

		this._log = logger(`workspace-shr:${logId}:uninitialized`);
		this.logId = logId;

		this.shareKey = shareKey;
		this.user = user;
		this.bucket = bucket;

		if (bucket) {
			this.setWsId(`bucket_${bucket.bucket_id}`, false);
		} else if (user) {
			this.setWsId(user.parametrized, true);
		}

		this.subscribe();
	}

	private setWsId(wsId: string, truncate: boolean) {
		if (this.wsId) {
			if (this.wsId !== wsId)
				this._log.error("SHARED WORKSPACE ERROR: Trying to set wsId to", wsId, "when it was already set to", this.wsId);
			return;
		}

		this.wsId = wsId;

		// May 2018: remove email-based IDs from log
		this.safeWsId = truncate ? wsId.substr(0, 8) : wsId;
		this._log = logger(`workspace-shr:${this.logId}:${this.safeWsId}`);

		// Create the prompt's OtDocument (every session)
		// Never emit from constructors since there are no listeners yet;
		// use process.nextTick() instead
		const promptId = "prompt." + this.wsId;
		process.nextTick(() => {
			this.emit("data", "ws.promptid", promptId);
			this.docs[promptId] = new OtDocument(promptId, `${this.logId}:prompt.${this.safeWsId}`, "");
			this.subscribe();
		});
	}

	private forEachDoc(fn: (docId: string,doc: OtDocument) => void){
		Object.getOwnPropertyNames(this.docs).forEach((docId) => {
			fn(docId, this.docs[docId]);
		});
	}

	public destroyD(message: string){
		// The Octave session will be destroyed by expiring keys once all
		// users have disconnected.  There is no need to destroy it here.
		// Special case: when sharing is disabled or flavor upgraded
		// TODO: It's poor style to do a string comparison here
		if (!this.sessCode) {
			this.destroyed = true;
		} else if (message === "Sharing Disabled") {
			this.destroyed = true;
			octaveHelper.sendDestroyD(this.sessCode, message);
		} else if (message === "Flavor Upgrade") {
			// Don't set this.destroyed here because the workspace will get a new sessCode
			octaveHelper.sendDestroyD(this.sessCode, message);
		} else {
			this.destroyed = true;
			// Ensure that the files are committed immediately, so that if a user reloads the page, they get their data immediately synced
			this.emit("back", "commit", { comment: "Scripted Commit on Disconnect" });
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
	public destroyU(message: string){
	}

	public dataD(name: string, value: any) {
		if (!name) name = "";
		if (!value) value = {};

		// NOTE: Remember that each downstream event occurs on just one instance
		// of IWorkspace, but upstream events occur on ALL listening instances.

		// Pass OT events down to the OT instances
		if (name.substr(0,3) === "ot.") {
			this.forEachDoc(function(docId,doc){ doc.dataD(name, value); });
			this.otEventCounter++;
			return;
		}

		// A few special handlers
		if (name === "save") {
			// happens when the user saves a file OR creates a new file
			this.resolveFileSave(value);
		}

		// Pass other events into the onUserAction handler
		this.onUserAction(name, value);
	}

	public dataU(name: string, value: any) {
		if (!name) name = "";
		if (!value) value = {};

		// NOTE: Remember that each downstream event occurs on just one instance
		// of IWorkspace, but upstream events occur on ALL listening instances.

		// A few special handlers
		if (name === "user") {
			// happens when the full list of files is read
			this.resolveFileList(value.files /* , true, value.refresh */);

		} else if (name === "fileadd") {
			// happens when SIOFU uploads a file
			this.resolveFileAdd(value);

		} else if (name === "renamed") {
			// happens when a file is successfully renamed
			this.resolveFileRename(value.oldname, value.newname);

		} else if (name === "deleted") {
			// happens when a file is deleted
			this.resolveFileDelete(value.filename);
		}
	}

	private resolveFileList(files: any){
		files = files || {};
		for(const filename in files){
			if (!files.hasOwnProperty(filename)) continue;
			const file = files[filename];
			if (!file.isText) continue;
			const content = new Buffer(file.content, "base64").toString();
			this.resolveFile(filename, content);
		}
	}

	private resolveFileAdd(file: any){
		if (!file.isText) return;

		this._log.trace("Resolving File Add", file.filename);

		const content = new Buffer(file.content, "base64").toString();
		this.resolveFile(file.filename, content);
	}

	private resolveFileSave(file: any){
		this._log.trace("Resolving File Save", file.filename);
		this.resolveFile(file.filename, file.content);
	}

	private resolveFile(filename: string, content: string) {
		// Note: hash.copy() was added in Node.js 13; we could use that here instead of converting via Buffer.from()
		const hexHash = Crypto.createHash("md5").update(filename).digest("hex");
		const shortHash = Buffer.from(hexHash, "hex").toString("base64").replace(/=/g, "");
		const docId = `doc.${this.wsId}.${hexHash}`;

		if (!this.docs[docId]) {
			this.docs[docId] = new OtDocument(docId, `${this.logId}:doc.${this.safeWsId}.${shortHash}`, content);
			this.docs[docId].logFilename(filename);
			this.subscribe();
			process.nextTick(() => {
				this.emit("data", "ws.doc", {
					docId: docId,
					filename: filename
				});
			});
		}
	}

	private resolveFileRename(oldname: string, newname: string) {
		const oldhash = Crypto.createHash("md5").update(oldname).digest("hex");
		const newhash = Crypto.createHash("md5").update(newname).digest("hex");

		const oldDocId = "doc." + this.wsId + "." + oldhash;
		const newDocId = "doc." + this.wsId + "." + newhash;

		if (!this.docs[oldDocId]) {
			this._log.trace("Attempted to resolve file rename, but couldn't find old file in shared workspace (non-text file?)", oldname, newname, oldhash);
			return;
		}
		if (this.docs[newDocId]) {
			this._log.warn("WARNING: Attempted to resolve file rename, but the new name already exists in the workspace", oldname, newname, newhash);
			return;
		}

		this._log.trace("Resolving File Remame", oldname, newname, oldhash, newhash);

		const doc = this.docs[oldDocId];
		delete this.docs[oldDocId];
		this.docs[newDocId] = doc;

		doc.changeDocId(newDocId);

		this.emit("data", "ws.rename", {
			oldname: oldname,
			newname: newname,
			oldDocId: oldDocId,
			newDocId: newDocId
		});
	}

	private resolveFileDelete(filename: string) {
		const hash = Crypto.createHash("md5").update(filename).digest("hex");
		const docId = "doc." + this.wsId + "." + hash;

		if (!this.docs[docId]) {
			this._log.trace("Attempted to resolve file delete, but couldn't find file in shared workspace (non-text file?)", filename, hash);
			return;
		}

		this._log.trace("Resolving File Delete", filename);

		const doc = this.docs[docId];
		delete this.docs[docId];
		doc.destroy();

		this.emit("data", "ws.delete", {
			filename: filename,
			docId: docId
		});
	}

	public beginOctaveRequest(flavor: string) {
		// Before actually performing the Octave request, ensure that
		// pre-conditions are satisfied.
		Async.auto<BeginOctaveRequestAsyncAuto>({
			user: (next) => {
				if (this.shareKey && !this.user) {
					User.findOne({ share_key: this.shareKey }, next);
				} else {
					process.nextTick(() => {
						next(null, this.user);
					});
				}
			},
			ready: ["user", ({user}, next) => {
				this.user = user;
				if (user) {
					this.emit("data", "userinfo", user);
					if (!this.wsId) {
						this.setWsId(user.parametrized, true);
						this._log.info("Connecting to student:", user.consoleText);
					}
				} else if (!this.wsId) {
					this._log.warn("WARNING: Could not find student with share key", this.shareKey);
					this.emit("message", "Could not find the specified workspace.  Please check your URL and try again.");
					this.emit("data", "destroy-u", "No Such Workspace");
					return;
				}
				this.doBeginOctaveRequest(flavor);
				next(null);
			}]
		}, (err) => {
			if (err) this._log.error("ASYNC ERROR", err);
		});
	}

	private doBeginOctaveRequest(flavor: string) {
		Async.waterfall([
			(next: (err: Err, sessCode: string) => void) => {
				// Check if there is a sessCode in Redis already.
				redisMessenger.getWorkspaceSessCode(this.wsId, next);
			},
			(sessCode: string, next: (err: Err, sessCode: string, state: SessionState) => void) => {
				if (this.destroyed) return;
				this.sessCode = sessCode;

				// Make sure that sessCode is still live.
				octaveHelper.getNewSessCode(sessCode, next);
			},
			(sessCode: string, state: SessionState, next: (err: Err, result: any) => void) => {
				if (this.destroyed) return;
				this._log.trace("SessCode State:", state);

				// Ask Octave for a session if we need one.
				if (state === SessionState.Needed) {
					redisMessenger.setWorkspaceSessCode(this.wsId, sessCode, this.sessCode, next);

				// Request a file listing if we need one
				} else if (state === SessionState.Live) {
					this.emit("sesscode", sessCode);
					this.emit("data", "prompt", {});
					this.emit("data", "files-ready", {});
					this.emit("back", "list", {});

				// No action necessary
				} else {
					this.emit("sesscode", sessCode);
				}
			},
			(results: any[], next: (err: Err) => void) => {
				const saved: boolean = results[0];
				const sessCode: string = results[1];
				if (!saved) return;
				this.sessCode = sessCode;

				// Our sessCode was accepted.
				// Broadcast the new sessCode.
				redisMessenger.workspaceMsg(this.wsId, "sesscode", sessCode);
				this.touch();

				// Start the new Octave session.
				this._log.info("Sending Octave Request for Shared Workspace");
				octaveHelper.askForOctave(this.sessCode, {
					user: this.user,
					bucket: this.bucket,
					flavor
				}, next);
			}
		], (err) => {
			if (err) this._log.error("REDIS ERROR", err);
		});
	}

	public subscribe() {
		this.unsubscribe();

		wsSessClient.on("ws-sub", this.wsMessageListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, config.redis.expire.interval);
		this.statsInterval = setInterval(this.recordStats, config.ot.stats_interval);

		this.forEachDoc((docId, doc) => {
			doc.subscribe();
			doc.on("data", this.onDataO);
		});
	}

	public unsubscribe() {
		wsSessClient.removeListener("ws-sub", this.wsMessageListener);
		clearInterval(this.touchInterval);
		clearInterval(this.statsInterval);

		this.forEachDoc((docId, doc) => {
			doc.unsubscribe();
			doc.removeListener("data", this.onDataO);
		});
	}

	private touch = () => {
		if (!this.wsId) return;
		redisMessenger.touchWorkspace(this.wsId);
	};

	//// SHARED WORKSPACE HANDLERS ////

	private wsMessageListener = (wsId: string, type: string, data: any) => {
		if (wsId !== this.wsId) return;
		if (!data) return;

		this.wsMessageCounter++;

		let i;

		switch(type){
			case "sesscode":
				this.emit("sesscode", data);
				break;

			case "user-action":
				i = this.msgIds.indexOf(data.id);
				if (i > -1) this.msgIds.splice(i, 1);
				else {
					this.emit("data", data.name as string, data.data);

					// Special handlers for a few user actions
					switch(data.name){
						case "ws.save":
							this.resolveFileSave(data.data);
							break;
					}
				}
				break;

			default:
				break;
		}
	};

	// This function publishes selected actions into the Redis channel.
	// Clients on the same channel will resolve those messages in their
	// "wsMessageListener" function.
	private onUserAction = (name: string, value: any) => {
		let eventName, data;

		switch(name){
			case "data":
				eventName = "ws.command";
				data = value.data;
				break;

			case "save":
				eventName = "ws.save";
				data = value;
				break;

			default:
				return;
		}

		const msgId = Uuid.v4();
		this.msgIds.push(msgId);

		redisMessenger.workspaceMsg(this.wsId, "user-action", {
			id: msgId,
			name: eventName,
			data: data
		});
	};

	private onDataO = (name: string, value: any) => {
		this.emit("data", name, value);
	};

	private recordStats = () => {
		let opsReceivedTotal = 0, setContentTotal = 0;
		this.forEachDoc(function(docId,doc){
			opsReceivedTotal += doc.opsReceivedCounter;
			setContentTotal += doc.setContentCounter;
		});
		this._log.debug("STATS:",
			this.otEventCounter, "OT events and",
			this.wsMessageCounter, "WS messages and",
			opsReceivedTotal, "operations received and",
			setContentTotal, "calls to setContent");
	}
}
