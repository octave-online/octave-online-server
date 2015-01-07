///<reference path='boris-typedefs/node/node.d.ts'/>

interface IAppConfig {
	static: {
		path: string;
	}
	mongodb: {
		hostname: string;
		db: string;
	}
	git: {
		path: string;
	}
	url: {
		protocol: string;
		hostname: string;
		port: number;
		listen_port: number;
	}
	google: {
		oauth_key: string;
		oauth_secret: string;
	}
	cookie: {
		name: string;
		secret: string;
		max_age: number;
	}
	redis: {
		hostname: string;
		port: number;
		options: any;
		expire: {
			interval: number;
			timeout: number;
		}
	}
}

var appConfig:IAppConfig = require("../config/app.json");
export = appConfig;