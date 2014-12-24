///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IUser = require("./user_interface");
import IRedis = require("./typedefs/iredis");

var infoClient:IRedis.Client = <IRedis.Client> Redis.createClient();

class RedisHelper extends EventEmitter2.EventEmitter2 {
	constructor() {
		super();
	}

	public getNewSessCode(sessCodeGuess:string, next:(err:Error, sessCode:string, needsOctave:boolean)=>void){
		var sessCode = sessCodeGuess;

		// Check for proper sessCode format (possible attack vector)
		if (!IRedis.SessCodeFmt.test(sessCode)) sessCode = null;

		if (!sessCode) {
			// Case 1: No sessCode given
			this.makeSessCode((err,sessCode)=>{
				next(err, sessCode, true);
			});

		} else {
			this.isValid(sessCode, (err, valid)=> {
				if(err) next(err, null, null);

				if (valid) {
					// Case 2: Valid sessCode given
					next(null, sessCode, false);

				} else {
					// Case 3: Invalid sessCode given
					this.makeSessCode((err,sessCode)=>{
						next(err, sessCode, true);
					});
				}
			});
		}
	}

	public askForOctave(sessCode:string, user:IUser, next:(err:Error)=>void) {
		var time = new Date().valueOf();
		var multi = infoClient.multi();
		multi.zadd(IRedis.Chan.needsOctave, time, sessCode);
		multi.hset(IRedis.Chan.session(sessCode), "user", JSON.stringify(user));
		multi.set(IRedis.Chan.input(sessCode), time);
		multi.set(IRedis.Chan.output(sessCode), time);
		multi.exec(next);
	}

	private makeSessCode(next:(err:Error, sessCode:string)=>void) {
		Crypto.pseudoRandomBytes(12, (err, buf) => {
			if (err) {
				return next(err, null);
			}

			var sessCode = buf.toString("hex");
			next(null, sessCode);
		});
	}

	private isValid(sessCode:string, next:(err:Error, valid:boolean)=>void) {
		infoClient.exists(IRedis.Chan.session(sessCode), next);
	}
}

var instance = new RedisHelper();
export = instance;