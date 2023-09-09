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

// RequireJS config for live application loads.

// New require.config for live application loads.
require.config({
	paths: {
		// Social Plugins
		"twitter": [
			"https://platform.twitter.com/widgets",
			"http://platform.twitter.com/widgets",
			"/js-default/twitter"
		],
		"addthis": [
			"https://s7.addthis.com/js/300/addthis_widget", // #pubid=ra-51d65a00598f1528
			"http://s7.addthis.com/js/300/addthis_widget", // #pubid=ra-51d65a00598f1528
			"/js-default/addthis"
		],
		"uservoice": [
			"https://widget.uservoice.com/{!uservoice!}",
			"http://widget.uservoice.com/{!uservoice!}",
			"/js-default/uservoice"
		],
		"analytics": [
			"https://www.google-analytics.com/analytics",
			"http://www.google-analytics.com/analytics",
			"/js-default/analytics"
		],
		"gtag": [
			"https://www.googletagmanager.com/gtag/js?id={!gtagid!}",
			"http://www.googletagmanager.com/gtag/js?id={!gtagid!}",
			"/js-default/gtag"
		],
		"webfont": [
			"https://ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont",
			"http://ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont",
			"/js-default/webfont"
		],
		"persona": [
			"https://login.persona.org/include",
			"/js-default/persona"
		],
		"recaptcha": [
			"https://www.recaptcha.net/recaptcha/api",
			"/js-default/recaptcha"
		],
		"fuse": [
			// TODO: Make this URL configurable
			"https://cdn.fuseplatform.net/publift/tags/2/2356/fuse",
			"/js-default/fuse"
		]
	},
	shim:{
		"twitter": {
			exports: "twttr"
		},
		"webfont": {
			exports: "WebFont"
		},
		"analytics": {
			exports: "ga"
		},
		"persona": {
			exports: "navigator.id"
		}
	}
});

// CSS shim
require.css = function(url){
	var link = document.createElement("link");
	link.type = "text/css";
	link.rel = "stylesheet";
	link.href = url;
	document.getElementsByTagName("head")[0].appendChild(link);
};

// Load from Google Fonts
// NOTE: There are no fonts from Google Fonts currently in use.
// require(["webfont"], function(WebFont){
// 	WebFont.load({
// 		google: {
// 			families: ["Rambla", "Bangers"]
// 		}
// 	});
// });

// Load Google Analytics
require(["js/anal"], function(anal){
	anal.pageview();
});

// Load DejaVu Sans Mono (lower priority)
setTimeout(function(){
	require.css("fonts/dejavusansmono_book/stylesheet.css");
}, 250);

// Load ReCAPTCHA (lower priority)
setTimeout(function(){
	require(["recaptcha"]);
}, 250);

// Load Social Bloatware (lowest priority)
setTimeout(function(){
	require(["uservoice"]);
}, 500);

