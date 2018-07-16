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