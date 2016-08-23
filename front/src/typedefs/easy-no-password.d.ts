/// <reference path="../boris-typedefs/passport/passport.d.ts"/>

declare module 'easy-no-password' {
	import passport = require('passport');
	import express = require('express');

	interface IStrategyOptions {
		secret: string;
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

