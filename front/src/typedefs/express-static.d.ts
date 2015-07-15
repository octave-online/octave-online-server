/// <reference path="../boris-typedefs/express/express.d.ts"/>
/// <reference path="../boris-typedefs/serve-static/serve-static.d.ts"/>

declare module 'compression' {
	import express = require('express');
	function constructor():express.RequestHandler;
	export = constructor;
}

declare module 'body-parser' {
	import express = require('express');
	function json():express.RequestHandler;
	function urlencoded(options:any):express.RequestHandler;
}