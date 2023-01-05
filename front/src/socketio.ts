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
import { config, rack, logger } from "./shared_wrap";

type Err = Error|null|undefined;

const ALL_FLAVORS = Object.keys(config.flavors);
const log = logger("oo-socketio");

// TODO: Consider using proper TypeScript types:
// https://socket.io/docs/v4/typescript/

export function init(){
	const io = new SocketIO.Server(ExpressApp.server, {
			path: config.front.socket_io_path,
			allowEIO3: true
		})
		.use(SocketIOWildcard())
		.use((socket, next)=>{
			// Parse the session using middleware
			Middleware.middleware(
				socket.request as Express.Request,
				{} as Express.Response,
				next
			);
		})
		.on("connection", SocketHandler.onConnection);

	if (config.rackspace.username !== "xxxxxxxxx") {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		watchFlavorServers(io);
	}

	log.info("Initialized Socket.IO Server", config.front.socket_io_path);
}

export function watchFlavorServers(io: SocketIO.Server) {
	Async.forever(
		(next: () => void) => {
			Async.map(ALL_FLAVORS, (flavor, _next) => {
				// TODO: Move this call somewhere it could be configurable.
				rack.getFlavorServers(flavor, _next);
			}, (err, results) => {
				if (err) {
					log.error("RACKSPACE ERROR", err);
				} else {
					results = results as any[];
					const rawServers = Array.prototype.concat.apply([], results.map((data) => { return (data as any).servers; }));
					const servers = rawServers.map((server) => {
						const { name, created, status } = server;
						return { name, created, status };
					});
					io.emit("oo.flavor-list", { servers });

					log.debug("Flavor Servers:");
					servers.forEach(({ name, created, status }) => {
						log.debug(name + " " + status + " " + created);
					});
				}
				setTimeout(next, config.front.flavor_log_interval);
			});
		},
		(err: Err) => {
			log.error("FOREVER ERROR", err);
		}
	);
}
