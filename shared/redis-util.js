"use strict";

const redis = require("redis");
const log = require("./logger")("redis-util");
const mlog = require("./logger")("redis-util:minor");
const config = require("./config.json");

const PORT = config.redis.port;
const HOSTNAME = config.redis.hostname;
const OPTIONS = config.redis.options;

module.exports = {
	createClient: () => {
		mlog.debug("Connecting to Redis");
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
		},
		attachment: (id) => {
			return "attachment:" + id;
		}
	},

	getSessCodeFromChannel: (channel) => {
		const match = /^oo:(\w+):(\w+)$/.exec(channel);
		if (!match) throw new Error("Can't extract sessCode from channel name");
		return match[2];
	}
}
