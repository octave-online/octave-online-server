// Handle the "onboarding" demonstration div

define(["jquery", "js/anal", "jquery.cookie", "js/utils"], function($, anal){
	var $onboarding = $("#onboarding"),
		$scriptPromo = $("#login-promo"),
		$instructorPromo = $("#instructor-promo"),
		$syncPromo = $("#sync-promo"),
		$sharePromo = $("#share-promo"),
		MIN_TIME = 1000;

	// Check for the cookie now
	if($.cookie("oo_onboarding_complete") === "true"){
		$onboarding.fadeOutSafe(500);
	}

	// Set event listeners for the onboarding div
	$onboarding.find("[data-purpose='close']").click(function(){
		$.cookie("oo_onboarding_complete", "true", {
			expires: MIN_TIME
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
			$scriptPromo.fadeOutSafe(500);
		});
	}

	// Set up the instructor promo onboarding
	if(!$.cookie("oo_instructor_promo_dismissed")){
		$instructorPromo.showSafe();
		$instructorPromo.find("[data-purpose='close']").click(function(){
			$.cookie("oo_instructor_promo_dismissed", "true", {
				expires: MIN_TIME
			});
			anal.dismiss("Instructors");
			$instructorPromo.fadeOutSafe(500);
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
				$syncPromo.fadeInSafe(500);
				$syncPromo.find("[data-purpose='close']").click(function(){
					$.cookie("oo_sync_promo_dismissed", "true", {
						expires: MIN_TIME
					});
					anal.dismiss("Octave Online Sync");
					$syncPromo.fadeOutSafe(500);
				});
			}

			// Also use this function to set up the Share onboarding
			if(!$.cookie("oo_share_promo_dismissed")){
				$sharePromo.fadeInSafe(500);
				$sharePromo.find("[data-purpose='close']").click(function(){
					$.cookie("oo_share_promo_dismissed", "true", {
						expires: MIN_TIME
					});
					anal.dismiss("Set up Sharing");
					$sharePromo.fadeOutSafe(500);
				});
			}
		},
		hideScriptPromo: function(){
			$scriptPromo.hideSafe();
			$sharePromo.hideSafe();
		}
	};
});