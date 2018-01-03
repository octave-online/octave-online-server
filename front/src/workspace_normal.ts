///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/eventemitter2/eventemitter2.d.ts'/>
///<reference path='boris-typedefs/async/async.d.ts'/>
///<reference path='typedefs/idestroyable.d.ts'/>
///<reference path='typedefs/iuser.ts'/>
///<reference path='typedefs/iworkspace.ts'/>

import EventEmitter2 = require("eventemitter2");
import Config = require("./config");
import OctaveHelper = require("./octave_session_helper");
import Async = require("async");
import IRedis = require("./typedefs/iredis");

class NormalWorkspace
extends EventEmitter2.EventEmitter2
implements IWorkspace, IDestroyable {
	public sessCode:string;
	public destroyed:boolean = false;
	private user:IUser;
	private bucketId:string;

	constructor(sessCode:string, user:IUser, bucketId:string){
		super();
		this.sessCode = sessCode;
		this.user = user;
		this.bucketId = bucketId;

		process.nextTick(()=>{
			this.emit("data", "userinfo", user);
		});
	}

	private log(..._args:any[]):void {
		this.emit("log", arguments);
	}

	public destroyD(message:string){
		this.destroyed = true;
		if (this.sessCode) {
			OctaveHelper.sendDestroyD(this.sessCode, message);
		}
	}

	public beginOctaveRequest() {
		Async.waterfall([
			(next) => {
				// Check with Redis about the status of the desired sessCode
				OctaveHelper.getNewSessCode(this.sessCode, next);
			},
			(sessCode:string, state:IRedis.SessionState, next) => {
				if (this.destroyed) {
					if (state !== IRedis.SessionState.Needed)
						OctaveHelper.sendDestroyD(sessCode, "Client Gone 1");
					return;
				}

				this.sessCode = sessCode;

				// Ask for an Octave session if we need one.
				// Otherwise, inform the client.
				if (state === IRedis.SessionState.Needed)
					OctaveHelper.askForOctave(sessCode, {
						user: this.user,
						bucketId: this.bucketId
					}, next);
				else {
					this.emit("sesscode", sessCode);
					this.emit("data", "prompt", {});
				}
			},
			(next) => {
				if (this.destroyed) {
					OctaveHelper.sendDestroyD(this.sessCode, "Client Gone 2");
					return;
				}

				this.emit("sesscode", this.sessCode);
			}
		], (err) => {
			if (err) console.log("REDIS ERROR", err);
		});
	}

	public destroyU(message:string){
	}

	public dataD(name:string, val:any){
	}

	public dataU(name:string, val:any){
	}

	public subscribe() {
	}

	public unsubscribe() {
	}
};

export = NormalWorkspace;