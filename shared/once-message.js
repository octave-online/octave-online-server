"use strict";

// This is a simple utility function that waits for a specific message name before continuing.

module.exports = function onceMessage(emitter, messageName, next) {
	const messageCallback = (name, content) => {
		if (name === messageName) {
			next(null, content);
			emitter.removeListener("message", messageCallback);
		}
	};
	emitter.on("message", messageCallback);
};
