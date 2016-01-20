"use strict";

const redis = require("redis");
const log = require("./logger")("redis-util");

const PORT = 6379
const HOSTNAME = "127.0.0.1";
const OPTIONS = { }

module.exports = {
	createClient: () => {
		log.debug("Connecting to Redis");
		return redis.createClient(PORT, HOSTNAME, OPTIONS)
	},

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
		}
	},

	getSessCodeFromChannel: (channel) => {
		const match = /^oo:(\w+):(\w+)$/.exec(channel);
		if (!match) throw new Error("Can't extract sessCode from channel name");
		return match[2];
	}
}
