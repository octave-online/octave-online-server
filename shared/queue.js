"use strict";

const EventEmitter = require("events");

// This is a simple queue implementation that emits an event whenever an item is enqueued.

class Queue extends EventEmitter {
	constructor() {
		super();
		this._items = [];
	}

	enqueue(item) {
		this._items.push(item);
		this.emit("enqueue");
	}

	dequeue() {
		return this._items.shift();
	}

	isEmpty() {
		return this._items.length === 0;
	}
}

module.exports = Queue;
