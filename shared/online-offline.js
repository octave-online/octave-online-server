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
const Queue = require("./queue");
// const log = require("./logger")("online-offline");

/**
 * This is a class that handles safely creating and destroying something asynchronously.
 * Possible states: INIT, CREATING, ONLINE, PENDING-DESTROY, DESTROYING, and DESTROYED.
 * Required methods to implement in derived classes: _doCreate, _doDestroy.
 * Derived classes may read the state but should never change it.
 */

class OnlineOffline extends EventEmitter {
	constructor() {
		super();

		this._state = "INIT";
		this._createCBs = new Queue();
		this._destroyCBs = new Queue();
	}

	isOnline() {
		return this._state === "ONLINE";
	}

	create(next) {
		next = next || function(){};
		switch (this._state) {
			case "INIT": {
				this._state = "CREATING";
				this._createCBs.enqueue(next);
				let args = Array.prototype.slice.call(arguments, 1);
				args.unshift(this._afterCreate.bind(this));
				this._doCreate.apply(this, args);
				break;
			}

			case "CREATING":
			case "PENDING-DESTROY":
				this._createCBs.enqueue(next);
				break;

			case "ONLINE":
				return process.nextTick(() => {
					next(new Error("Already created"));
				});

			case "DESTROYING":
			case "DESTROYED":
				return process.nextTick(() => {
					next(new Error("Already destroyed"));
				});

			default:
				this._log.error("Unknown state:", this._state);
				return process.nextTick(() => {
					next(new Error("Internal online-offline error"));
				});
		}
	}

	_afterCreate(err) {
		switch (this._state) {
			case "CREATING":
				this._state = "ONLINE";
				if (err) {
					this.destroy();
				}
				break;

			case "PENDING-DESTROY":
				this._state = "ONLINE";
				this.destroy();
				if (!err) {
					err = new Error("Pending destroy");
				}
				break;

			case "DESTROYED":
				if (!err) {
					err = new Error("Already destroyed");
				}
				break;

			case "INIT":
			case "ONLINE":
			case "DESTROYING":
				this._log.error("Unexpected state:", this._state);
				break;

			default:
				this._log.error("Unknown state:", this._state);
				break;
		}

		let args = Array.prototype.slice.call(arguments, 1);
		args.unshift(err);

		while (!this._createCBs.isEmpty()) {
			let cb = this._createCBs.dequeue();
			process.nextTick(() => {
				cb.apply(this, args);
			});
		}
	}

	destroy(next) {
		next = next || function(){};
		switch (this._state) {
			case "ONLINE": {
				this._state = "DESTROYING";
				this._destroyCBs.enqueue(next);
				let args = Array.prototype.slice.call(arguments, 1);
				args.unshift(this._afterDestroy.bind(this));
				this._doDestroy.apply(this, args);
				break;
			}

			case "CREATING":
			case "PENDING-DESTROY":
				this._state = "PENDING-DESTROY";
				this._destroyCBs.enqueue(next);
				break;

			case "DESTROYING":
				this._destroyCBs.enqueue(next);
				break;

			case "INIT":
			case "DESTROYED":
				this._state = "DESTROYED";
				return process.nextTick(() => {
					next(null);
				});

			default:
				this._log.error("Unknown state:", this._state);
				return process.nextTick(() => {
					next(new Error("Internal online-offline error"));
				});
		}
	}

	_afterDestroy(err) {
		switch (this._state) {
			case "DESTROYING":
				this._state = "DESTROYED";
				break;

			case "INIT":
			case "CREATING":
			case "ONLINE":
			case "PENDING-DESTROY":
			case "DESTROYED":
				this._log.error("Unexpected state:", this._state);
				break;

			default:
				this._log.error("Unknown state:", this._state);
				break;
		}

		while (!this._destroyCBs.isEmpty()) {
			let cb = this._destroyCBs.dequeue();
			process.nextTick(() => {
				cb.call(this, err);
			});
		}
	}

	_internalDestroyed(err) {
		switch (this._state) {
			case "DESTROYING":
			case "CREATING":
			case "ONLINE":
			case "PENDING-DESTROY":
				this._state = "DESTROYING";
				this._afterDestroy(err);
				break;

			case "DESTROYED":
				break;

			case "INIT":
				this._log.error("Unexpected state:", this._state);
				break;

			default:
				this._log.error("Unknown state:", this._state);
				break;
		}
	}
}

module.exports = OnlineOffline;
