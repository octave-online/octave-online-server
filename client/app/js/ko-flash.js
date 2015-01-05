define("ko-flash", ["knockout", "jquery"], function(ko, $){
	ko.bindingHandlers.flash = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			// This will be called when the binding is first applied to an element
			// Set up any initial state, event handlers, etc. here
			
			$(element).addClass("transition-property-bgcolor");
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			// This will be called once when the binding is first applied to an element,
			// and again whenever any observables/computeds that are accessed change
			// Update the DOM element based on the supplied values here.
			
			// Prevent this handler from being garbage collected
			$(element).attr("dummy-attribute", ko.unwrap(valueAccessor()));

			$(element).removeClass("transition-duration-medium");
			$(element).addClass("transition-duration-instant");
			$(element).addClass("ko-flash");
			setTimeout(function(){
				$(element).removeClass("transition-duration-instant");
				$(element).addClass("transition-duration-medium");
				$(element).removeClass("ko-flash");
			}, 500);
		}
	};
});