define(["jquery", "knockout"], function($, ko){
	var active = false, obsArr, xRef, index, element;
	function cbmove(e){
		if (!active) return;
		e.preventDefault();
		var arr = obsArr();
		var i, j;

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