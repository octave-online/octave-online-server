///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");

var outputClient = IRedis.createClient();
var pushClient = IRedis.createClient();
var destroyUClient = IRedis.createClient();
var expireClient = IRedis.createClient();
outputClient.psubscribe(IRedis.Chan.output("*"));
destroyUClient.subscribe(IRedis.Chan.destroyU);
expireClient.subscribe("__keyevent@0__:expired");

outputClient.setMaxListeners(30);
destroyUClient.setMaxListeners(30);
expireClient.setMaxListeners(30);

class RedisHandler extends EventEmitter2.EventEmitter2 {
	public sessCode:string;

	constructor(sessCode:string) {
		super();
		this.sessCode = sessCode;

		// Add event listeners for Redis
		this.subscribe();
	}

	public input(name:string, data:any) {
		var inputMessage:IRedis.Message = {
			name: name,
			data: data
		};

		pushClient.publish(IRedis.Chan.input(this.sessCode), JSON.stringify(inputMessage));
	}

	public destroyD(message:string) {
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

		// Relieve local memory
		this.unsubscribe();
	}

	private touchInterval;

	private touch = () => {
		var multi = pushClient.multi();
		multi.expire(IRedis.Chan.input(this.sessCode), Config.redis.expire.timeout);
		multi.expire(IRedis.Chan.session(this.sessCode), Config.redis.expire.timeout);
		multi.exec((err)=> {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	private subscribe() {
		outputClient.on("pmessage", this.pMessageListener);
		destroyUClient.on("message", this.destroyUListener);
		expireClient.on("message", this.expireListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, Config.redis.expire.interval * 1000);
	}

	private unsubscribe() {
		outputClient.removeListener("pmessage", this.pMessageListener);
		destroyUClient.removeListener("message", this.destroyUListener);
		expireClient.removeListener("message", this.expireListener);
		clearInterval(this.touchInterval);
	}

	private pMessageListener = (pattern, channel, message) => {
		var obj = IRedis.checkPMessage(channel, message, this.sessCode);
		if (obj) this.emit("data", obj.name, obj.data);
	};

	private destroyUListener = (channel, message) => {
		var _message = IRedis.checkDestroyMessage(message, this.sessCode);

		if (_message) {
			this.emit("destroy-u", _message);
			this.unsubscribe();
		}
	};

	private expireListener = (channel, message) => {
		if(IRedis.checkExpired(message, this.sessCode)){
			// If the session becomes expired, trigger a destroy event
			// both upstream and downstream.
			this.destroyD("Octave Session Expired");
			this.emit("destroy-u", "Octave Session Expired");
		}
	};
}

export = RedisHandler;