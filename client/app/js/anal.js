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

define(function(){

	window.dataLayer = window.dataLayer || [];
	function gtag(){ dataLayer.push(arguments); }
	gtag("js", new Date());

	// Set up Analytics
	gtag("config", "{!gtagid!}");

	function sendEvent(event_category, event_action, event_label, value) {
		// analytics.js:
		// garef("send", "event", event_category, event_action, event_label, value);
		// gtag.js:
		gtag("event", event_action, {
			event_category: event_category,
			event_label: event_label,
			value: value,
		});
	}

	// Wait to load Google Analytics to not slow down the module
	require(["js/runtime"], function(){ require(["gtag"], function(){
		// Record browser window size
		var width = window.innerWidth || document.body.clientWidth;
		var height = window.innerHeight || document.body.clientHeight;
		width = Math.round(width/50)*50;
		height = Math.round(height/50)*50;
		sendEvent("browser-size", "width", width);
		sendEvent("browser-size", "height", height);
		sendEvent("browser-size", "combined", width+"x"+height);
	}); });

	var numExtraTime = 0;

	// Return methods to register certain events
	return {
		pageview: function(){
			// Obsolete in gtag.js
			// _ga("send", "pageview");
		},
		signedin: function(){
			sendEvent("accounts", "signed-in");
		},
		welcomeback: function() {
			sendEvent("accounts", "welcome-back");
		},
		sitecontrol: function(which){
			sendEvent("site-control", which);
		},
		command: function(cmd){
			sendEvent("command", "user-cmd", cmd.substr(0,5), cmd.length);
		},
		runfile: function(){
			sendEvent("command", "run-file");
		},
		sigint: function(){
			sendEvent("signal", "user-interrupt");
		},
		patience: function(){
			sendEvent("loading", "patience-message");
		},
		dismiss: function(what){
			sendEvent("dismiss", "promo", what);
		},
		duration: function(duration){
			sendEvent("command", "duration", "millis", duration);
		},
		extraTime: function(){
			sendEvent("extra-time", "from-prompt", numExtraTime++);
		},
		acknowledgePayload: function(){
			sendEvent("extra-time", "acknowledge-payload");
		},
		alert: function(message){
			sendEvent("alert", "alert", message.substr(0,20), message.length);
		}
	};
});
