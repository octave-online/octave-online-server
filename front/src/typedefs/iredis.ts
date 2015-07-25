///<reference path='../boris-typedefs/redis/redis.d.ts'/>

import Redis = require("redis");
import Config = require("../config");

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
	export interface DestroyMessage {
		sessCode:string
		message:string
	}
	export interface RebootRequestMessage {
		id:string
		isRequest:boolean
		token:string // the token of the server sending this message
		priority?:number // only on requests
		response?:boolean // only on responses
	}
	export interface OtMessage {
		type:string
		chgId?:string
		docId?:string
		ops?:any
		data?:any
	}
	export interface WsMessage {
		type:string
		data:any
	}

	// Interface for session states (not strictly related to Redis; this file is
	// just a convenient place to put it)
	export enum SessionState { Needed, Loading, Live }

	// Function to create a new Redis connection
	export function createClient():Client{
		console.log("Connecting to", Config.redis.hostname);
		return <Client> Redis.createClient(
			Config.redis.port,
			Config.redis.hostname,
			Config.redis.options);
	}

	// Channel names
	export var Chan = {
		needsOctave: "oo:needs-octave",
		destroyD: "oo:destroy-d",
		destroyU: "oo:destroy-u",
		rebootRequest: "oo:reboot-request",
		session: function (sessCode:string):string {
			return "oo:session:" + sessCode;
		},
		input: function (sessCode:string):string {
			return "oo:input:" + sessCode;
		},
		output: function (sessCode:string):string {
			return "oo:output:" + sessCode;
		},
		otOps: function (docId:string):string {
			return "ot:" + docId + ":ops";
		},
		otDoc: function (docId:string):string {
			return "ot:" + docId + ":doc";
		},
		otSub: function (docId: string): string {
			return "ot:" + docId + ":sub";
		},
		otCnt: function (docId: string): string {
			return "ot:" + docId + ":cnt";
		},
		wsSess: function(wsId: string): string {
			return "oo:workspace:" + wsId + ":sess";
		},
		wsSub: function(wsId: string): string {
			return "oo:workspace:" + wsId + ":sub";
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

	// Match an otMessage
	export function checkOtMessage(channel, message, docId):OtMessage {
		var match = /^ot:([^:]+):sub$/.exec(channel);
		if (!match) return null;
		if (match[1] !== docId) return null;
		
		var obj:OtMessage;
		try {
			obj = JSON.parse(message);
		} catch(e) {
			console.log("JSON PARSE ERROR", e);
			return null;
		}
		if (!obj.type) return null;

		return obj;
	}

	// Match a WsMessage
	export function checkWsMessage(channel, message, wsId):WsMessage {
		var match = /^oo:workspace:([^:]+):sub$/.exec(channel);
		if (!match) return null;
		if (match[1] !== wsId) return null;

		var obj:WsMessage;
		try {
			obj = JSON.parse(message);
		} catch (e) {
			console.log("JSON PARSE ERROR", e);
			return null;
		}
		if (!obj.type) return null;

		return obj;
	}
	
	// Match a destroy message
	export function checkDestroyMessage(message:string, sessCode:string):string {
		var _sessCode:string;
		var _message:string;
		try {
			var obj:DestroyMessage = JSON.parse(message);
			_sessCode = obj.sessCode;
			_message = obj.message || "No Reason Specified";
		} catch (e) {
			return;
		}
		
		if (sessCode === _sessCode) {
			return _message;
		} else {
			return null;
		}
	}

	// Match a reboot request message
	export function checkRebootRequestMessage(message:string):RebootRequestMessage {
		var obj:RebootRequestMessage;
		try {
			obj = JSON.parse(message);
		} catch (e) {
			return null;
		}
		return obj;
	}

	// Match an expired notification
	export function checkExpired(message:string, sessCode:string):boolean {
		var match = /^oo:(input|output):(\w+)$/.exec(message);
		if (!match) return null;
		var _sessCode:string = match[2];
		return (sessCode === _sessCode);
	}
}

export = IRedis