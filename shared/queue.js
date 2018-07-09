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

// This is a simple queue implementation that emits an event whenever an item is enqueued.

class Queue extends EventEmitter {
	constructor() {
		super();
		this.enabled = true;
		this._items = [];
	}

	enqueue(item) {
		if (this.enabled) {
			this._items.push(item);
			this.emit("enqueue");
		}
	}

	dequeue() {
		if (this._items.length > 0) {
			return this._items.shift();
		} else {
			throw new RangeError("Can't dequeue from an empty queue");
		}
	}

	peek() {
		if (this._items.length > 0) {
			return this._items[0];
		} else {
			throw new RangeError("Can't peek into an empty queue");
		}
	}

	removeAll() {
		this._items = [];
	}

	isEmpty() {
		return this._items.length === 0;
	}
}

module.exports = Queue;
