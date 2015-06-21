///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/ot.d.ts'/>

import Redis = require("redis");
import IRedis = require("./typedefs/iredis");
import EventEmitter2 = require("eventemitter2");
import Ot = require("ot");
import Fs = require("fs");
import Crypto = require("crypto");

var otLuaScript = Fs.readFileSync("ot_redis.lua", {encoding:"utf8"});
var otLuaSha1 = Crypto.createHash("sha1").update(otLuaScript).digest("hex");

console.log(otLuaScript);
console.log(otLuaSha1);

var opClient = IRedis.createClient();

class OtRedis extends EventEmitter2.EventEmitter2 {
	constructor() {
		super();
	}

	public receiveOperation(id:string, rev:number, op:Ot.ITextOperation){

	}
}
