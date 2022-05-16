/*
 * Copyright © 2018, Octave Online LLC
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

"use strict";

const EventEmitter = require("events");
const redis = require("redis");
const log = require("./logger")("redis-util");
const mlog = require("./logger")("redis-util:minor");
const config = require("./config");
// const log = require("./logger")("redis-util");

const PORT = config.redis.port;
const HOSTNAME = config.redis.hostname;
const OPTIONS = config.redis.options;

class MockRedisClient extends EventEmitter {
	psubscribe(name, ...args) {
		mlog.trace("Ignoring psubscribe:", name);
	}
	subscribe(name, ...args) {
		mlog.trace("Ignoring subscribe:", name);
	}
	multi() {
		mlog.trace("Ignoring multi");
		return new MockRedisClient();
	}
	send_command(name, ...args) {
		mlog.trace("Ignoring send_command:", name);
	}
	del(name, ...args) {
		mlog.trace("Ignoring del:", name);
	}
	publish(name, ...args) {
		mlog.trace("Ignoring publish:", name);
	}
	zadd(name, ...args) {
		mlog.trace("Ignoring zadd:", name);
	}
	zrem(name, ...args) {
		mlog.trace("Ignoring zrem:", name);
	}
	hget(name, ...args) {
		mlog.trace("Ignoring hget:", name);
	}
	hset(name, ...args) {
		mlog.trace("Ignoring hset:", name);
	}
	set(name, ...args) {
		mlog.trace("Ignoring set:", name);
	}
	expire(name, ...args) {
		mlog.trace("Ignoring expire:", name);
	}
	exec() {
		mlog.trace("Ignoring exec");
	}
}

let createClient;
if (config.redis.hostname) {
	createClient = () => {
		mlog.debug("Connecting to Redis");
		return redis.createClient(PORT, HOSTNAME, OPTIONS);
	};
} else {
	log.warn("Redis is disabled; using mock");
	createClient = () => {
		mlog.debug("Creating mock Redis client");
		return new MockRedisClient();
	}
}

module.exports = {
	createClient,

	chan: {
		needsOctave: "oo:needs-octave",
		destroyD: "oo:destroy-d",
		destroyU: "oo:destroy-u",
		rebootRequest: "oo:reboot-request",
		session: (sessCode) => {
			return "oo:session:" + sessCode;
		},
		input: (sessCode) => {
			return "oo:input:" + sessCode;
		},
		output: (sessCode) => {
			return "oo:output:" + sessCode;
		},
		attachment: (id) => {
			return "attachment:" + id;
		},
		needsOctaveFlavor: (flavor) => {
			return "oo:needs-flavor:" + flavor;
		},
		flavorStatus: (flavor) => {
			return "oo:flavor-status-" + flavor;
		},
		otOps: (docId) => {
			return "ot:" + docId + ":ops";
		},
		otDoc: (docId) => {
			return "ot:" + docId + ":doc";
		},
		otSub: (docId) => {
			return "ot:" + docId + ":sub";
		},
		otCnt: (docId) => {
			return "ot:" + docId + ":cnt";
		},
		wsSess: (wsId) => {
			return "oo:workspace:" + wsId + ":sess";
		},
		wsSub: (wsId) => {
			return "oo:workspace:" + wsId + ":sub";
		},
	},

	getSessCodeFromChannel: (channel) => {
		const match = /^oo:(\w+):(\w+)$/.exec(channel);
		if (!match) throw new Error("Can't extract sessCode from channel name");
		return match[2];
	},

	isValidSessCode: (sessCode) => {
		return /^\w{24}$/.test(sessCode);
	}
};
