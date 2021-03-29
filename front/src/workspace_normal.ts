/*
 * Copyright © 2019, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { EventEmitter } from "events";

import Async = require("async");

import { IDestroyable, IWorkspace } from "./utils";
import { IBucket } from "./bucket_model";
import { IUser } from "./user_model";
import { config, newRedisMessenger, logger, ILogger } from "./shared_wrap";
import { octaveHelper, SessionState } from "./octave_session_helper";

type Err = Error|null;


const redisMessenger = newRedisMessenger();

export class NormalWorkspace
	extends EventEmitter
	implements IWorkspace, IDestroyable {
	public sessCode: string|null;
	public destroyed = false;
	private user: IUser|null;
	private bucket: IBucket|null;
	private _log: ILogger;

	constructor(sessCode: string|null, user: IUser|null, bucket: IBucket|null){
		super();
		this.sessCode = sessCode;
		this.user = user;
		this.bucket = bucket;
		this._log = logger("workspace-nrm:uninitialized");

		process.nextTick(()=>{
			this.emit("data", "oo.wsuser", { user });
		});
	}

	public destroyD(message: string){
		this.destroyed = true;
		if (!this.sessCode) {
			return;
		}
		// TODO: It's poor style to do a string comparison here
		if (message !== "Client Disconnect" || config.worker.onDisconnect === "destroy") {
			this._log.trace("destroyD: Destroy Now:", message);
			octaveHelper.sendDestroyD(this.sessCode, message);
		} else if (config.worker.onDisconnect === "ignore") {
			this._log.trace("destroyD: Ignore:", message);
			// Ensure that the files are committed immediately, so that if a user reloads the page, they get their data immediately synced
			this.emit("back", "commit", { comment: "Scripted Commit on Disconnect" });
		} else if (config.worker.onDisconnect === "expireShort") {
			this._log.trace("destroyD: Expire Short:", message);
			redisMessenger.touchInput(this.sessCode, true);
			// Ensure that the files are committed immediately, so that if a user reloads the page, they get their data immediately synced
			this.emit("back", "commit", { comment: "Scripted Commit on Disconnect" });
		}
	}

	public beginOctaveRequest(flavor: string) {
		Async.waterfall([
			(next: (err: Err, sessCode: string, state: SessionState) => void) => {
				// Check with Redis about the status of the desired sessCode
				octaveHelper.getNewSessCode(this.sessCode, next);
			},
			(sessCode: string, state: SessionState, next: (err: Err) => void) => {
				if (this.destroyed) {
					if (state !== SessionState.Needed)
						octaveHelper.sendDestroyD(sessCode, "Client Gone 1");
					return;
				}

				this.sessCode = sessCode;
				this._log = logger(`workspace-nrm:${sessCode}`) as ILogger;
				if (this.user) {
					this._log.info("User", this.user.consoleText);
				}
				if (this.bucket) {
					this._log.info("Bucket", this.bucket.consoleText);
				}

				// Ask for an Octave session if we need one.
				// Otherwise, inform the client.
				if (state === SessionState.Needed) {
					octaveHelper.askForOctave(sessCode, {
						user: this.user,
						bucket: this.bucket,
						flavor
					}, next);
				} else {
					this.emit("sesscode", sessCode);
					this.emit("data", "prompt", {});
					this.emit("data", "files-ready", {});
				}
			},
			(next: (err: Err) => void) => {
				if (this.destroyed) {
					octaveHelper.sendDestroyD(this.sessCode!, "Client Gone 2");
					return;
				}

				this.emit("sesscode", this.sessCode!);

				next(null);
			}
		], (err) => {
			if (err) this._log.error("REDIS ERROR", err);
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
	public destroyU(message: string){
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
	public dataD(name: string, val: any){
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
	public dataU(name: string, val: any){
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public subscribe() {
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public unsubscribe() {
	}
}
