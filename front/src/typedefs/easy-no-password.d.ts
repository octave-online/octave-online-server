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

/// <reference path="../boris-typedefs/passport/passport.d.ts"/>

declare module 'easy-no-password' {
	import passport = require('passport');
	import express = require('express');

	interface IStrategyOptions {
		secret: string;
		maxTokenAge: number;
	}

	interface IRequestData {
		stage: number;
		username: string;
		token?: string;
	}

	interface ParseRequestFunction {
		(
			req: express.Request
		): IRequestData;
	}

	interface SendTokenFunction {
		(
			email: string,
			url: string,
			done: (error: any) => void
		): void;
	}

	interface VerifyFunction {
		(
			email: string,
			done: (error: any, user?: any) => void
		): void;
	}

	class EasyStrategy implements passport.Strategy {
		authenticate: (req: express.Request, options?: Object) => void;
	}

	class EasyNoPassword {
		constructor(secret:string, timestamp?:number);
		createToken(username:string, cb:(err:Error, token:string)=>void): void;
		isValid(token:string, username:string, cb:(err:Error, isValid:boolean)=>void): void;

		static Strategy(options: IStrategyOptions, parseRequest: ParseRequestFunction, sendToken: SendTokenFunction, verify: VerifyFunction): void;  // TODO: this is the EasyStrategy constructor, but I can't figure out how to make Typescript recognize that
	}

	export = EasyNoPassword;
}

