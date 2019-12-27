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

import { octaveHelper } from "./octave_session_helper";
import { config, RedisMessenger, RedisQueue } from "@oo/shared";

// Workaround for EventEmitter not being added to shared/index.d.ts
interface IRedisMessenger extends RedisMessenger, EventEmitter {}
interface IRedisQueue extends RedisQueue, EventEmitter {}

const outputClient = new RedisMessenger() as IRedisMessenger;
outputClient.subscribeToOutput();
const destroyUClient = new RedisMessenger() as IRedisMessenger;
destroyUClient.subscribeToDestroyU();
const expireClient = new RedisMessenger() as IRedisMessenger;
expireClient.subscribeToExpired();
const redisMessenger = new RedisMessenger() as IRedisMessenger;

// TODO?
// outputClient.setMaxListeners(100);
// destroyUClient.setMaxListeners(100);
// expireClient.setMaxListeners(100);

export class BackServerHandler extends EventEmitter {
	public sessCode: string|null = null;
	private touchInterval: any;
	private redisQueue: IRedisQueue|null = null;

	constructor() {
		super();
	}

	public setSessCode(sessCode: string|null) {
		this.sessCode = sessCode;
		if (this.redisQueue) {
			this.redisQueue.reset();
			this.redisQueue = null;
		}
		if (sessCode) {
			this.redisQueue = new RedisQueue(sessCode) as IRedisQueue;
			this.redisQueue.on("message", (name, content) => {
				this.emit("data", name, content);
			});
		}
		this.touch();
	}

	public dataD(name:string, data:any) {
		if (this.sessCode === null) {
			this.emit("data", "alert", "ERROR: Please reconnect! Your action was not performed: " + name);
			return;
		}
		try {
			redisMessenger.input(this.sessCode, name, data);
		} catch(err) {
			console.log("ATTACHMENT ERROR", err);
		}
	}

	public subscribe() {
		// Prevent duplicate listeners
		this.unsubscribe();

		// Create listeners to Redis
		outputClient.on("message", this.pMessageListener);
		destroyUClient.on("destroy-u", this.destroyUListener);
		expireClient.on("expired", this.expireListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, config.redis.expire.interval);
	}

	public unsubscribe() {
		outputClient.removeListener("message", this.pMessageListener);
		destroyUClient.removeListener("destroy-u", this.destroyUListener);
		expireClient.removeListener("expired", this.expireListener);
		clearInterval(this.touchInterval);
	}

	private touch = () => {
		if (!this.depend(["sessCode"])) return;
		redisMessenger.touchInput(this.sessCode);
	};

	private depend(props:string[], log:boolean=false) {
		for (var i = 0; i < props.length; i++){
			if (!(<any>this)[props[i]]) {
				if (log) console.log("UNMET DEPENDENCY", props[i], arguments.callee.caller);
				return false;
			}
		}
		return true;
	};

	private pMessageListener = (sessCode: string, name: string, getData: any) => {
		if (!this.depend(["sessCode"])) return;

		// Check if this message is for us.
		if (sessCode !== this.sessCode) return;

		// Everything from here down will be run only if this instance is associated with the sessCode of the message.
		this.redisQueue!.enqueueMessage(name, getData);
	};

	private destroyUListener = (sessCode: string, message: any) => {
		if (!this.depend(["sessCode"])) return;
		if (sessCode !== this.sessCode) return;
		this.emit("destroy-u", message);
	};

	private expireListener = (sessCode: string, channel: string) => {
		if (!this.depend(["sessCode"])) return;
		if (sessCode !== this.sessCode) return;
		// If the session becomes expired, trigger a destroy event
		// both upstream and downstream.
		console.log("Detected Expired:", channel);
		octaveHelper.sendDestroyD(this.sessCode, "Octave Session Expired");
		this.emit("destroy-u", "Octave Session Expired");
	};
}
