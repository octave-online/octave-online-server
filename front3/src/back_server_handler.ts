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

import { config, newRedisMessenger, newRedisQueue, IRedisQueue, logger, ILogger } from "./shared_wrap";
import { octaveHelper } from "./octave_session_helper";

const outputClient = newRedisMessenger();
outputClient.subscribeToOutput();
const destroyUClient = newRedisMessenger();
destroyUClient.subscribeToDestroyU();
const expireClient = newRedisMessenger();
expireClient.subscribeToExpired();
const redisMessenger = newRedisMessenger();

outputClient.setMaxListeners(100);
destroyUClient.setMaxListeners(100);
expireClient.setMaxListeners(100);

export class BackServerHandler extends EventEmitter {
	public sessCode: string|null = null;
	private touchInterval: any;
	private redisQueue: IRedisQueue|null = null;
	private _log: ILogger;

	constructor() {
		super();
		this._log = logger("back-handler:uninitialized");
	}

	public setSessCode(sessCode: string|null) {
		this.sessCode = sessCode;
		if (this.redisQueue) {
			this.redisQueue.reset();
			this.redisQueue = null;
		}
		if (sessCode) {
			this.redisQueue = newRedisQueue(sessCode);
			this.redisQueue.on("message", (name, content) => {
				this.emit("data", name, content);
			});
			this._log = logger("back-handler:" + sessCode);
		} else {
			this._log = logger("back-handler:uninitialized");
		}
		this.touch();
	}

	public dataD(name: string, data: any) {
		if (this.sessCode === null) {
			this.emit("data", "alert", "ERROR: Please reconnect! Your action was not performed: " + name);
			return;
		}
		try {
			redisMessenger.input(this.sessCode, name, data);
		} catch(err) {
			this._log.error("ATTACHMENT ERROR", err);
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

	private depend(props: string[], log=false) {
		for (let i = 0; i < props.length; i++){
			if (!(<any>this)[props[i]]) {
				if (log) this._log.warn("UNMET DEPENDENCY", props[i], arguments.callee.caller);
				return false;
			}
		}
		return true;
	}

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
		this._log.trace("Detected Expired:", channel);
		octaveHelper.sendDestroyD(this.sessCode, "Octave Session Expired");
		this.emit("destroy-u", "Octave Session Expired");
	};
}
