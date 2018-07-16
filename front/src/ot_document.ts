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

///<reference path='typedefs/ot.d.ts'/>

import Redis = require("redis");
import EventEmitter2 = require("eventemitter2");
import Ot = require("ot");
import IRedis = require("./typedefs/iredis");
import Uuid = require("uuid");
import Crypto = require("crypto");
import Fs = require("fs");
import Config = require("./config");

// Load the Lua scripts
var otApplyScript = Fs.readFileSync("src/ot.lua", { encoding: "utf8" });
otApplyScript += Fs.readFileSync("src/ot_apply.lua", { encoding: "utf8" });
otApplyScript = otApplyScript.replace(/function/g, "local function");
var otApplySha1 = Crypto.createHash("sha1").update(otApplyScript).digest("hex");

var otSetScript = Fs.readFileSync("src/ot_set.lua", { encoding: "utf8" });
var otSetSha1 = Crypto.createHash("sha1").update(otSetScript).digest("hex");

// Make Redis connections for OT
var otOperationClient = IRedis.createClient();
var otListenClient = IRedis.createClient();
otListenClient.psubscribe(IRedis.Chan.otSub("*"));

// A single workspace could account for 50 or more listeners, because each document listens on the same connection.
otListenClient.setMaxListeners(200);

class OtDocument extends EventEmitter2.EventEmitter2{
	private id:string;
	private chgIds:string[] = [];
	private crsIds:string[] = [];
	private touchInterval;
	public opsReceivedCounter = 0;
	public setContentCounter = 0;

	constructor (id:string) {
		super();
		this.id = id;
		this.load();
	}

	public subscribe() {
		this.unsubscribe();

		otListenClient.on("pmessage", this.otMessageListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, Config.ot.document_expire.interval * 1000);
	}

	public unsubscribe() {
		otListenClient.removeListener("pmessage", this.otMessageListener);
		clearInterval(this.touchInterval);
	}

	public dataD(name:string, value:any) {
		if (this.id !== value.docId) return;

		switch(name){
			case "ot.change":
				this.onOtChange(value);
				break;

			case "ot.cursor":
				this.onOtCursor(value);
				break;

			default:
				break;
		}
	}

	public changeDocId(newDocId:string) {
		if (this.id === newDocId) return;

		var oldDocId = this.id;
		this.id = newDocId;

		// Note that multiple clients may all demand the rename simultaneously.
		// This shouldn't be a problem, as long as at least one of them succeeds.
		var multi = otOperationClient.multi();
		multi.rename(IRedis.Chan.otOps(oldDocId), IRedis.Chan.otOps(newDocId));
		multi.rename(IRedis.Chan.otDoc(oldDocId), IRedis.Chan.otDoc(newDocId));
		multi.rename(IRedis.Chan.otSub(oldDocId), IRedis.Chan.otSub(newDocId));
		multi.rename(IRedis.Chan.otCnt(oldDocId), IRedis.Chan.otCnt(newDocId));
		multi.exec((err) => {
			if (err) console.log("REDIS ERROR in changeDocId", err);
		});
	}

	public destroy() {
		// Same note as above about (many clients performing this simultaneously)
		var multi = otOperationClient.multi();
		multi.del(IRedis.Chan.otOps(this.id));
		multi.del(IRedis.Chan.otDoc(this.id));
		multi.del(IRedis.Chan.otSub(this.id));
		multi.del(IRedis.Chan.otCnt(this.id));
		multi.exec((err) => {
			if (err) console.log("REDIS ERROR in changeDocId", err);
		});
	}

	private load() {
		var multi = otOperationClient.multi();
		multi.get(IRedis.Chan.otCnt(this.id));
		multi.get(IRedis.Chan.otDoc(this.id));
		multi.exec((err, res) => {
			if (err) console.log("REDIS ERROR", err);
			else {
				this.emit("data", "ot.doc", {
					docId: this.id,
					rev: res[0] || 0,
					content: res[1] || ""
				});
			}
		});
	};

	private touch() {
		var multi = otOperationClient.multi();
		multi.expire(IRedis.Chan.otCnt(this.id), Config.ot.document_expire.timeout);
		multi.expire(IRedis.Chan.otDoc(this.id), Config.ot.document_expire.timeout);
		multi.exec((err) => {
			if (err) console.log("REDIS ERROR", err);
		});
	};

	private otMessageListener = (pattern, channel, message) => {
		var obj = IRedis.checkOtMessage(channel, message, this.id);
		if (!obj) return;

		switch(obj.type){
			case "cursor":
				if (!obj.data) return;
				var i = this.crsIds.indexOf(obj.data.id);
				if (i > -1) this.crsIds.splice(i, 1);
				else this.emit("data", "ot.cursor", {
					docId: this.id,
					cursor: obj.data.cursor
				});
				break;

			case "operation":
				if (!obj.chgId || !obj.ops) return;
				var i = this.chgIds.indexOf(obj.chgId);
				if (i > -1) {
					this.chgIds.splice(i, 1);
					this.emit("data", "ot.ack", {
						docId: this.id
					});
				} else {
					this.emit("data", "ot.broadcast", {
						docId: this.id,
						ops: obj.ops
					});
				}

			default:
				break;
		}
	};

	private onOtChange = (obj) => {
		if (!obj
			|| typeof obj.op === "undefined"
			|| typeof obj.rev === "undefined")
			return;

		var op = Ot.TextOperation.fromJSON(obj.op);
		this.receiveOperation(obj.rev, op);
	};

	private onOtCursor = (obj) => {
		if (!obj || !obj.cursor) return;

		var crsId = Uuid.v4();
		this.crsIds.push(crsId);
		otOperationClient.publish(IRedis.Chan.otSub(this.id), JSON.stringify({
			type: "cursor",
			data: {
				id: crsId,
				cursor: obj.cursor
			}
		}));
	};

	private receiveOperation(rev:number, op:Ot.ITextOperation) {
		var ops_key = IRedis.Chan.otOps(this.id);
		var doc_key = IRedis.Chan.otDoc(this.id);
		var sub_key = IRedis.Chan.otSub(this.id);
		var cnt_key = IRedis.Chan.otCnt(this.id);
		var chgId = Uuid.v4();

		var message: IRedis.OtMessage = {
			type: "operation",
			docId: this.id,
			chgId: chgId,
			ops: op.toJSON()
		}

		this.chgIds.push(chgId);
		this.runRedisScript(otApplyScript, otApplySha1, [
			4, ops_key, doc_key, sub_key, cnt_key,
			rev, JSON.stringify(message), Config.ot.operation_expire,
			Config.ot.document_expire.timeout
		]);
		this.opsReceivedCounter++;
	}

	public setContent(content:string, overwrite:boolean) {
		var ops_key = IRedis.Chan.otOps(this.id);
		var doc_key = IRedis.Chan.otDoc(this.id);
		var sub_key = IRedis.Chan.otSub(this.id);
		var cnt_key = IRedis.Chan.otCnt(this.id);
		var chgId = Uuid.v4();

		var message: IRedis.OtMessage = {
			type: "operation",
			docId: this.id,
			chgId: chgId
		}

		// note: don't push chgId to this.chgIds so that the operation reply gets
		// sent to our own client
		this.runRedisScript(otSetScript, otSetSha1, [
			4, ops_key, doc_key, sub_key, cnt_key,
			content, JSON.stringify(message), Config.ot.operation_expire,
			Config.ot.document_expire.timeout, (overwrite?"overwrite":"retain")
		]);
		this.setContentCounter++;
	}

	private runRedisScript(script:string, sha1:string, args:any[], cb?:(res:any)=>void) {

		var cb2 = function(err2, res2){
			if (err2) return console.log("REDIS ERROR", err2);
			if (cb) return cb(res2);
		}

		var args2 = (<any[]>[script]).concat(args).concat([cb2]);

		var cb1 = function(err1, res1){
			if (!err1) {
				if (cb) return cb(res1);
				else return;
			}
			if (!/NOSCRIPT/.test(err1.message)) {
				return console.log("REDIS ERROR", err1);
			}
			console.log("Falling back to EVAL");
			otOperationClient.eval.apply(otOperationClient, args2);
		}

		var args1 = (<any[]>[sha1]).concat(args).concat([cb1]);

		otOperationClient.evalsha.apply(otOperationClient, args1);
	}
}

export = OtDocument;