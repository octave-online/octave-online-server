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

///<reference path='boris-typedefs/node/node.d.ts'/>

interface IAppConfig {
	front: {
		protocol: string;
		hostname: string;
		port: number;
		listen_port: number;
		static_path: string;
		cookie: {
			name: string;
			secret: string;
			max_age: number;
		}
	}
	auth: {
		google: {
			oauth_key: string;
			oauth_secret: string;
		}
		easy: {
			secret: string;
		}
		password: {
			salt_rounds: number;
		}
	}
	mailgun: {
		api_key: string;
		domain: string;
	}
	mongo: {
		hostname: string;
		db: string;
	}
	redis: {
		hostname: string;
		port: number;
		options: any;
		expire: {
			interval: number;
			timeout: number;
		}
		maxPayload: number;
	}
	ot: {
		operation_expire: number;
		stats_interval: number;
		document_expire: {
			interval: number;
			timeout: number;
		}
	}
	session: {
		legalTime: {
			guest: number;
			user: number;
		}
		payloadLimit: {
			guest: number;
			user: number;
		}
	}
	tiers: any;
}

var appConfig:IAppConfig = require("@oo/shared").config;
export = appConfig;