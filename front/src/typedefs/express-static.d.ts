/// <reference path="../boris-typedefs/express/express.d.ts"/>

declare module 'serve-static' {
	import express = require('express');
	function constructor(path:string):express.RequestHandler;
	export = constructor;
}

declare module 'compression' {
	import express = require('express');
	function constructor():express.RequestHandler;
	export = constructor;
}