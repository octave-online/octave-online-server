///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/uuid.d.ts'/>
///<reference path='typedefs/ot.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import Uuid = require("uuid");
import Fs = require("fs");
import Ot = require("ot");

// Load the Lua script
var otLuaScript = Fs.readFileSync("src/ot.lua", { encoding: "utf8" });
otLuaScript += Fs.readFileSync("src/ot_redis.lua", { encoding: "utf8" });
otLuaScript = otLuaScript.replace(/function/g, "local function");
var otLuaSha1 = Crypto.createHash("sha1").update(otLuaScript).digest("hex");

var outputClient = IRedis.createClient();
var pushClient = IRedis.createClient();
var destroyUClient = IRedis.createClient();
var expireClient = IRedis.createClient();
var otOperationClient = IRedis.createClient();
var otListenClient = IRedis.createClient();
outputClient.psubscribe(IRedis.Chan.output("*"));
destroyUClient.subscribe(IRedis.Chan.destroyU);
expireClient.subscribe("__keyevent@0__:expired");
otListenClient.psubscribe(IRedis.Chan.otSub("*"));

outputClient.setMaxListeners(30);
destroyUClient.setMaxListeners(30);
expireClient.setMaxListeners(30);
otListenClient.setMaxListeners(30);

class RedisHandler extends EventEmitter2.EventEmitter2 {
	public sessCode:string = null;
	private chgIds:string[] = [];

	constructor() {
		super();
	}

	public setSessCode(sessCode:string) {
		this.sessCode = sessCode;
		this.touch();
	}

	public input(name:string, data:any) {
		var inputMessage:IRedis.Message = {
			name: name,
			data: data
		};

		pushClient.publish(IRedis.Chan.input(this.sessCode), JSON.stringify(inputMessage));
	}

	public destroyD(message:string) {
		if (!this.depend(["sessCode"])) return;

		console.log("Sending Destroy-D", message, this.sessCode);
		var destroyMessage:IRedis.DestroyMessage = {
			sessCode: this.sessCode,
			message: message
		};

		// Tell Redis to destroy our sessCode
		var multi = pushClient.multi();
		multi.del(IRedis.Chan.session(this.sessCode));
		multi.del(IRedis.Chan.input(this.sessCode));
		multi.del(IRedis.Chan.output(this.sessCode));
		multi.zrem(IRedis.Chan.needsOctave, this.sessCode);
		multi.publish(IRedis.Chan.destroyD, JSON.stringify(destroyMessage));
		multi.exec((err)=> {
			if (err) console.log("REDIS ERROR", err);
		});
	}

	public getOtDoc(docId:string) {
		var multi = otOperationClient.multi();
		multi.llen(IRedis.Chan.otOps(docId));
		multi.get(IRedis.Chan.otDoc(docId));
		multi.exec((err, res)=> {
			if (err) console.log("REDIS ERROR", err);
			else {
				this.emit("ot:doc", docId, res[0], res[1]);
			}
		});
	}

	public receiveOperation(docId:string, rev:number, op:Ot.ITextOperation) {
		var ops_key = IRedis.Chan.otOps(docId);
		var doc_key = IRedis.Chan.otDoc(docId);
		var sub_key = IRedis.Chan.otSub(docId);
		var chgId = Uuid.v4();

		var message:IRedis.OtMessage = {
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

	public subscribe() {
		// Prevent duplicate listeners
		this.unsubscribe();

		// Create listeners to Redis
		outputClient.on("pmessage", this.pMessageListener);
		destroyUClient.on("message", this.destroyUListener);
		expireClient.on("message", this.expireListener);
		otListenClient.on("pmessage", this.otMessageListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, Config.redis.expire.interval * 1000);
	}

	public unsubscribe() {
		outputClient.removeListener("pmessage", this.pMessageListener);
		outputClient.removeListener("pmessage", this.pMessageListener);
		destroyUClient.removeListener("message", this.destroyUListener);
		expireClient.removeListener("message", this.expireListener);
		clearInterval(this.touchInterval);
	}

	private touchInterval;

	private touch = () => {
		if (!this.depend(["sessCode"])) return;

		var multi = pushClient.multi();
		multi.expire(IRedis.Chan.input(this.sessCode), Config.redis.expire.timeout);
		multi.expire(IRedis.Chan.session(this.sessCode), Config.redis.expire.timeout);
		multi.exec((err)=> {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	private depend(props) {
		for (var i = 0; i < props.length; i++){
			if (!this[props[i]]) {
				console.log("UNMET DEPENDENCY", props[i]);
				return false;
			}
		}
		return true;
	};

	private pMessageListener = (pattern, channel, message) => {
		if (!this.depend(["sessCode"])) return;

		var obj = IRedis.checkPMessage(channel, message, this.sessCode);
		if (obj) this.emit("data", obj.name, obj.data);
	};

	private destroyUListener = (channel, message) => {
		if (!this.depend(["sessCode"])) return;

		var _message = IRedis.checkDestroyMessage(message, this.sessCode);
		if (!_message) return;

		this.emit("destroy-u", _message);
	};

	private expireListener = (channel, message) => {
		if (!this.depend(["sessCode"])) return;

		if(IRedis.checkExpired(message, this.sessCode)){
			// If the session becomes expired, trigger a destroy event
			// both upstream and downstream.
			this.destroyD("Octave Session Expired");
			this.emit("destroy-u", "Octave Session Expired");
		}
	};

	private otMessageListener = (pattern, channel, message) => {
		var obj = IRedis.checkOtMessage(channel, message);
		if (obj) {
			var i = this.chgIds.indexOf(obj.chgId);
			if (i > -1) {
				this.chgIds.splice(i, 1);
				this.emit("ot:ack", obj.docId);
			} else {
				this.emit("ot:broadcast", obj.docId, obj.ops);
			}
		}
	};
}

export = RedisHandler;