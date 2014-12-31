///<reference path='boris-typedefs/knockout/knockout.d.ts'/>

import ko = require("knockout");

module Test {
	export function hi() {
		console.log("Hello World");
		ko.applyBindings();
	}
}
export = Test;