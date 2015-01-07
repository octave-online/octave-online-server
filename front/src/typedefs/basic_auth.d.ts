/// <reference path="../boris-typedefs/express/express.d.ts" />

declare module Express {
	interface BasicAuth {
		username: string;
		password: string;
	}

	export interface Request {
		basic_auth: BasicAuth;
	}
}