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
