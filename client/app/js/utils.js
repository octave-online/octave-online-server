// Assorted utility functions and polyfills

define(["jquery", "knockout"], function($, ko){
	// Safe Show/Hide Functions that retain display properties like flex.
	$.fn.hideSafe = function(){
		$(this).css("display", "none");
	};
	$.fn.showSafe = function(){
		$(this).css("display", "");
	};
	$.fn.toggleSafe = function(bool){
		if(bool === true || $(this).css("display") === "none"){
			$(this).showSafe();
			return true;
		}else{
			$(this).hideSafe();
			return false;
		}
	};
	ko.bindingHandlers.vizSafe = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		}
	};

	// Fade in/out binding
	ko.bindingHandlers.fade = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			ko.unwrap(valueAccessor())
				? $(element).fadeIn({ duration: 1000 })
				: $(element).fadeOut({ duration: 1000 });
		}
	};
});