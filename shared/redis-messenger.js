"use strict";

const async = require("async");
const redis = require("redis");
const EventEmitter = require("events");
const log = require("./logger")("redis-messenger");
const redisUtil = require("./redis-util");
const Scripto = require("redis-scripto");
const path = require("path");
const uuid = require("uuid");
const config = require("./config.json");

class RedisMessenger extends EventEmitter {
	constructor() {
		super();
		this._client = redisUtil.createClient();
		this._subscribed = false;
		this._scriptManager = null;
	}

	// PUBLIC METHODS

	enableScripts() {
		this._scriptManager = new Scripto(this._client);
		this._scriptManager.loadFromFile("get-sesscode", path.join(__dirname, "lua/get-sesscode.lua"));
		return this;
	}

	input(sessCode, name, data) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.input(sessCode);
		let message = { name, data };

		this._client.publish(channel, JSON.stringify(message));
	}

	subscribeToInput() {
		this._psubscribe(redisUtil.chan.input("*"));
		this.on("_message", (sessCode, message) => {
			this.emit("message", sessCode, message.name, message.data);
		});
		return this;
	}

	output(sessCode, name, data) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.output(sessCode);
		let message = { name, data };

		this._client.publish(channel, JSON.stringify(message));
	}

	subscribeToOutput() {
		this._psubscribe(redisUtil.chan.output("*"));
		this.on("_message", (sessCode, message) => {
			this.emit("message", sessCode, message.name, message.data);
		});
		return this;
	}

	putSessCode(sessCode, user) {
		this._ensureNotSubscribed();

		let time = new Date().valueOf();

		let multi = this._client.multi();
		multi.zadd(redisUtil.chan.needsOctave, time, sessCode);
		multi.hset(redisUtil.chan.session(sessCode), "user", JSON.stringify(user));
		multi.hset(redisUtil.chan.session(sessCode), "live", "false");
		multi.set(redisUtil.chan.input(sessCode), time);
		multi.set(redisUtil.chan.output(sessCode), time);
		multi.exec(this._handleError.bind(this));
	}

	getSessCode(next) {
		this._runScript("get-sesscode", [redisUtil.chan.needsOctave], [config.worker.token], (err, result) => {
			if (err) this._handleError(err);
			if (result === -1) return next(null, null, null);
			try {
				let user = JSON.parse(result[1]);
				this.touchOutput(result[0]);
				next(null, result[0], user);
			} catch (err) {
				next(err, null, null);
			}
		});
	}

	destroyD(sessCode, reason) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.destroyD;
		let message = { sessCode, message: reason };

		let multi = this._client.multi();
		multi.del(redisUtil.chan.session(sessCode));
		multi.del(redisUtil.chan.input(sessCode));
		multi.del(redisUtil.chan.output(sessCode));
		multi.zrem(redisUtil.chan.needsOctave, sessCode);
		multi.publish(channel, JSON.stringify(message));
		multi.exec(this._handleError.bind(this));
	}

	subscribeToDestroyD() {
		this._subscribe(redisUtil.chan.destroyD);
		this.on("_message", (message) => {
			this.emit("destroy-d", message.sessCode, message.message);
		});
		return this;
	}

	destroyU(sessCode, reason) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.destroyU;
		let message = { sessCode, message: reason };

		let multi = this._client.multi();
		multi.del(redisUtil.chan.session(sessCode));
		multi.del(redisUtil.chan.input(sessCode));
		multi.del(redisUtil.chan.output(sessCode));
		multi.publish(channel, JSON.stringify(message));
		multi.exec(this._handleError.bind(this));
	}

	subscribeToDestroyU() {
		this._subscribe(redisUtil.chan.destroyU);
		this.on("_message", (message) => {
			this.emit("destroy-u", message.sessCode, message.message);
		});
		return this;
	}

	setLive(sessCode) {
		this._ensureNotSubscribed();

		this._client.hset(redisUtil.chan.session(sessCode), "live", "true");
		this.touchOutput(sessCode);
	}

	isValid(sessCode, next) {
		this._ensureNotSubscribed();

		this._client.hget(redisUtil.chan.session(sessCode), "live", next);
	}

	touchInput(sessCode) {
		this._ensureNotSubscribed();

		let multi = this._client.multi();
		multi.expire(redisUtil.chan.session(sessCode), config.redis.expire.timeout/1000);
		multi.expire(redisUtil.chan.input(sessCode), config.redis.expire.timeout/1000);
		multi.exec(this._handleError.bind(this));
	}

	touchOutput(sessCode) {
		this._ensureNotSubscribed();

		let multi = this._client.multi();
		multi.expire(redisUtil.chan.session(sessCode), config.redis.expire.timeout/1000);
		multi.expire(redisUtil.chan.output(sessCode), config.redis.expire.timeout/1000);
		multi.exec(this._handleError.bind(this));
	}

	subscribeToExpired() {
		this._epsubscribe();
		this.on("_message", (sessCode) => {
			this.emit("expired", sessCode);
		});
		return this;
	}

	requestReboot(id, priority) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.rebootRequest;
		let message = { id, isRequest: true, token: config.worker.token,  priority };

		this._client.publish(channel, JSON.stringify(message), this._handleError.bind(this));
	}

	replyToRebootRequest(id, response) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.rebootRequest;
		let message = { id, isRequest: false, token: config.worker.token, response };

		this._client.publish(channel, JSON.stringify(message), this._handleError.bind(this));
	}

	subscribeToRebootRequests() {
		this._subscribe(redisUtil.chan.rebootRequest);
		this.on("_message", (message) => {
			this.emit("reboot-request", message.id, message.isRequest, message);
		});
		return this;
	}

	close() {
		this._client.end(true);
	}

	// PRIVATE METHODS

	_subscribe(channel) {
		this._ensureNotSubscribed();
		this._subscribed = true;

		this._client.subscribe(channel);
		this._client.on("message", (channel, message) => {
			try {
				let obj = JSON.parse(message);
				this.emit("_message", obj);
			} catch (err) {
				this._handleError(err);
			}
		});
		return this;
	}

	_psubscribe(pattern) {
		this._ensureNotSubscribed();
		this._subscribed = true;

		this._client.psubscribe(pattern);
		this._client.on("pmessage", (pattern, channel, message) => {
			try {
				let sessCode = redisUtil.getSessCodeFromChannel(channel);
				let obj = JSON.parse(message);
				this.emit("_message", sessCode, obj);
			} catch (err) {
				this._handleError(err);
			}
		});
		return this;
	}

	_epsubscribe() {
		this._ensureNotSubscribed();
		this._subscribed = true;

		this._client.subscribe("__keyevent@0__:expired");
		this._client.on("message", (channel, message) => {
			try {
				let sessCode = redisUtil.getSessCodeFromChannel(message);
				this.emit("_message", sessCode);
			} catch (err) {
				// Silently ignore this error; there are many examples of keys that expire that don't have sessCodes in the name.
			}
		});
	}

	_runScript(memo, keys, args, next) {
		this._ensureNotSubscribed();
		if (!this._scriptManager) throw new Error("Need to call enableScripts() first");

		this._scriptManager.run(memo, keys, args, next);
	}

	_handleError() {
		if (arguments[0]) log.warn.apply(this, arguments);
	}

	_ensureNotSubscribed() {
		if (this._subscribed) throw new Error("Can't call this method on a client that is subscribed to a channel");
	}
}

module.exports = RedisMessenger
