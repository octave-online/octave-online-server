///<reference path='../boris-typedefs/redis/redis.d.ts'/>


declare module 'redis-heartbeat' {
	import Redis = require("redis");

	interface IHeartbeatOptions {
		name:string;
		identifier:string;
		intervalHeartbeat?:number;
		heartbeatKey?:string;
		intervalMetrics?:number;
		metricsKey?:string;
		metricCount?:number;
		useRedisTime?:boolean;
		autostart?:boolean;
		host?:string;
		port?:number;
		options?:any;
		client?:Redis.RedisClient;
		redisprefix?:string;
	}

	class Heartbeat {
		constructor(options:IHeartbeatOptions);

		start():boolean;
		stop():void;
		isActive():boolean;
	}

	export = Heartbeat;
}

