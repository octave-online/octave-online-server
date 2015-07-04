// Handle the "onboarding" demonstration div

define(["jquery", "js/anal", "jquery.cookie", "js/utils"], function($, anal){
	var $onboarding = $("#onboarding"),
		$scriptPromo = $("#login-promo"),
		$instructorPromo = $("#instructor-promo"),
		$syncPromo = $("#sync-promo");

	// Check for the cookie now
	if($.cookie("oo_onboarding_complete") === "true"){
		$onboarding.showSafe();
	}

	// Set event listeners for the onboarding div
	$onboarding.find("[data-purpose='close']").click(function(){
		$.cookie("oo_onboarding_complete", "true", {
			expires: 1000
		});
		anal.dismiss("Welcome Message");
	});

	// Set up the script promo onboarding
	if(!$.cookie("oo_script_promo_dismissed")){
		$scriptPromo.showSafe();
		$scriptPromo.find("[data-purpose='close']").click(function(){
			// Make this cookie expire on browser being closed
			$.cookie("oo_script_promo_dismissed", "true");
			anal.dismiss("Sign in for Scripts");
			$scriptPromo.fadeOut(500);
		});
	}

	// Set up the instructor promo onboarding
	if(!$.cookie("oo_instructor_promo_dismissed")){
		$instructorPromo.showSafe();
		$instructorPromo.find("[data-purpose='close']").click(function(){
			$.cookie("oo_instructor_promo_dismissed", "true", {
				expires: 1000
			});
			anal.dismiss("Instructors");
			$instructorPromo.fadeOut(500);
		});
	}

	// Expose an API
	return {
		reset: function(){
			// Delete the cookie
			$.cookie("oo_onboarding_complete", null);
		},
		showSyncPromo: function(){
			// Set up the Octave Online Sync onboarding
			if(!$.cookie("oo_sync_promo_dismissed")){
				$syncPromo.fadeIn(500);
				$syncPromo.find("[data-purpose='close']").click(function(){
					$.cookie("oo_sync_promo_dismissed", "true", {
						expires: 1000
					});
					anal.dismiss("Octave Online Sync");
					$syncPromo.fadeOut(500);
				});
			}
		},
		hideScriptPromo: function(){
			$scriptPromo.hideSafe();
		}
	};
});