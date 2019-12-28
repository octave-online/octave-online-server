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

"use strict";

const EventEmitter = require("events");
const logger = require("./logger");
const Queue = require("./queue");

// For streams of messages with attachments, use a queue to handle incoming messages to ensure that messages are processed in order.  The loading of data via attachments is asynchronous and may cause messages to change order.
class RedisQueue extends EventEmitter {
	constructor(logId) {
		super();
		this._queue = new Queue();
		this._log = logger("rq:" + logId);
		this._mlog = logger("rq:" + logId + ":minor");
	}

	enqueueMessage(name, getData) {
		let message = { name, ready: false };
		this._queue.enqueue(message);
		getData((err, content) => {
			if (err) this._log.error(err);
			message.content = content;
			message.ready = true;
			this._flushMessageQueue();
		});
	}

	reset() {
		this._queue.removeAll();
	}

	_flushMessageQueue() {
		while (!this._queue.isEmpty() && this._queue.peek().ready) {
			let message = this._queue.dequeue();
			this._mlog.trace("Emitting message:", message.name);
			this.emit("message", message.name, message.content);
		}
		this._mlog.debug("Items remaining in queue:", this._queue.size());
	}
}

module.exports = RedisQueue;
