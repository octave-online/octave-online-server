///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/uuid.d.ts'/>
///<reference path='typedefs/ot.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import RedisHelper = require("./redis_helper");
import Uuid = require("uuid");
import Fs = require("fs");
import Ot = require("ot");
import Async = require("async");

// Load the Lua script
var otLuaScript = Fs.readFileSync("src/ot.lua", { encoding: "utf8" });
otLuaScript += Fs.readFileSync("src/ot_redis.lua", { encoding: "utf8" });
otLuaScript = otLuaScript.replace(/function/g, "local function");
var otLuaSha1 = Crypto.createHash("sha1").update(otLuaScript).digest("hex");

var otOperationClient = IRedis.createClient();
var otListenClient = IRedis.createClient();
var wsSessClient = IRedis.createClient();
otListenClient.psubscribe(IRedis.Chan.otSub("*"));
wsSessClient.psubscribe(IRedis.Chan.wsSub("*"));

otListenClient.setMaxListeners(30);
wsSessClient.setMaxListeners(30);

class Workspace extends EventEmitter2.EventEmitter2 {
	private chgIds:string[] = [];
	private cmdIds:string[] = [];
	private crsIds:string[] = [];
	private docIds:string[] = [];
	public wsId:string;

	constructor(wsId:string) {
		super();
		this.wsId = wsId;
		this.subscribe();
		this.updateDocIds();
	}

	public input(name: string, data: any) {
		var inputMessage: IRedis.Message = {
			name: name,
			data: data
		};

		// IMPLEMENT ME
	}

	public clientDisconnect(){
		// IMPLEMENT ME
	}

	public getOtDoc(docId: string) {
		var multi = otOperationClient.multi();
		multi.llen(IRedis.Chan.otOps(docId));
		multi.get(IRedis.Chan.otDoc(docId));
		multi.exec((err, res) => {
			if (err) console.log("REDIS ERROR", err);
			else {
				this.emit("data", "ot.doc", {
					docId: docId,
					rev: res[0],
					content: res[1]
				});
			}
		});
	}

	public receiveOperation(docId: string, rev: number, op: Ot.ITextOperation) {
		var ops_key = IRedis.Chan.otOps(docId);
		var doc_key = IRedis.Chan.otDoc(docId);
		var sub_key = IRedis.Chan.otSub(docId);
		var chgId = Uuid.v4();

		var message: IRedis.OtMessage = {
			docId: docId,
			chgId: chgId,
			ops: op.toJSON()
		}

		otOperationClient.evalsha(otLuaSha1, 3, ops_key, doc_key, sub_key,
			rev, JSON.stringify(message), function(err) {
				if (!err) return;
				if (/NOSCRIPT/.test(err.message)) {
					otOperationClient.eval(otLuaScript, 3, ops_key, doc_key, sub_key,
						rev, JSON.stringify(message), function(err2) {
							if (err2) console.log("REDIS ERROR", err);
						});
				}
			});

		this.chgIds.push(chgId);
	}

	public beginOctaveRequest() {
		var _sessCode;
		Async.waterfall([
			(next) => {
				// Check if there is a sessCode in Redis already.
				otOperationClient.get(IRedis.Chan.wsSess(this.wsId), next);
			},
			(sessCode: string, next) => {
				_sessCode = sessCode;

				// Make sure that sessCode is still live.
				RedisHelper.getNewSessCode(sessCode, next);
			},
			(sessCode: string, needsOctave: boolean, next) => {
				if (needsOctave) {
					// It wasn't alive.  Attempt to save the new sessCode.
					var casScript = 'local k=redis.call("GET",KEYS[1]); print(k); if k==false or k==ARGV[2] then redis.call("SET",KEYS[1],ARGV[1]); return {true,ARGV[1]}; end; return {false,k};';
					otOperationClient.eval(casScript, 1, IRedis.Chan.wsSess(this.wsId),
						sessCode, _sessCode, next);

				} else {
					// It is alive.  Connect the client.
					this.emit("sesscode", sessCode, true);
				}
			},
			([saved, sessCode], next) => {
				console.log("hihi", saved, sessCode);
				_sessCode = sessCode;

				if (saved) {
					// Our sessCode was accepted.
					// Broadcast the new sessCode.
					otOperationClient.publish(IRedis.Chan.wsSub(this.wsId),
						JSON.stringify({
							type: "sesscode",
							data: sessCode
						}), next);
				}

				// Doesn't hurt to inform our client of the sessCode early.
				this.emit("sesscode", sessCode, false);
			},
			(_, next) => {
				console.log("requesting octave session");
				// Start the new Octave session.
				RedisHelper.askForOctave(_sessCode, null, next);
			}
		], (err) => {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	public subscribe() {
		// Prevent duplicate listeners
		this.unsubscribe();

		// Create listeners to Redis
		otListenClient.on("pmessage", this.otMessageListener);
		wsSessClient.on("pmessage", this.wsMessageListener);
	}

	public unsubscribe() {
		otListenClient.removeListener("pmessage", this.otMessageListener);
		wsSessClient.removeListener("pmessage", this.wsMessageListener);
	}

	private updateDocIds() {
		this.docIds = [];
		// this is a makeshift implementation.  FIXME later.
		this.docIds.push(this.wsId + "-prompt");
		this.getOtDoc(this.wsId + "-prompt");
	}

	private destroyUListener = (channel, message) => {
		// IMPLEMENT ME
		this.emit("destroy-u", message);
	};

	private otMessageListener = (pattern, channel, message) => {
		var obj = IRedis.checkOtMessage(channel, message);
		if (obj && this.docIds.indexOf(obj.docId) > -1) {
			var i = this.chgIds.indexOf(obj.chgId);
			if (i > -1) {
				this.chgIds.splice(i, 1);
				this.emit("data", "ot.ack", {
					docId: obj.docId
				});
			} else {
				this.emit("data", "ot.broadcast", {
					docId: obj.docId,
					ops: obj.ops
				});
			}
		}
	};

	private wsMessageListener = (pattern, channel, message) => {
		console.log("on ws message", pattern, channel, message);
		var obj = IRedis.checkWsMessage(channel, message, this.wsId);
		if (!obj || !obj.data) return;

		if (obj.type === "sesscode") {
			this.emit("sesscode", obj.data, false);

		} else if (obj.type === "command") {
			var i = this.cmdIds.indexOf(obj.data.id);
			if (i > -1) this.cmdIds.splice(i, 1);
			else this.emit("data", "ws.command", obj.data.cmd);

		} else if (obj.type === "cursor") {
			var i = this.crsIds.indexOf(obj.data.id);
			if (i > -1) this.crsIds.splice(i, 1);
			else this.emit("data", "ot.cursor", obj.data.cursor);

		}
	};

	///

	public onSocket =  (name:string , val:any) => {
		if (!val) val = {};
		console.log("on socket", name, val);
		switch(name){
			case "ot.change":
				this.onOtChange(val);
				break;
			case "ot.cursor":
				this.onOtCursor(val);
				break;
			case "ws.command":
				this.onCommand(val.data);
			default:
				break;
		}
	}

	private onOtChange = (obj) => {
		console.log("ot in:", obj);
		if (!obj
			|| typeof obj.op === "undefined"
			|| typeof obj.rev === "undefined"
			|| typeof obj.docId === "undefined")
			return;
		if (this.docIds.indexOf(obj.docId) === -1) return;

		var op = Ot.TextOperation.fromJSON(obj.op);
		this.receiveOperation(obj.docId, obj.rev, op);
	};

	private onOtCursor = (cursor) => {
		if (!cursor) return;

		var crsId = Uuid.v4();
		this.crsIds.push(crsId);
		otOperationClient.publish(IRedis.Chan.wsSub(this.wsId), JSON.stringify({
			type: "cursor",
			data: {
				id: crsId,
				cursor: cursor
			}
		}));
	};

	private onCommand = (cmd) => {
		var cmdId = Uuid.v4();
		this.cmdIds.push(cmdId);

		otOperationClient.publish(IRedis.Chan.wsSub(this.wsId), JSON.stringify({
			type: "command",
			data: {
				id: cmdId,
				cmd: cmd
			}
		}));
	};
};

export = Workspace;