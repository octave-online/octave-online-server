///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='typedefs/iuser.ts'/>

import Redis = require("redis");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");

var infoClient = IRedis.createClient();

class OctaveSessionHelper extends EventEmitter2.EventEmitter2 {
	constructor() {
		super();
	}

	public getNewSessCode(sessCodeGuess:string, next:(err:Error, sessCode:string, state:IRedis.SessionState)=>void){
		var sessCode = sessCodeGuess;

		// Check for proper sessCode format (possible attack vector)
		if (!IRedis.SessCodeFmt.test(sessCode)) sessCode = null;

		if (!sessCode) {
			// Case 1: No sessCode given
			this.makeSessCode((err,sessCode)=>{
				next(err, sessCode, IRedis.SessionState.Needed);
			});

		} else {
			this.isValid(sessCode, (state)=> {
				if (state === IRedis.SessionState.Needed) {
					// Case 2: Invalid sessCode given
					this.makeSessCode((err,sessCode)=>{
						next(err, sessCode, IRedis.SessionState.Needed);
					});

				} else {
					// Case 3: Valid sessCode given
					next(null, sessCode, state);
				}
			});
		}
	}

	public askForOctave(sessCode:string, content:any, next:(err:Error)=>void) {
		var time = new Date().valueOf();
		var multi = infoClient.multi();
		multi.zadd(IRedis.Chan.needsOctave, time, sessCode);
		// NOTE: For backwards compatibilty, this field is called "user" instead of "content"
		multi.hset(IRedis.Chan.session(sessCode), "user", JSON.stringify(content));
		multi.hset(IRedis.Chan.session(sessCode), "live", "false");
		multi.set(IRedis.Chan.input(sessCode), time);
		multi.set(IRedis.Chan.output(sessCode), time);
		multi.exec(next);
	}

	public sendDestroyD(sessCode:string, message:string) {
		console.log("Sending Destroy-D", message, sessCode);
		var destroyMessage:IRedis.DestroyMessage = {
			sessCode: sessCode,
			message: message
		};

		// Tell Redis to destroy our sessCode
		var multi = infoClient.multi();
		multi.del(IRedis.Chan.session(sessCode));
		multi.del(IRedis.Chan.input(sessCode));
		multi.del(IRedis.Chan.output(sessCode));
		multi.zrem(IRedis.Chan.needsOctave, sessCode);
		multi.publish(IRedis.Chan.destroyD, JSON.stringify(destroyMessage));
		multi.exec((err)=> {
			if (err) console.log("REDIS ERROR", err);
		});
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

	private isValid(sessCode:string, next:(valid:IRedis.SessionState)=>void) {
		infoClient.hget(IRedis.Chan.session(sessCode), "live", function(err, valid){
			if (err) return console.log("REDIS ERROR", err);
			var state = (valid === null) ? IRedis.SessionState.Needed
				: ((valid === "false") ? IRedis.SessionState.Loading : IRedis.SessionState.Live);
			next(state);
		});
	}
}

var instance = new OctaveSessionHelper();
export = instance;