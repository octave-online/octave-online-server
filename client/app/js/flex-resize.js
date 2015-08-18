define(["jquery", "knockout"], function($, ko){
	var active = false, obsArr, xRef, index, element;
	function cbmove(e){
		if (!active) return;
		e.preventDefault();
		var arr = obsArr();
		var i, j;

		// Try to be a little bit smart as to how much of a jump we need.
		// This calculation is an approximation only.  The second section of
		// this function will fix any errors.
		var windowWidth = $(window).width();
		var flexWidth = arr.reduce(function(s,x){ return s+x }, 0);
		var dist = e.pageX - $(element).offset().left - xRef;
		var jump = Math.round(windowWidth/flexWidth*dist);
		if(jump > 0){
			// Move Right
			for(i=index; jump>0 && i<arr.length; i++){
				var m = Math.min(jump, arr[i]);
				arr[index-1] += m;
				arr[i] -= m;
				jump -= m;
			}
		}else if(jump < 0){
			// Move Left
			for(i=index-1; jump<0 && i>-1; i--){
				var m = Math.min(Math.abs(jump), arr[i]);
				arr[i] -= m;
				arr[index] += m;
				jump += m;
			}
		}
		obsArr.valueHasMutated();

		// Now do fine-tuning
		// Limit to 25 iterations to help prevent infinite loops
		// Move Right
		for(i=0; e.pageX - $(element).offset().left > xRef && i<25; i++){
			for(j=index; arr[j]===0 && j<arr.length; j++){}
			if (j===arr.length) break;

			arr[index-1] += 1;
			arr[j] -= 1;
			obsArr.valueHasMutated();
		}
		// Move Left
		for(var i=0; e.pageX - $(element).offset().left < xRef && i<25; i++){
			for(j=index-1; arr[j]===0 && j>-1; j--){}
			if (j===-1) break;

			arr[j] -= 1;
			arr[index] += 1;
			obsArr.valueHasMutated();
		}

		// Update the reference point
		xRef = e.pageX - $(element).offset().left;
	};
	function cbdown(e, _obsArr){
		active = true;
		obsArr = _obsArr;
		xRef = e.pageX - $(this).offset().left;
		index = $(this).data("index");
		element = this;
		$(document).on("mousemove", cbmove);
		$(document).on("touchmove", cbmove);
		$(document).on("mouseup", cbup);
		$(document).on("touchend", cbup);
	};
	function cbup(e){
		active = false;
		$(document).off("mousemove", cbmove);
		$(document).off("touchmove", cbmove);
		$(document).off("mouseup", cbup);
		$(document).off("touchend", cbup);

		// Fire a window "resize" event to make sure everything adjusts,
		// like the ACE editor
		var evt = document.createEvent("UIEvents");
		evt.initUIEvent("resize", true, false, window, 0);
		window.dispatchEvent(evt);
	};

	ko.bindingHandlers.resizeFlex = {
		init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			var obj = valueAccessor();
			var index = ko.utils.unwrapObservable(obj.index);
			if (index === 0) return;
			var handle = $("<div>");
			handle.addClass("handle");
			handle.data("index", index);
			handle.on("mousedown", function(e){
				cbdown.call(handle, e, obj.group);
			});
			handle.on("touchstart", function(e){
				cbdown.call(handle, e, obj.group);
			});
			window.viewModel.flex.shown.subscribe(function(newValue){
				handle.toggleSafe(newValue);
			});
			handle.hideSafe();
			$(element).append(handle);
		},
		update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
			var obj = valueAccessor();
			var sizes = ko.utils.unwrapObservable(obj.group);
			var index = ko.utils.unwrapObservable(obj.index);
			var styleString = sizes[index] + "px";
			if ($(element).css("flex-basis") !== styleString) {
				$(element).css("flex-basis", styleString);
			}
		}
	};

	// This part of the code is not portable
	$(document).ready(function(){
		$(document).on("mouseover", function(e){
			window.viewModel.flex.shown(
				active
				|| $(e.target).attr("data-hover") === "flex"
				|| $(e.target).hasClass("handle"));
		});
	});
});