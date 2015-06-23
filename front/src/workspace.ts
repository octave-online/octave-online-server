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
	private docIds:string[] = [];
	public wsId:string;

	constructor(wsId:string) {
		super();
		this.wsId = wsId;
		this.subscribe();
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
		var oldSessCode;
		Async.waterfall([
			(next) => {
				// Check if there is a sessCode in Redis already.
				otOperationClient.get(IRedis.Chan.wsSess(this.wsId), next);
			},
			(sessCode: string, next) => {
				oldSessCode = sessCode;

				// Make sure that sessCode is still live.
				RedisHelper.getNewSessCode(sessCode, next);
			},
			(sessCode: string, needsOctave: boolean, next) => {
				if (needsOctave) {
					// It wasn't alive.  Attempt to save the new sessCode.
					var casScript = 'local k=redis.call("GET",KEYS[1]); print(k); if k==false or k==ARGV[2] then redis.call("SET",KEYS[1],ARGV[1]); return {true,ARGV[1]}; end; return {false,k};';
					otOperationClient.eval(casScript, 1, IRedis.Chan.wsSess(this.wsId),
						sessCode, oldSessCode, next);

				} else {
					// It is alive.  Connect the client.
					this.emit("sesscode", sessCode);
				}
			},
			([saved, sessCode], next) => {
				if (saved) {
					// Our sessCode was accepted.
					// Get an Octave session running and broadcast the new sessCode.
					RedisHelper.askForOctave(sessCode, null, next);
					otOperationClient.publish(IRedis.Chan.wsSub(this.wsId),
						JSON.stringify({
							type: "sesscode",
							sesscode: sessCode
						}));
				}

				// Doesn't hurt to inform our client of the sessCode.
				this.emit("sesscode", sessCode);
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
		var obj = IRedis.checkWsMessage(channel, message, this.wsId);
		if (!obj) return;

		if (obj.type === "sesscode") {
			this.emit("sesscode", obj.data);
		}
	};

	///

	public onSocket = (name:string, val:any) => {
		switch(name){
			case "ot.subscribe":
				this.onOtSubscribe(val);
				break;
			case "ot.change":
				this.onOtChange(val);
				break;
			case "ot.cursor":
				this.onOtCursor(val);
				break;
			default:
				break;
		}
	}

	private onOtSubscribe = (obj) => {
		if (!obj
			|| typeof obj.docId === "undefined")
			return;

		console.log("here")
		this.docIds.push(obj.docId);
		this.getOtDoc(obj.docId);
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
		// this.socket.emit("ot.cursor", cursor);
	};
}

export = Workspace;