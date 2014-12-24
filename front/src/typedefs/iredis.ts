///<reference path='../boris-typedefs/redis/redis.d.ts'/>

import Redis = require("redis");

module IRedis {
	// Hack to add multi() to the TypeScript RedisClient interface
	export interface Client extends Redis.RedisClient {
		multi(commands?:any[]):Client;
		exec(cb);
	}

	// Define a standard interface for Redis JSON messages
	export interface Message {
		name:string
		data:any
	}
	export interface DestroyMessage{
		sessCode:string
		message:string
	}

	// Channel names
	export var Chan = {
		needsOctave: "oo:needs-octave",
		destroyD: "oo:destroy-d",
		destroyU: "oo:destroy-u",
		session: function (sessCode:string):string {
			return "oo:session:" + sessCode;
		},
		input: function (sessCode:string):string {
			return "oo:input:" + sessCode;
		},
		output: function (sessCode:string):string {
			return "oo:output:" + sessCode;
		}
	};

	// Format of a sessCode
	export var SessCodeFmt = /^\w{24}$/;
	
	// Match a pMessage
	export function checkPMessage(channel, message, sessCode):Message {
		var match = /^oo:(input|output):(\w+)$/.exec(channel);
		if (!match) return null;
		if (match[2] !== sessCode && match[2] !== "broadcast") return null;
		
		var obj:Message;
		try {
			obj = JSON.parse(message);
		} catch (e) {
			console.log("JSON PARSE ERROR", e);
			return null;
		}
		if (!obj.name) return null;
		
		return obj;
	}
	
	// Match a destroy message
	export function checkDestroyMessage(message:string, sessCode:string):string{
		var _sessCode:string;
		var _message:string;
		try {
			var obj:DestroyMessage = JSON.parse(message);
			_sessCode = obj.sessCode;
			_message = obj.message || "No Reason Specified";
		} catch (e) {
			return;
		}
		
		if(sessCode === _sessCode){
			return _message;
		}else{
			return null;
		}
	}

	// Match an expired notification
	export function checkExpired(message:string, sessCode:string):boolean{
		var match = /^oo:(input|output):(\w+)$/.exec(message);
		if (!match) return null;
		var _sessCode:string = match[2];
		return (sessCode === _sessCode);
	}
}

export = IRedis