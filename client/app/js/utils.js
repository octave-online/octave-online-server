// Assorted utility functions and polyfills

define(["jquery", "knockout", "js/anal"], function($, ko, anal){
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
				$(element).fadeInSafe(250);
			}else{
				$(element).fadeOutSafe(250);
			}
		}
	};
	ko.bindingHandlers.fadeIn = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			$(element).toggleSafe(ko.unwrap(valueAccessor()));
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			if(ko.unwrap(valueAccessor())){
				$(element).fadeInSafe(250);
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
				$(element).fadeOutSafe(250);
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

	// Add an extender to back an observable by localStorage
	ko.extenders.localStorage = function(obs, key) {
		key = "oo:" + key;

		// Restore value from localStorage
		if (window.localStorage[key]) {
			obs(JSON.parse(window.atob(window.localStorage[key])));
		}

		// Save changes to localStorage
		obs.subscribe(function(value){
			window.localStorage[key] = window.btoa(JSON.stringify(value));
		});
	};

	// Additional utility functions
	return {
		binarySearch: function(arr, value, getter) {
			var lo = 0;
			var hi = arr.length;
			while (lo + 1 < hi) {
				var mid = Math.floor((hi+lo)/2);
				var candidate = getter(arr[mid]);
				if (value === candidate) {
					lo = mid;
					break;
				} else if (value < candidate) {
					hi = mid;
				} else {
					lo = mid;
				}
			}
			if (lo < arr.length && value === getter(arr[lo])) {
				return arr[lo];
			}
			return null;
		},
		// Returns all elements of "universe" that are not in "remove".
		// Both arrays must be sorted.
		sortedFilter: function(universe, remove, getter) {
			var i1 = 0;
			var i2 = 0;
			var result = [];
			while (i1 < universe.length && i2 < remove.length) {
				var v1 = getter(universe[i1]);
				var v2 = getter(remove[i2]);
				if (v1 < v2) {
					result.push(universe[i1]);
					i1++;
				} else if (v1 === v2) {
					i1++;
					i2++;
				} else {
					i2++;
				}
			}
			for (var i = i1; i < universe.length; i++) {
				result.push(universe[i]);
			}
			return result;
		},
		// Shows an alert box, and logs it to Google Analytics.
		alert: function(message) {
			anal.alert(message);
			window.alert(message);
		}
	}
});
