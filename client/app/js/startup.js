// RequireJS config for live application loads.

require.config({
	paths: {
		// Social Plugins
		"twitter": [
			"http://platform.twitter.com/widgets",
			"/js-default/twitter"
		],
		"addthis": [
			"http://s7.addthis.com/js/300/addthis_widget", // #pubid=ra-51d65a00598f1528
			"/js-default/addthis"
		],
		"uservoice": [
			"http://widget.uservoice.com/5fPlQ3CsHcjp8LVE8dAeA",
			"/js-default/uservoice"
		],
		"analytics": [
			"http://www.google-analytics.com/analytics",
			"http://cdn.octave-online.com/analytics-dummy"
		],
		"webfont": [
			"http://ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont",
			"/js-default/webfont"
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
		}
	}
});

// Main application
require(["js/app"]);

// Bells and whistles
window.addthis_config = {
	services_compact: "twitter,google_plusone_share,email,delicious,scoopit,facebook",
	ui_508_compliant: true
};
window.addthis_share = {
	url: "http://octave-online.net/",
	templates: {
		twitter: "Check out @OctaveOnline -- a free online MATLAB-like prompt! {{url}}"
	}
};
require(["webfont", "js/anal", "twitter", "addthis", "uservoice"], function(WebFont, anal){
	// Fonts
	WebFont.load({
		google: {
			families: ["Rambla", "Inconsolata:400,700", "Bangers"]
		}
	});

	// Adsense
	window.adsbygoogle = [];

	// Analytics
	anal.pageview();
});
