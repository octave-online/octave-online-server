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