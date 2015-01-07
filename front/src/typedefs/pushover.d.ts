// Type definitions for pushover
// Project: https://github.com/substack/pushover
// Definitions by: Shane Carr <https://github.com/vote539/>
// 
///<reference path='../boris-typedefs/node/node.d.ts'/>

declare module 'pushover' {
	import http = require("http");

	interface CbErr {
		(err:Error): void;
	}

	interface PushoverCls extends NodeJS.EventEmitter {
		handle(req:http.ServerRequest, res:http.ServerResponse): void;
		create(repoName:string, cb:CbErr): void;
		mkdir(dir:string, cb:CbErr): void;
		list(cb:(err:Error, repos:string[])=>void): void;
		exists(repoName:string, cb:(exists:boolean)=>void): void;
	}

	interface PushoverOptions {
		autoCreate?: boolean;
		checkout?: boolean;
	}

	function pushover (path:string, options?:PushoverOptions): PushoverCls;
	export = pushover;
}