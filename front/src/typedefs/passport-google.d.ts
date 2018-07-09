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