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

import * as Shared from "@oo/shared";

export { config, config2, rack, redisUtil } from "@oo/shared";

// Workaround for EventEmitter not being added to shared/index.d.ts

export interface IRedisMessenger extends Shared.RedisMessenger, EventEmitter {}
export function newRedisMessenger(...args: any[]): IRedisMessenger {
	return new Shared.RedisMessenger(...args) as IRedisMessenger;
}

export interface IRedisQueue extends Shared.RedisQueue, EventEmitter {}
export function newRedisQueue(...args: any[]): IRedisQueue {
	return new Shared.RedisQueue(...args) as IRedisQueue;
}

// This is the interface for @oo/shared/logger, but dts-gen does not generate a full interface for that class.
export interface ILogger {
	trace(...args: any): void;
	debug(...args: any): void;
	log(...args: any): void;
	info(...args: any): void;
	warn(...args: any): void;
	error(...args: any): void;
}

export function logger(id: string): ILogger {
	return Shared.logger(id) as ILogger;
}

let gcp: any | undefined;
try {
	gcp = require("../../shared/gcp/index.js");
} catch(e) {
	logger("shared_wrap").warn("gcp is unavailable");
}
export { gcp };
