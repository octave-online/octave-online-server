/// <reference path="../boris-typedefs/passport/passport.d.ts"/>

declare module 'passport-google' {
	import passport = require('passport');
	import express = require('express');

	interface IStrategyOptions {
		returnURL: string;
		realm: string;
		stateless: boolean;
	}

	interface VerifyFunction {
		(
			identifier: string,
			profile: any,
		    done: (error: any, user?: any) => void
		): void;
	}

	class Strategy implements passport.Strategy {
		constructor(options: IStrategyOptions, verify: VerifyFunction);
		authenticate: (req: express.Request, options?: Object) => void;
	}
}