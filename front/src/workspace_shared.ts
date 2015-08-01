///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/uuid.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/iworkspace.ts'/>

import User = require("./user_model");
import Redis = require("redis");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import OctaveHelper = require("./octave_session_helper");
import OtDocument = require("./ot_document");
import Uuid = require("uuid");
import Async = require("async");
import Crypto = require("crypto");

// Make Redis connections for Shared Workspace
var wsPushClient = IRedis.createClient();
var wsSessClient = IRedis.createClient();
wsSessClient.psubscribe(IRedis.Chan.wsSub("*"));

wsSessClient.setMaxListeners(30);

class SharedWorkspace
extends EventEmitter2.EventEmitter2
implements IWorkspace {
	public wsId:string;
	public sessCode:string;
	public destroyed:boolean = false;
	private userId:string = null;
	private user:IUser = null;
	private docs:any = {};
	private msgIds:string[] = [];

	constructor(type:string, info:any) {
		super();

		switch(type){
			case "student":
				this.userId = <string> info;
				break;

			case "default":
			default:
				this.setWsId(<string> info);
				break;
		}

		this.subscribe();
	}

	private setWsId(wsId:string) {
		if (this.wsId) {
			if (this.wsId !== wsId)
				console.log("SHARED WORKSPACE ERROR: Trying to set wsId to",
					wsId, "when it was already set to", this.wsId);
			return;
		}

		this.wsId = wsId;

		// Create the prompt's OtDocument (every session)
		// Never emit from constructors since there are no listeners yet;
		// use process.nextTick() instead
		var promptId = "prompt." + this.wsId;
		process.nextTick(function(){
			this.emit("data", "ws.promptid", promptId);
			this.docs[promptId] = new OtDocument(promptId);
			this.subscribe();
		}.bind(this));
	}

	private forEachDoc(fn:(docId:string,doc:OtDocument)=>void){
		Object.getOwnPropertyNames(this.docs).forEach(function(docId){
			fn(docId, this.docs[docId]);
		}.bind(this));
	}

	public destroyD(message:string){
		this.destroyed = true;

		// The Octave session will be destroyed by expiring keys once all
		// users have disconnected.  There is no need to destroy it here.
	}

	public destroyU(message:string){
	}

	public dataD(name:string, value:any) {
		if (!name) name = "";
		if (!value) value = {};

		// NOTE: Remember that each downstream event occurs on just one instance
		// of IWorkspace, but upstream events occur on ALL listening instances.

		console.log("Resolving dataD", name, value);

		// Pass OT events down to the OT instances
		if (name.substr(0,3) === "ot.") {
			this.forEachDoc(function(docId,doc){ doc.dataD(name, value) });
			return;
		}

		// A few special handlers
		if (name === "save") {
			// happens when the user saves a file OR creates a new file
			this.resolveFileSave(value, true);
		}

		// Pass other events into the onUserAction handler
		this.onUserAction(name, value);
	}

	public dataU(name:string, value:any) {
		if (!name) name = "";
		if (!value) value = {};

		// NOTE: Remember that each downstream event occurs on just one instance
		// of IWorkspace, but upstream events occur on ALL listening instances.

		console.log("Resolving dataU", name, value);

		// A few special handlers
		if (name === "user") {
			// happens when the full list of files is read
			this.resolveFileList(value.files);

		} else if (name === "fileadd") {
			// happens when SIOFU uploads a file
			this.resolveFileAdd(value, true);

		} else if (name === "renamed") {
			// happens when a file is successfully renamed
			this.resolveFileRename(value.oldname, value.newname);

		} else if (name === "deleted") {
			// happens when a file is deleted
			this.resolveFileDelete(value.filename);
		}
	}

	private resolveFileList(files:any){
		var files = files || {};
		for(var filename in files){
			if (!files.hasOwnProperty(filename)) continue;
			var file = files[filename];
			if (!file.isText) continue;
			var content = new Buffer(file.content, "base64").toString();
			this.resolveFile(filename, content, true);
		}
	}

	private resolveFileAdd(file:any, updateRedis:boolean){
		if (!file.isText) return;

		var content = new Buffer(file.content, "base64").toString();
		this.resolveFile(file.filename, content, updateRedis);
	}

	private resolveFileSave(file:any, updateRedis:boolean){
		this.resolveFile(file.filename, file.content, updateRedis);
	}

	private resolveFile(filename:string, content:string,
			updateRedis:boolean) {
		var hash = Crypto.createHash("md5").update(filename).digest("hex");
		var docId = "doc." + this.wsId + "." + hash;

		console.log("Resolving file", filename, docId, updateRedis);

		if (!this.docs[docId]) {
			this.docs[docId] = new OtDocument(docId);
			this.subscribe();
			process.nextTick(function(){
				this.emit("data", "ws.doc", {
					docId: docId,
					filename: filename
				});
			}.bind(this));
		}

		if (updateRedis) this.docs[docId].setContent(content);
	}

	private resolveFileRename(oldname:string, newname:string) {
		var oldhash = Crypto.createHash("md5").update(oldname).digest("hex");
		var newhash = Crypto.createHash("md5").update(newname).digest("hex");

		var oldDocId = "doc." + this.wsId + "." + oldhash;
		var newDocId = "doc." + this.wsId + "." + newhash;

		if (!this.docs[oldDocId]) {
			console.log("WARNING: Attempted to resolve file rename, but couldn't find old file in shared workspace:", oldname, newname, oldDocId, newDocId);
			return;
		}

		if (this.docs[newDocId]) {
			console.log("WARNING: Attempted to resolve file rename, but the new name already exists in the workspace:", oldname, newname, oldDocId, newDocId);
			return;
		}

		var doc = this.docs[oldDocId];
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

	private resolveFileDelete(filename:string) {
		var hash = Crypto.createHash("md5").update(filename).digest("hex");
		var docId = "doc." + this.wsId + "." + hash;

		if (!this.docs[docId]) {
			console.log("WARNING: Attempted to resolve file delete, but couldn't find file in shared workspace:", filename, docId);
			return;
		}

		var doc = this.docs[docId];
		delete this.docs[docId];
		doc.destroy();

		this.emit("data", "ws.delete", {
			filename: filename,
			docId: docId
		});
	}

	public beginOctaveRequest() {
		// Before actually performing the Octave request, ensure that
		// pre-conditions are satisfied.
		Async.auto({
			user: (next) => {
				if (this.userId && !this.user) User.findById(this.userId, next);
				else next(null, this.user);
			},
			ready: ["user", (next, {user}) => {
				this.user = user;
				if (this.user) this.setWsId(this.user.parametrized);
				this.doBeginOctaveRequest();
			}]
		});
	}

	private doBeginOctaveRequest() {
		Async.waterfall([
			(next) => {
				// Check if there is a sessCode in Redis already.
				wsPushClient.get(IRedis.Chan.wsSess(this.wsId), next);
			},
			(sessCode: string, next) => {
				if (this.destroyed) return;
				this.sessCode = sessCode;

				// Make sure that sessCode is still live.
				OctaveHelper.getNewSessCode(sessCode, next);
			},
			(sessCode:string, state:IRedis.SessionState, next) => {
				if (this.destroyed) return;
				console.log("SessCode State:", state);

				// Ask Octave for a session if we need one.
				if (state === IRedis.SessionState.Needed) {
					// Perform a Compare-And-Swap operation (this is oddly not
					// in core Redis, so a Lua script is required)
					var casScript = 'local k=redis.call("GET",KEYS[1]); print(k); if k==false or k==ARGV[2] then redis.call("SET",KEYS[1],ARGV[1]); return {true,ARGV[1]}; end; return {false,k};';
					wsPushClient.eval(casScript, 1, IRedis.Chan.wsSess(this.wsId),
						sessCode, this.sessCode, next);

				// Request a file refresh if we need one
				} else if (state === IRedis.SessionState.Live) {
					this.emit("sesscode", sessCode);
					this.emit("data", "prompt", {});
					this.emit("back", "list", {});

				// No action necessary
				} else {
					this.emit("sesscode", sessCode);
				}
			},
			([saved, sessCode], next) => {
				if (!saved) return;
				this.sessCode = sessCode;

				// Our sessCode was accepted.
				// Broadcast the new sessCode.
				wsPushClient.publish(IRedis.Chan.wsSub(this.wsId),
					JSON.stringify({
						type: "sesscode",
						data: sessCode
					}), next);
			},
			(_, next) => {
				console.log("requesting octave session");
				// Start the new Octave session.
				OctaveHelper.askForOctave(this.sessCode, this.user, next);
			}
		], (err) => {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	public subscribe() {
		this.unsubscribe();

		wsSessClient.on("pmessage", this.wsMessageListener);

		var self = this;
		this.forEachDoc(function(docId,doc){
			doc.subscribe();
			doc.on("data", self.onDataO);
		});
	};

	public unsubscribe() {
		wsSessClient.removeListener("pmessage", this.wsMessageListener);

		var self = this;
		this.forEachDoc(function(docId,doc){
			doc.unsubscribe();
			doc.off("data", self.onDataO);
		});
	};

	//// SHARED WORKSPACE HANDLERS ////

	private wsMessageListener = (pattern, channel, message) => {
		console.log("on ws message", pattern, channel, message);
		var obj = IRedis.checkWsMessage(channel, message, this.wsId);
		if (!obj || !obj.data) return;

		switch(obj.type){
			case "sesscode":
				this.emit("sesscode", obj.data);
				break;

			case "user-action":
				var i = this.msgIds.indexOf(obj.data.id);
				if (i > -1) this.msgIds.splice(i, 1);
				else {
					this.emit("data", obj.data.name, obj.data.data);

					// Special handlers for a few user actions
					switch(obj.data.name){
						case "ws.save":
							this.resolveFileSave(obj.data.data, false);
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
	private onUserAction = (name, value) => {
		var eventName, data;

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

		var msgId = Uuid.v4();
		this.msgIds.push(msgId);

		wsPushClient.publish(IRedis.Chan.wsSub(this.wsId), JSON.stringify({
			type: "user-action",
			data: {
				id: msgId,
				name: eventName,
				data: data
			}
		}));
	};

	private onDataO = (name, value) => {
		this.emit("data", name, value);
	};
};

export = SharedWorkspace;