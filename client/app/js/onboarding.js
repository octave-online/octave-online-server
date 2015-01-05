// Handle the "onboarding" demonstration div

define(["jquery", "jquery.cookie"], function($){
	var $onboarding = $("#onboarding"),
		$scriptPromo = $("#login-promo");

	// Check for the cookie now
	if($.cookie("oo_onboarding_complete") === "true"){
		$onboarding.fadeOut(200);
	}

	// Set event listeners for the onboarding div
	$onboarding.find("[data-purpose='close']").each(function(){
		$(this).click(function(){
			$.cookie("oo_onboarding_complete", "true", {
				expires: 1000
			});
			$onboarding.fadeOut(200);

			// We need to use require() here because of a circular reference
			require("client").prompt.focus();
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

	// Expose an API
	return {
		reset: function(){
			// Delete the cookie
			$.cookie("oo_onboarding_complete", null);
		}
	};
});