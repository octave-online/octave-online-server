define(function(){

	var garef = null;
	var q = [];

	// Wait to load Google Analytics to not slow down the module
	require(["js/runtime"], function(){
	require(["analytics"], function(_garef){
		// If _garef is null, the user might be blocking Google Analytics.
		// Suppress console errors by passing a noop function.
		garef = _garef ? _garef : function(){};

		// Set up Analytics
		window.GoogleAnalyticsObject = "ga";
		garef("create", "UA-55015548-1", "auto");

		// Send queued-up messages to GA
		for (var i=0; i<q.length; i++) {
			garef.apply(this, q[i]);
		}
	});
	});

	// Function to either call ga() or add to the waiting list
	function _ga() {
		if (garef) {
			garef.apply(this, arguments);
		} else {
			q.push(arguments);
		}
	}

	var numExtraTime = 0;

	// Return methods to register certain events
	return {
		pageview: function(){
			_ga("send", "pageview");
		},
		signedin: function(){
			_ga("send", "event", "accounts", "signed-in");
		},
		sitecontrol: function(which){
			_ga("send", "event", "site-control", which);
		},
		command: function(cmd){
			_ga("send", "event", "command", "user-cmd", cmd.substr(0,5), cmd.length);
		},
		runfile: function(){
			_ga("send", "event", "command", "run-file");
		},
		sigint: function(){
			_ga("send", "event", "signal", "user-interrupt");
		},
		patience: function(){
			_ga("send", "event", "loading", "patience-message");
		},
		dismiss: function(what){
			_ga("send", "event", "dismiss", "promo", what);
		},
		duration: function(duration){
			_ga("send", "event", "command", "duration", "millis", duration);
		},
		extraTime: function(){
			_ga("send", "event", "extra-time", "from-prompt", numExtraTime++);
		},
		acknowledgePayload: function(){
			_ga("send", "event", "extra-time", "acknowledge-payload");
		},
		alert: function(message){
			_ga("send", "event", "alert", "alert", message.substr(0,50), message.length);
		}
	};
});
