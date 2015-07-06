// Assorted utility functions and polyfills

define(["jquery", "knockout"], function($, ko){
	// Safe Show/Hide Functions that retain display properties like flex.
	$.fn.hideSafe = function(){
		$(this).attr("aria-hidden", "true");
	};
	$.fn.showSafe = function(){
		$(this).attr("aria-hidden", "false");
	};
	$.fn.toggleSafe = function(bool){
		if(bool === true || $(this).attr("aria-hidden") === "true"){
			$(this).showSafe();
			return true;
		}else{
			$(this).hideSafe();
			return false;
		}
	};
	$.fn.fadeInSafe = function(duration){
		$(this).showSafe();
		$(this).css("display", "none");
		$(this).fadeIn(duration, function(){
			$(this).css("display", "");
		});
	};
	$.fn.fadeOutSafe = function(duration){
		$(this).showSafe();
		$(this).css("display", "block");
		$(this).fadeOut(duration, function(){
			$(this).hideSafe();
			$(this).css("display", "");
		})
	}
	ko.bindingHandlers.vizSafe = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		}
	};

	// Fade in/out bindings
	ko.bindingHandlers.fade = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			if(ko.unwrap(valueAccessor())){
				$(element).fadeInSafe(500);
			}else{
				$(element).fadeOutSafe(500);
			}
		}
	};
	ko.bindingHandlers.fadeIn = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			if(ko.unwrap(valueAccessor())){
				$(element).fadeInSafe(500);
			}else{
				$(element).hideSafe();
			}
		}
	};
	ko.bindingHandlers.fadeOut = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			if(ko.unwrap(valueAccessor())){
				$(element).showSafe();
			}else{
				$(element).fadeOutSafe(500);
			}
		}
	};

	// Toggle observable function
	ko.observable.fn.toggle = function () {
		var self = this;
		return function () {
			self(!self())
		};
	};
});