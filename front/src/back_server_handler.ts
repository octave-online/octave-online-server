///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import OctaveHelper = require("./octave_session_helper");
import Fs = require("fs");
import Attachment = require("./attachment");

var outputClient = IRedis.createClient();
var pushClient = IRedis.createClient();
var destroyUClient = IRedis.createClient();
var expireClient = IRedis.createClient();
outputClient.psubscribe(IRedis.Chan.output("*"));
destroyUClient.subscribe(IRedis.Chan.destroyU);
expireClient.subscribe("__keyevent@0__:expired");

outputClient.setMaxListeners(100);
destroyUClient.setMaxListeners(100);
expireClient.setMaxListeners(100);

class BackServerHandler extends EventEmitter2.EventEmitter2 {
	public sessCode:string = null;
	private touchInterval;
	private messageQueue = [];

	constructor() {
		super();
	}

	public setSessCode(sessCode:string) {
		this.sessCode = sessCode;
		this.touch();
	}

	public dataD(name:string, data:any) {
		if (this.sessCode === null) {
			this.emit("data", "alert", "ERROR: Please reconnect! Your action was not performed: " + name);
			return;
		}
		try {
			let messageString = Attachment.serializeMessage(name, data);
			pushClient.publish(IRedis.Chan.input(this.sessCode), messageString);
		} catch(err) {
			console.log("ATTACHMENT ERROR", err);
		}
	}

	public subscribe() {
		// Prevent duplicate listeners
		this.unsubscribe();

		// Create listeners to Redis
		outputClient.on("pmessage", this.pMessageListener);
		destroyUClient.on("message", this.destroyUListener);
		expireClient.on("message", this.expireListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, Config.redis.expire.interval * 1000);
	}

	public unsubscribe() {
		outputClient.removeListener("pmessage", this.pMessageListener);
		destroyUClient.removeListener("message", this.destroyUListener);
		expireClient.removeListener("message", this.expireListener);
		clearInterval(this.touchInterval);
	}

	private touch = () => {
		if (!this.depend(["sessCode"])) return;

		var multi = pushClient.multi();
		multi.expire(IRedis.Chan.input(this.sessCode), Config.redis.expire.timeout);
		multi.expire(IRedis.Chan.session(this.sessCode), Config.redis.expire.timeout);
		multi.exec((err)=> {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	private depend(props:string[], log:boolean=false) {
		for (var i = 0; i < props.length; i++){
			if (!this[props[i]]) {
				if (log) console.log("UNMET DEPENDENCY", props[i], arguments.callee.caller);
				return false;
			}
		}
		return true;
	};

	private pMessageListener = (pattern, channel, message) => {
		if (!this.depend(["sessCode"])) return;

		// Check if this message is for us.
		var obj = IRedis.checkPMessage(channel, message, this.sessCode);
		if (!obj) return;

		// Everything from here down will be run only if this instance is associated with the sessCode of the message.
		let queueObj = { name: obj.name, ready: false, content: null };
		// Use a "queue" to ensure that messages are processed in the order in which they were sent.  Since loading message content is asynchronous, there would be a possibility that messages could be processed out of order.
		this.messageQueue.push(queueObj);
		Attachment.loadMessage(obj, (name, content) => {
			queueObj.content = content;
			queueObj.ready = true;

			while (this.messageQueue.length > 0 && this.messageQueue[0].ready) {
				let _queueObj = this.messageQueue.shift();
				this.emit("data", _queueObj.name, _queueObj.content);
			}
		});
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
			console.log("Detected Expired:", message);
			OctaveHelper.sendDestroyD(this.sessCode, "Octave Session Expired");
			this.emit("destroy-u", "Octave Session Expired");
		}
	};
}

export = BackServerHandler;