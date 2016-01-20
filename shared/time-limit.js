// From https://github.com/caolan/async/issues/1007
// (my contribution)

function timeLimit(milliseconds, defaults, callback) {
	var timer, normalCallbackRef;

	var normalCallback = function() {
		callback.apply(null, arguments);
		clearTimeout(timer);
	};
	var timeoutCallback = function() {
		callback.apply(null, defaults);
		normalCallbackRef = function(){}; // noop
	};

	timer = setTimeout(timeoutCallback, milliseconds);
	normalCallbackRef = normalCallback;

	return function() {
		normalCallbackRef.apply(null, arguments);
	};
};

module.exports = timeLimit;
