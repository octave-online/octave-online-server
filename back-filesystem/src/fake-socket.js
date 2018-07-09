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

// Object to replicate the API of a server-side Socket.IO socket instance.
// 
// To trigger all local listeners with an emulated socket message, call
//   myFakeSocket.trigger(name,data)
// 
// To listen for when local methods want to send a message, listen for
// the "_emit" event on your FakeSocket instance.

class FakeSocket extends EventEmitter {
	constructor() {
		super();
	}
}

// Change around some of the methods
const oldEmit = FakeSocket.prototype.emit;
FakeSocket.prototype.trigger = oldEmit;
FakeSocket.prototype.emit = function(){
	const args = Array.prototype.slice.call(arguments);
	args.unshift("_emit");
	oldEmit.apply(this, args);
};

module.exports = FakeSocket;
