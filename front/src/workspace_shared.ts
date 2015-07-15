///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/uuid.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/iworkspace.ts'/>

import Redis = require("redis");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import OctaveHelper = require("./octave_session_helper");
import OtDocument = require("./ot_document");
import Uuid = require("uuid");
import Async = require("async");

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
	private user:IUser;
	private docs:OtDocument[] = [];
	private cmdIds:string[] = [];

	constructor(wsId:any, user:IUser) {
		super();
		this.wsId = <string> wsId;
		this.user = user;
		this.subscribe();

		wsPushClient.incr(IRedis.Chan.wsCnt(this.wsId));

		// FIXME
		this.docs.push(new OtDocument(this.wsId + "-prompt"));
	}

	public destroyD(message:string){
		this.destroyed = true;
		var sessCode = this.sessCode;

		wsPushClient.decr(IRedis.Chan.wsCnt(this.wsId),
			function(cnt){

			// Tell the Octave session to destroy only if we were
			// the last client connected to this workspace
			if (!cnt) {
				OctaveHelper.sendDestroyD(sessCode, message);
			}
		});
	}

	public destroyU(message:string){
	}

	public dataD(name:string, value:any) {
		if (!name) name = "";
		if (!value) value = {};

		// Pass OT events down to the OT instances
		if (name.substr(0,3) === "ot.") {
			this.docs.forEach(function(doc){ doc.dataD(name, value) });
		}

		// Handle other events here
		switch(name){
			case "ws.command":
				this.onCommand(value.data);

			default:
				break;
		}
	}

	public beginOctaveRequest() {
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
			(sessCode: string, needsOctave: boolean, next) => {
				if (this.destroyed) return;

				// Ask Octave for a session if we need one.
				if (needsOctave) {
					// Perform a Compare-And-Swap operation (this is oddly not
					// in core Redis, so a Lua script is required)
					var casScript = 'local k=redis.call("GET",KEYS[1]); print(k); if k==false or k==ARGV[2] then redis.call("SET",KEYS[1],ARGV[1]); return {true,ARGV[1]}; end; return {false,k};';
					wsPushClient.eval(casScript, 1, IRedis.Chan.wsSess(this.wsId),
						sessCode, this.sessCode, next);

				}
				else
					this.emit("sesscode", sessCode, true);

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
				OctaveHelper.askForOctave(this.sessCode, null, next);
			}
		], (err) => {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	public subscribe() {
		this.unsubscribe();

		wsSessClient.on("pmessage", this.wsMessageListener);

		var self = this;
		this.docs.forEach(function(doc){
			doc.subscribe();
			doc.on("data", self.onDataO);
		});
	};

	public unsubscribe() {
		wsSessClient.removeListener("pmessage", this.wsMessageListener);

		var self = this;
		this.docs.forEach(function(doc){
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
				this.emit("sesscode", obj.data, false);
				break;

			case "command":
				var i = this.cmdIds.indexOf(obj.data.id);
				if (i > -1) this.cmdIds.splice(i, 1);
				else this.emit("data", "ws.command", obj.data.cmd);
				break;

			default:
				break;
		}
	};

	private onCommand = (cmd) => {
		var cmdId = Uuid.v4();
		this.cmdIds.push(cmdId);

		wsPushClient.publish(IRedis.Chan.wsSub(this.wsId), JSON.stringify({
			type: "command",
			data: {
				id: cmdId,
				cmd: cmd
			}
		}));
	};

	private onDataO = (name, value) => {
		this.emit("data", name, value);
	};
};

export = SharedWorkspace;