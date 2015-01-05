/// <reference path="../boris-typedefs/passport/passport.d.ts"/>

declare module 'passport-google-oauth' {
	import passport = require('passport');
	import express = require('express');

	interface IStrategyOptions {
		callbackURL: string;
		clientID: string;
		clientSecret: string;
	}

	interface VerifyFunction {
		(
			accessToken: string,
			refreshToken: string,
			profile: any,
			done: (error: any, user?: any) => void
		): void;
	}

	class OAuth2Strategy implements passport.Strategy {
		constructor(options: IStrategyOptions, verify: VerifyFunction);
		authenticate: (req: express.Request, options?: Object) => void;
	}
}

declare module 'passport-persona' {
	import passport = require('passport');
	import express = require('express');

	interface IStrategyOptions {
		audience: string;
	}

	interface VerifyFunction {
		(
			email: string,
			done: (error: any, user?: any) => void
		): void;
	}

	class Strategy implements passport.Strategy {
		constructor(options: IStrategyOptions, verify: VerifyFunction);
		authenticate: (req: express.Request, options?: Object) => void;
	}
}