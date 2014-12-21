///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import Util = require("util");

// Hack to add multi() to the TypeScript RedisClient interface
interface IRedisClient extends Redis.RedisClient {
	multi(commands?:any[]):IRedisClient;
	exec(cb);
}
var outputClient:IRedisClient = <IRedisClient> Redis.createClient();
var pushClient:IRedisClient = <IRedisClient> Redis.createClient();
var infoClient:IRedisClient = <IRedisClient> Redis.createClient();
outputClient.psubscribe("oo.output:*");

interface IRedisMessage {
	name:string
	data:any
}

var disconnectMessage:IRedisMessage = {
	name: "disconect",
	data: {}
};

class RedisHandler extends EventEmitter2.EventEmitter2 {
	public sessCode:string;
	private ready:boolean = false;

	constructor(sessCode:string) {
		super();
		this.sessCode = sessCode;

		if (!this.sessCode) {
			// Case 1: No sessCode given
			Util.log("Case 1: No sessCode given");
			this.makeSessCode(()=> {
				this.askForOctave();
				this.subscribe();
			});

		} else {
			this.isValid((valid:boolean)=> {

				if (valid) {
					// Case 2: Valid sessCode given
					Util.log("Case 2: Valid sessCode given");
					this.subscribe();

				} else {
					// Case 3: Invalid sessCode given
					Util.log("Case 3: Invalid sessCode given");
					this.makeSessCode(()=> {
						this.askForOctave();
						this.subscribe();
					});
				}
			});
		}
	}

	public input(obj:IRedisMessage) {
		if (!this.ready) return;
		pushClient.publish("oo.input:" + this.sessCode, JSON.stringify(obj));
	}

	public close() {
		this.unsubscribe();

		var multi = pushClient.multi();
		multi.publish("oo.input:" + this.sessCode, JSON.stringify(disconnectMessage));
		multi.del("oo.online:" + this.sessCode);
		multi.exec((err)=> {
			if (err) return console.log("REDIS ERROR", err);
		});
	}

	private makeSessCode(next) {
		Util.log("Starting to make sessCode");
		Crypto.pseudoRandomBytes(12, (err, buf) => {
			if (err) {
				return next(err);
			}

			this.sessCode = buf.toString("hex");
			this.emit("oo.sesscode", this.sessCode);
			Util.log("Made sessCode: " + this.sessCode);

			next();
		});
	}

	private isValid(next) {
		infoClient.exists("oo.online:" + this.sessCode, (err, exists)=> {
			if (err) return console.log("REDIS ERROR", err);
			next(exists);
		});
	}

	private askForOctave() {
		var multi = pushClient.multi();
		multi.rpush("oo.needs-octave", this.sessCode);
		multi.set("oo.online:" + this.sessCode, true);
		multi.exec((err)=> {
			if (err) return console.log("REDIS ERROR", err);
		});
	}

	private subscribe() {
		outputClient.on("pmessage", this.pMessageListener);
		this.ready = true;
	}

	private unsubscribe() {
		outputClient.removeListener("pmessage", this.pMessageListener);
		this.ready = false;
	}

	private pMessageListener = (pattern, channel, message) => {
		var match = /^oo\.output:(\w+)$/.exec(channel);
		if (!match) return;
		if (match[1] !== this.sessCode && match[1] !== "broadcast") return;

		var obj:IRedisMessage;
		try {
			obj = JSON.parse(message);
		} catch (e) {
			return console.log("JSON PARSE ERROR", e);
		}
		if (!obj.name) return;

		this.emit("oo.data", obj);
	};
}

export = RedisHandler;