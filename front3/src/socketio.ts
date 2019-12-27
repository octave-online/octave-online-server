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

import Async = require("async");
import Express = require("express");
import SocketIO = require("socket.io");
import SocketIOWildcard = require("socketio-wildcard");

import * as ExpressApp from "./express_setup";
import * as Middleware from "./session_middleware";
import { SocketHandler } from "./socket_connect";
import { config, rack } from "@oo/shared";

type Err = Error|null;

const ALL_FLAVORS = Object.keys(config.flavors);

export function init(){
	var io = SocketIO(ExpressApp.app)
		.use(SocketIOWildcard())
		.use((socket,next)=>{
			// Parse the session using middleware
			Middleware.middleware(socket.request, <Express.Response>{}, next);
		})
		.on("connection", SocketHandler.onConnection);

	watchFlavorServers(io);

	console.log("Initialized Socket.IO Server");
}

export function watchFlavorServers(io: SocketIO.Namespace) {
	// This version of the typedefs doesn't know about the forever function
	(<any>Async).forever(
		(next: () => void) => {
			Async.map(ALL_FLAVORS, (flavor, _next) => {
				// TODO: Move this call somewhere it could be configurable.
				rack.getFlavorServers(flavor, _next);
			}, (err, results) => {
				if (err) {
					console.error("RACKSPACE ERROR", err);
				} else {
					results = results as any[];
					var rawServers = Array.prototype.concat.apply([], results.map((data) => { return (data as any).servers; }));
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
				setTimeout(next, config.front.flavor_log_interval);
			});
		},
		(err: Err) => {
			console.error("FOREVER ERROR", err);
		}
	);
}
