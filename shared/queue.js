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

	removeAll() {
		this._items = [];
	}

	isEmpty() {
		return this._items.length === 0;
	}
}

module.exports = Queue;
