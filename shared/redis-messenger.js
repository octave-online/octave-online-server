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
const logger = require("./logger");
const redisUtil = require("./redis-util");
const Scripto = require("redis-scripto");
const path = require("path");
const uuid = require("uuid");
const fs = require("fs");
const config = require("./config");
const hostname = require("./hostname")();

class RedisMessenger extends EventEmitter {
	constructor() {
		super();
		this._client = redisUtil.createClient();
		this._subscribed = false;
		this._scriptManager = null;
		this.id = uuid.v4().substr(0, 8);  // For logging
		this._log = logger("redis-messenger:" + this.id);
		this._mlog = logger("redis-messenger:" + this.id + ":minor");

		this._client.on("error", (err) => {
			this._log.trace("REDIS CLIENT", err);
		});
		this._client.on("end", () => {
			this._log.trace("Redis connection ended");
		});
		this._client.on("reconnecting", (info) => {
			this._log.trace("Redis reconnecting:", info);
			this._log.debug("FYI: Subscription set:", this._client.subscription_set);
		});
		this._client.on("ready", (info) => {
			this._log.trace("Redis ready:", info);
		});
	}

	// PUBLIC METHODS

	enableSessCodeScriptsSync() {
		this._makeScriptManager();
		this._scriptManager.loadFromFile("get-sesscode", path.join(__dirname, "lua/get-sesscode.lua"));
		return this;
	}

	enableOtScriptsSync() {
		this._makeScriptManager();

		let otApplyScript = fs.readFileSync(path.join(__dirname, "lua/ot.lua"), "utf8");
		otApplyScript += fs.readFileSync(path.join(__dirname, "lua/ot_apply.lua"), "utf8");
		otApplyScript = otApplyScript.replace(/function/g, "local function");

		let otSetScript = fs.readFileSync(path.join(__dirname, "lua/ot_set.lua"), "utf8");

		this._scriptManager.load({
			"ot-apply": otApplyScript,
			"ot-set": otSetScript
		});

		return this;
	}

	_makeScriptManager() {
		if (!this._scriptManager) {
			this._scriptManager = new Scripto(this._client);
		}
	}

	input(sessCode, name, content) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.input(sessCode);
		let messageString = this._serializeMessage(name, content);

		this._client.publish(channel, messageString);
	}

	subscribeToInput() {
		this._psubscribe(redisUtil.chan.input);
		this.on("_message", this._emitMessage.bind(this));
		return this;
	}

	output(sessCode, name, content) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.output(sessCode);
		let messageString = this._serializeMessage(name, content);

		this._client.publish(channel, messageString);
	}

	subscribeToOutput() {
		this._psubscribe(redisUtil.chan.output);
		this.on("_message", this._emitMessage.bind(this));
		return this;
	}

	putSessCode(sessCode, content) {
		return this._putSessCode(sessCode, redisUtil.chan.needsOctave, content);
	}

	putSessCodeFlavor(sessCode, flavor, content) {
		return this._putSessCode(sessCode, redisUtil.chan.needsOctaveFlavor(flavor), content);
	}

	_putSessCode(sessCode, channel, content) {
		this._ensureNotSubscribed();

		let time = new Date().valueOf();

		let multi = this._client.multi();
		multi.zadd(channel, time, sessCode);
		// NOTE: For backwards compatibilty, this field is called "user" instead of "content"
		multi.hset(redisUtil.chan.session(sessCode), "user", JSON.stringify(content));
		multi.hset(redisUtil.chan.session(sessCode), "live", "false");
		multi.set(redisUtil.chan.input(sessCode), time);
		multi.set(redisUtil.chan.output(sessCode), time);
		multi.exec(this._handleError.bind(this));
	}

	getSessCode(next) {
		return this._getSessCode(redisUtil.chan.needsOctave, next);
	}

	getSessCodeFlavor(flavor, next) {
		return this._getSessCode(redisUtil.chan.needsOctaveFlavor(flavor), next);
	}

	_getSessCode(channel, next) {
		this._runScript("get-sesscode", [channel], [config.worker.token], (err, result) => {
			if (err) this._handleError(err);
			if (result === -1) return next(null, null, null);
			try {
				let content = JSON.parse(result[1]);
				this.touchOutput(result[0]);
				next(null, result[0], content);
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
		// For efficiency, zrem the key from needsOctave. However, the key could be in a needs-flavor channel. That case is handled in get-sesscode.lua.
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

	touchInput(sessCode, short) {
		this._ensureNotSubscribed();

		const timeout = short ? config.redis.expire.timeoutShort : config.redis.expire.timeout;

		const multi = this._client.multi();
		multi.expire(redisUtil.chan.session(sessCode), timeout/1000);
		multi.expire(redisUtil.chan.input(sessCode), timeout/1000);
		multi.exec(this._handleError.bind(this));
	}

	touchOutput(sessCode) {
		this._ensureNotSubscribed();

		const multi = this._client.multi();
		multi.expire(redisUtil.chan.session(sessCode), config.redis.expire.timeout/1000);
		multi.expire(redisUtil.chan.output(sessCode), config.redis.expire.timeout/1000);
		multi.exec(this._handleError.bind(this));
	}

	touchWorkspace(wsId) {
		this._ensureNotSubscribed();

		// TODO: Should these "expire" calls on intervals be buffered and sent to the server in batches, both here and above?
		this._client.expire(redisUtil.chan.wsSess(wsId), config.redis.expire.timeout/1000, this._handleError.bind(this));
	}

	touchOtDoc(docId) {
		this._ensureNotSubscribed();

		const multi = this._client.multi();
		multi.expire(redisUtil.chan.otCnt(docId), config.ot.document_expire.timeout/1000);
		multi.expire(redisUtil.chan.otDoc(docId), config.ot.document_expire.timeout/1000);
		multi.exec(this._handleError.bind(this));
	}

	subscribeToExpired() {
		this._epsubscribe();
		this.on("_message", (sessCode, channel) => {
			this.emit("expired", sessCode, channel);
		});
		return this;
	}

	requestReboot(id, priority) {
		return this._requestReboot(redisUtil.chan.rebootRequest, id, priority);
	}

	requestFlavorStatus(flavor, id, priority) {
		return this._requestReboot(redisUtil.chan.flavorStatus(flavor), id, priority);
	}

	_requestReboot(channel, id, priority) {
		this._ensureNotSubscribed();

		let message = {
			id,
			isRequest: true,
			token: config.worker.token,
			hostname,
			priority
		};

		this._client.publish(channel, JSON.stringify(message), this._handleError.bind(this));
	}

	replyToRebootRequest(id, response) {
		return this._replyToRebootRequest(redisUtil.chan.rebootRequest, id, response);
	}

	replyToFlavorStatus(flavor, id, response) {
		return this._replyToRebootRequest(redisUtil.chan.flavorStatus(flavor), id, response);
	}

	_replyToRebootRequest(channel, id, response) {
		this._ensureNotSubscribed();

		let message = {
			id,
			isRequest: false,
			token: config.worker.token,
			hostname,
			response
		};

		this._client.publish(channel, JSON.stringify(message), this._handleError.bind(this));
	}

	subscribeToRebootRequests() {
		return this._subscribeToRebootRequests(redisUtil.chan.rebootRequest, "reboot-request");
	}

	subscribeToFlavorStatus(flavor) {
		return this._subscribeToRebootRequests(redisUtil.chan.flavorStatus(flavor), "flavor-status");
	}

	_subscribeToRebootRequests(channel, eventName) {
		this._subscribe(channel);
		this.on("_message", (message) => {
			this.emit(eventName, message.id, message.isRequest, message);
		});
		return this;
	}

	workspaceMsg(wsId, type, data) {
		this._ensureNotSubscribed();

		let channel = redisUtil.chan.wsSub(wsId);
		let messageString = JSON.stringify({
			type,
			data
		});

		this._client.publish(channel, messageString, this._handleError.bind(this));
	}

	subscribeToWorkspaceMsgs() {
		this._psubscribe(redisUtil.chan.wsSub);
		this.on("_message", (wsId, message) => {
			this.emit("ws-sub", wsId, message.type, message.data);
		});
		return this;
	}

	getWorkspaceSessCode(wsId, next) {
		this._ensureNotSubscribed();
		this._client.get(redisUtil.chan.wsSess(wsId), next);
	}

	setWorkspaceSessCode(wsId, newSessCode, oldSessCode, next) {
		this._ensureNotSubscribed();

		// Perform a Compare-And-Swap operation (this is oddly not
		// in core Redis, so a Lua script is required)
		const casScript = "local k=redis.call(\"GET\",KEYS[1]); print(k); if k==false or k==ARGV[2] then redis.call(\"SET\",KEYS[1],ARGV[1]); return {true,ARGV[1]}; end; return {false,k};";
		this._client.eval(casScript, 1, redisUtil.chan.wsSess(wsId), newSessCode, oldSessCode || "-", next);
	}

	otMsg(docId, obj) {
		this._ensureNotSubscribed();

		const channel = redisUtil.chan.otSub(docId);
		const messageString = JSON.stringify(obj);

		this._client.publish(channel, messageString, this._handleError.bind(this));
	}

	subscribeToOtMsgs() {
		this._psubscribe(redisUtil.chan.otSub);
		this.on("_message", (docId, obj) => {
			this.emit("ot-sub", docId, obj);
		});
		return this;
	}

	changeOtDocId(oldDocId, newDocId) {
		this._ensureNotSubscribed();

		const multi = this._client.multi();
		multi.rename(redisUtil.chan.otOps(oldDocId), redisUtil.chan.otOps(newDocId));
		multi.rename(redisUtil.chan.otDoc(oldDocId), redisUtil.chan.otDoc(newDocId));
		multi.rename(redisUtil.chan.otSub(oldDocId), redisUtil.chan.otSub(newDocId));
		multi.rename(redisUtil.chan.otCnt(oldDocId), redisUtil.chan.otCnt(newDocId));
		multi.exec(this._handleError.bind(this));
	}

	destroyOtDoc(docId) {
		this._ensureNotSubscribed();

		const multi = this._client.multi();
		multi.del(redisUtil.chan.otOps(docId));
		multi.del(redisUtil.chan.otDoc(docId));
		multi.del(redisUtil.chan.otSub(docId));
		multi.del(redisUtil.chan.otCnt(docId));
		multi.exec(this._handleError.bind(this));
	}

	loadOtDoc(docId, next) {
		const multi = this._client.multi();
		multi.get(redisUtil.chan.otCnt(docId));
		multi.get(redisUtil.chan.otDoc(docId));
		multi.exec((err, res) => {
			if (err) return next(err);
			const rev = Number(res[0]) || 0;
			const content = res[1] || "";
			next(err, rev, content);
		});
	}

	applyOtOperation(docId, rev, message) {
		const ops_key = redisUtil.chan.otOps(docId);
		const doc_key = redisUtil.chan.otDoc(docId);
		const sub_key = redisUtil.chan.otSub(docId);
		const cnt_key = redisUtil.chan.otCnt(docId);

		this._runScript(
			"ot-apply",
			[ops_key, doc_key, sub_key, cnt_key],
			[
				rev,
				JSON.stringify(message),
				config.ot.operation_expire/1000,
				config.ot.document_expire.timeout/1000
			],
			this._handleError.bind(this));
	}

	setOtDocContent(docId, content, overwrite, message) {
		const ops_key = redisUtil.chan.otOps(docId);
		const doc_key = redisUtil.chan.otDoc(docId);
		const sub_key = redisUtil.chan.otSub(docId);
		const cnt_key = redisUtil.chan.otCnt(docId);

		this._runScript(
			"ot-set",
			[ops_key, doc_key, sub_key, cnt_key],
			[
				content,
				JSON.stringify(message),
				config.ot.operation_expire/1000,
				config.ot.document_expire.timeout/1000,
				(overwrite?"overwrite":"retain")
			],
			this._handleError.bind(this));
	}

	close() {
		this._client.end(true);
	}

	// PRIVATE METHODS

	_subscribe(channel) {
		this._ensureNotSubscribed();
		this._subscribed = true;

		this._log.trace("Subscribing to channel:", channel);

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

	_psubscribe(chanFn) {
		this._ensureNotSubscribed();
		this._subscribed = true;

		const pattern = chanFn("*");
		this._log.trace("Subscribing to pattern:", pattern);

		const regex = new RegExp(`^${chanFn("([^:]+)")}$`);

		this._client.psubscribe(pattern);
		this._client.on("pmessage", (pattern, channel, message) => {
			const match = regex.exec(channel);
			if (!match) {
				this._log.error("pmessage result does not match regex", pattern, channel);
				return;
			}
			const sessCode = match[1];
			try {
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

		this._log.trace("Subscribing to expiring keys");

		this._client.subscribe("__keyevent@0__:expired");
		this._client.on("message", (channel, message) => {
			this._mlog.trace("Received expire message", channel, message);
			const match = /^oo:\w+:(\w+)$/.exec(message);
			if (match) {
				this._log.trace("Matched sesscode in expire message");
				this.emit("_message", match[1], message);
			}
		});
	}

	_runScript(memo, keys, args, next) {
		this._ensureNotSubscribed();
		if (!this._scriptManager) throw new Error("Need to enable scripts first");

		this._mlog.trace("Running script:", memo);

		this._scriptManager.run(memo, keys, args, next);
	}

	_serializeMessage(name, content) {
		// Protect against name length
		if (name.length > config.redis.maxPayload) {
			this._log.error(new Error("Name length exceeds max redis payload length!"));
			return null;
		}

		// If data is too long, save it as an "attachment"
		let contentString = JSON.stringify(content);
		if (contentString.length > config.redis.maxPayload) {
			let id = uuid.v4();
			this._mlog.trace("Sending content as attachment:", name, id, contentString.length);
			this._uploadAttachment(id, contentString, this._handleError.bind(this));
			return JSON.stringify({ name, attachment: id });
		}

		// The message is short enough to send as one chunk!
		this._mlog.trace("Sending content on channel:", name);
		return JSON.stringify({ name, data: content });
	}

	_emitMessage(sessCode, message) {
		let getData = (next) => {
			if (message.data) return process.nextTick(() => {
				next(null, message.data);
			});
			else {
				return this._downloadAttachment(message.attachment, (err, contentString) => {
					this._mlog.trace("Received content as attachment:", message.name, message.attachment, contentString.length);
					try {
						next(err, JSON.parse(contentString));
					} catch (_err) {
						next(_err);
					}
				});
			}
		};

		this.emit("message", sessCode, message.name, getData);
	}

	_uploadAttachment(id, contentString, next) {
		let channel = redisUtil.chan.attachment(id);

		// Create a new client to offload bandwidth from the main artery channel
		let client = redisUtil.createClient();
		client.on("error", this._handleError.bind(this));

		// Upload the attachment along with an expire time
		let multi = client.multi();
		multi.lpush(channel, contentString);
		multi.expire(channel, config.redis.expire.timeout/1000);
		multi.exec((err) => {
			client.quit();
			next(err);
		});
	}

	_downloadAttachment(id, next) {
		let channel = redisUtil.chan.attachment(id);

		// Create a new client to offload bandwidth from the main artery channel
		let client = redisUtil.createClient();
		client.on("error", this._handleError.bind(this));

		// Download the attachment
		client.brpoplpush(channel, channel, config.redis.expire.timeout/1000, (err, response) => {
			client.quit();
			if (response) {
				next(err, response);
			} else {
				next(err, JSON.stringify(null));
			}
		});
	}

	_handleError() {
		if (arguments[0]) this._log.warn.apply(this, arguments);
	}

	_ensureNotSubscribed() {
		if (this._subscribed) throw new Error("Can't call this method on a client that is subscribed to a channel");
	}
}

module.exports = RedisMessenger;
