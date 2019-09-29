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
///<reference path='boris-typedefs/socket.io/socket.io.d.ts'/>
///<reference path='boris-typedefs/express/express.d.ts'/>
///<reference path='typedefs/socketio-wildcard.d.ts'/>

import Config = require("./config");
import SocketIO = require("socket.io");
import Http = require("http");
import SocketIOWildcard = require("socketio-wildcard");
import Middleware = require("./session_middleware");
import SocketConnect = require("./socket_connect");
import ExpressApp = require("./express_setup");
import Express = require("express");
import Async = require("async");
import RackOperations = require("@oo/shared/rack/operations");

const ALL_FLAVORS = Object.keys(Config.flavors);

module S {
	export function init(){
		var io = SocketIO(ExpressApp.app)
			.use(SocketIOWildcard())
			.use((socket,next)=>{
				// Parse the session using middleware
				Middleware.middleware(socket.request, <Express.Response>{}, next);
			})
			.on("connection", SocketConnect.onConnection);

		S.watchFlavorServers(io);

		console.log("Initialized Socket.IO Server");
	}

	export function watchFlavorServers(io) {
		// This version of the typedefs doesn't know about the forever function
		(<any>Async).forever(
			(next) => {
				Async.map(ALL_FLAVORS, (flavor, _next) => {
					// TODO: Move this call somewhere it could be configurable.
					RackOperations.getFlavorServers(flavor, _next);
				}, (err, results) => {
					if (err) {
						console.error("RACKSPACE ERROR", err);
					} else {
						var rawServers = Array.prototype.concat.apply([], results.map((data) => { return (<any>data).servers; }));
						const servers = rawServers.map((server) => {
							var { name, created, status } = server;
							return { name, created, status };
						});
						io.emit("oo.flavor-list", { servers });

						console.log("Flavor Servers:");
						servers.forEach(({ name, created, status }) => {
							console.log(name + " " + status + " " + created);
						});
					}
					setTimeout(next, Config.front.flavor_log_interval);
				});
			},
			(err) => {
				console.error("FOREVER ERROR", err);
			}
		);
	}
}

export = S;