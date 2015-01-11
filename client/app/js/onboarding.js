// Handle the "onboarding" demonstration div

define(["jquery", "jquery.cookie"], function($){
	var $onboarding = $("#onboarding"),
		$scriptPromo = $("#login-promo"),
		$instructorPromo = $("#instructor-promo"),
		$syncPromo = $("#sync-promo");

	// Check for the cookie now
	if($.cookie("oo_onboarding_complete") === "true"){
		$onboarding.fadeOut(200);
	}

	// Set event listeners for the onboarding div
	$onboarding.find("[data-purpose='close']").click(function(){
		$.cookie("oo_onboarding_complete", "true", {
			expires: 1000
		});
	});

	// Set up the script promo onboarding
	if(!$.cookie("oo_script_promo_dismissed")){
		$scriptPromo.fadeIn(500);
		$scriptPromo.find("[data-purpose='close']").click(function(){
			// Make this cookie expire on browser being closed
			$.cookie("oo_script_promo_dismissed", "true");
			$scriptPromo.fadeOut(500);
		});
	}

	// Set up the instructor promo onboarding
	if(!$.cookie("oo_instructor_promo_dismissed")){
		$instructorPromo.fadeIn(500);
		$instructorPromo.find("[data-purpose='close']").click(function(){
			// Make this cookie expire on browser being closed
			$.cookie("oo_instructor_promo_dismissed", "true");
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
					// Make this cookie expire on browser being closed
					$.cookie("oo_sync_promo_dismissed", "true");
					$syncPromo.fadeOut(500);
				});
			}
		}
	};
});