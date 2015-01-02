///<reference path='boris-typedefs/node/node.d.ts'/>

interface IAppConfig {
	mongodb: {
		hostname: string;
		db: string;
	}
	url: {
		protocol: string;
		hostname: string;
		port: number;
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