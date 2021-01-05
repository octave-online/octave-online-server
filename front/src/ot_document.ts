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

import { EventEmitter } from "events";

import Ot = require("ot");
import Uuid = require("uuid");

import { config, newRedisMessenger, logger, ILogger } from "./shared_wrap";

type Err = Error|null;

// Make Redis connections for OT
const redisMessenger = newRedisMessenger();
redisMessenger.enableOtScriptsSync();
const otListenClient = newRedisMessenger();
otListenClient.subscribeToOtMsgs();

// A single workspace could account for 50 or more listeners, because each document listens on the same connection.
otListenClient.setMaxListeners(200);

export class OtDocument extends EventEmitter {
	private id: string;
	private chgIds: string[] = [];
	private crsIds: string[] = [];
	private touchInterval: any;
	private _log: ILogger;
	private _mlog: ILogger;
	private initialContent: string;
	public opsReceivedCounter = 0;
	public setContentCounter = 0;

	constructor (id: string, safeId: string, initialContent: string) {
		super();
		this.id = id;
		this._log = logger("ot-doc:" + safeId) as ILogger;
		this._mlog = logger("ot-doc:" + safeId + ":minor") as ILogger;
		this.initialContent = initialContent;
		this.load();
	}

	public logFilename(filename: string) {
		this._log.trace("Filename:", filename);
	}

	public subscribe() {
		this.unsubscribe();

		otListenClient.on("ot-sub", this.otMessageListener);
		this.touch();
		this.touchInterval = setInterval(this.touch, config.ot.document_expire.interval);
	}

	public unsubscribe() {
		otListenClient.removeListener("ot-sub", this.otMessageListener);
		clearInterval(this.touchInterval);
	}

	public dataD(name: string, value: any) {
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

	public changeDocId(newDocId: string) {
		if (this.id === newDocId) return;

		const oldDocId = this.id;
		this.id = newDocId;

		// Note that multiple clients may all demand the rename simultaneously.
		// This shouldn't be a problem, as long as at least one of them succeeds.
		redisMessenger.changeOtDocId(oldDocId, newDocId);
	}

	public destroy() {
		// Same note as above about (many clients performing this simultaneously)
		redisMessenger.destroyOtDoc(this.id);
	}

	private load() {
		redisMessenger.loadOtDoc(this.id, (err: Err, rev: number, content: string) => {
			if (err) this._log.error("REDIS ERROR", err);
			else {
				this._log.trace("Loaded doc: rev", rev);
				if (rev === -1) {
					this.setContent(this.initialContent);
					this.emit("data", "ot.doc", {
						docId: this.id,
						rev: 0,
						content: this.initialContent
					});
				} else {
					this.emit("data", "ot.doc", {
						docId: this.id,
						rev,
						content
					});
				}
			}
		});
	}

	private touch() {
		redisMessenger.touchOtDoc(this.id);
	}

	private otMessageListener = (docId: string, obj: any) => {
		if (docId !== this.id) return;

		let i;
		switch(obj.type){
			case "cursor":
				if (!obj.data) return;
				i = this.crsIds.indexOf(obj.data.id);
				if (i > -1) this.crsIds.splice(i, 1);
				else {
					this._mlog.trace("Received another user's cursor:", obj.data.cursor);
					this.emit("data", "ot.cursor", {
						docId: this.id,
						cursor: obj.data.cursor
					});
				}
				break;

			case "operation":
				if (!obj.chgId || !obj.ops) return;
				i = this.chgIds.indexOf(obj.chgId);
				if (i > -1) {
					this._mlog.trace("Received ack for ops:", obj.ops.length);
					this.chgIds.splice(i, 1);
					this.emit("data", "ot.ack", {
						docId: this.id
					});
				} else {
					this._mlog.trace("Received broadcast of ops:", obj.ops.length);
					this.emit("data", "ot.broadcast", {
						docId: this.id,
						ops: obj.ops
					});
				}
				break;

			default:
				break;
		}
	};

	private onOtChange = (obj: any) => {
		if (!obj
			|| typeof obj.op === "undefined"
			|| typeof obj.rev === "undefined")
			return;

		const op = Ot.TextOperation.fromJSON(obj.op);
		this.receiveOperation(obj.rev, op);
	};

	private onOtCursor = (obj: any) => {
		if (!obj || !obj.cursor) return;

		const crsId = Uuid.v4();
		this.crsIds.push(crsId);
		redisMessenger.otMsg(this.id, {
			type: "cursor",
			data: {
				id: crsId,
				cursor: obj.cursor
			}
		});
	};

	private receiveOperation(rev: number, op: Ot.ITextOperation) {
		const chgId = Uuid.v4();

		this._log.trace("Applying operation", rev, chgId);

		const message = {
			type: "operation",
			docId: this.id,
			chgId: chgId,
			ops: op.toJSON()
		};

		this.chgIds.push(chgId);
		redisMessenger.applyOtOperation(this.id, rev, message);
		this.opsReceivedCounter++;
	}

	private setContent(content: string) {
		const chgId = Uuid.v4();

		this._log.trace("Setting content", content.length);

		const message = {
			type: "operation",
			docId: this.id,
			chgId: chgId
		};

		// note: don't push chgId to this.chgIds so that the operation reply gets sent to our own client
		redisMessenger.setOtDocContent(this.id, content, message);
		this.setContentCounter++;
	}
}
