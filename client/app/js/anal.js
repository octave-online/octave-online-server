define(function(){

	var garef = null;
	var q = [];

	// Wait to load Google Analytics to not slow down the module
	require(["analytics"], function(_garef){
		garef = _garef;

		// Set up Analytics
		window.GoogleAnalyticsObject = "ga";
		garef("create", "UA-55015548-1", "auto");

		// Send queued-up messages to GA
		for (var i=0; i<q.length; i++) {
			garef.apply(this, q[i]);
		}
	});

	// Function to either call ga() or add to the waiting list
	function _ga() {
		if (garef) {
			garef.apply(this, arguments);
		} else {
			q.push(arguments);
		}
	}

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
		}
	};
});