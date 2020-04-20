/*
 * Copyright © 2019, Octave Online LLC
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

declare module 'easy-no-password' {

	export = easy_no_password;

	type Err = Error | null;

	interface Data {
		stage: number;
		username: string;
		token?: string;
	}

	interface Options {
		secret: string;
		passReqToCallback?: boolean;
		maxTokenAge?: number;
	}

	type VerifiedFn = (err: Err, user?: unknown, info?: any) => void;

	type VerifyFn = ((username: string, verified: VerifiedFn) => void)
		| ((req: any, username: string, verified: VerifiedFn) => void);


	class EasyNoPassword {
		createToken(username: string, next: (err: Err, token?: string) => void): void;
		isValid(token: string, username: string, next: (err: Err, isValid?: boolean) => void): void;
	}

	function easy_no_password(secret: string, maxTokenAge: number): EasyNoPassword;

	namespace easy_no_password {
		export class Strategy {
			constructor(
				options: Options,
				parseRequest: (req: any) => Data | null,
				sendToken: (username: string, token: string, next: (err: Err) => void) => void,
				verify: VerifyFn);
			authenticate(req: any): void;
		}
	}

}
