///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='../node_modules/promise-ts/promise-ts.d.ts'/>

import Redis = require("redis");
import Promise = require("promise-ts");
import Crypto = require("crypto");
import EventEmitter2 = require("eventemitter2");
import Util = require("util");

class RedisHandler extends EventEmitter2.EventEmitter2 {
	public sessCode:string;

	constructor() {
		super();
	}

	public setSessCode (sessCode:string):Promise.Promise {
		var d = new Promise.Deferred();
		this.sessCode = sessCode;

		if (!this.sessCode) {
			// Case 1: No sessCode given
			Util.log("Case 1: No sessCode given");
			this.makeSessCode().then(()=>{
				this.setup().then(()=>{
					this.subscribe().then(()=>{
						d.resolve();
					});
				});
			});

		}else{
			this.isValid().then((valid:boolean)=>{

				if (valid){
					// Case 2: Valid sessCode given
					Util.log("Case 2: Valid sessCode given");
					this.subscribe().then(()=>{
						d.resolve();
					});
				}else{
					// Case 3: Invalid sessCode given
					Util.log("Case 3: Invalid sessCode given");
					this.makeSessCode().then(()=>{
						this.setup().then(()=>{
							this.subscribe().then(()=>{
								d.resolve();
							});
						});
					});
				}
			});
		}

		return d.promise;
	}

	private makeSessCode ():Promise.Promise {
		var d = new Promise.Deferred();
		Util.log("Starting to make sessCode");
		Crypto.pseudoRandomBytes(12, (err, buf) => {
			if (err) {
				return d.reject(err);
			}

			this.sessCode = buf.toString("hex");
			this.emit("oo.sesscode", this.sessCode);
			Util.log("Made sessCode: " + this.sessCode);
			d.resolve();
		});
		return d.promise;
	}

	private isValid():Promise.Promise {
		var d = new Promise.Deferred();
		setTimeout(function () {
			d.resolve(false);
		}, 100);
		return d.promise;
	}

	private setup():Promise.Promise {
		var d = new Promise.Deferred();
		Util.log("Beginning Setup");
		setTimeout(()=> {
			Util.log("Resolving Setup");
			d.resolve();
		}, 500);
		return d.promise;
	}

	private subscribe():Promise.Promise {
		var d = new Promise.Deferred();
		Util.log("Beginning Subscribe");
		setTimeout(()=> {
			Util.log("Resolving Subscribe");
			d.resolve();
		}, 500);
		return d.promise;
	}
}

export = RedisHandler;