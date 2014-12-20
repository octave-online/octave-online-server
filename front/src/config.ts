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
}

var appConfig:IAppConfig = require("../config/app.json");
export = appConfig;