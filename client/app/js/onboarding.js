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

// Handle the "onboarding" demonstration div

define(["jquery", "js/anal", "jquery.cookie", "js/utils"], function($, anal){
	var $onboarding = $("#onboarding"),
		$scriptPromo = $("#login-promo"),
		$instructorPromo = $("#instructor-promo"),
		$syncPromo = $("#sync-promo"),
		$sharePromo = $("#share-promo"),
		$createBucketPromo = $("#create-bucket-promo"),
		$bucketPromo = $("#bucket-promo"),
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

	// Set the listener for create-bucket
	var createBucketPromoShown = false;
	$createBucketPromo.find("[data-purpose='close']").click(function(){
		$.cookie("oo_create_bucket_promo_dismissed", "true", {
			expires: MIN_TIME
		});
		anal.dismiss("Create Bucket");
		$createBucketPromo.fadeOutSafe(500);
		createBucketPromoShown = false;
	});

	// Expose an API
	const onboarding = {
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
		toggleCreateBucketPromo: function(show) {
			if (!show && createBucketPromoShown) {
				$createBucketPromo.hideSafe();
				createBucketPromoShown = false;
			} else if (show && !createBucketPromoShown && !$.cookie("oo_create_bucket_promo_dismissed")) {
				$createBucketPromo.fadeInSafe(500);
				createBucketPromoShown = true;
				// Hack: we need to wait until the editor is shown before repositioning
				setTimeout(onboarding.reposition, 0);
			}
		},
		hideScriptPromo: function(){
			$scriptPromo.hideSafe();
			$sharePromo.hideSafe();
		},
		showBucketPromo: function() {
			$scriptPromo.hideSafe();
			$bucketPromo.showSafe();
			$bucketPromo.find("[data-purpose='close']").click(function(){
				// Don't persist the dismissal of this one.
				anal.dismiss("Sign in for Buckets");
				$bucketPromo.fadeOutSafe(500);
			});
		},
		hideBucketPromo: function() {
			$bucketPromo.hideSafe();
		},
		reposition: function() {
			var $syncButton = $("#files_toolbar_info");
			var $cbucketButton = $("#editor_share");
			if ($syncButton.length) {
				$syncPromo.css("left", ($syncButton.offset().left-2) + "px");
			}
			if ($cbucketButton.length) {
				$createBucketPromo.css("left", ($cbucketButton.offset().left-2) + "px");
			}
		}
	};
	return onboarding;
});