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

const log = require("../logger")("rack-ops");
const config = require("../config");
const config2 = require("../config-helper");
const rackapi = require("./rackapi");
const uuidv4 = require("uuid/v4");
const fs = require("fs");
const async = require("async");

function listFlavors(next) {
	rackapi.callRackspaceApi("GET", "/flavors", {}, next);
}

function getFlavorServers(flavor, next) {
	const flavorConfig = config2.flavor(flavor);
	if (!flavorConfig) {
		log.error("Unknown flavor", flavor);
		return next(new Error("Unknown flavor"));
	}
	rackapi.callRackspaceApi("GET", "/servers/detail", {
		name: "oo-flavor-" + flavor + "-.*"
	}, next);
}

function createFlavorServer(flavor, next) {
	const flavorConfig = config2.flavor(flavor);
	if (!flavorConfig) {
		log.error("Unknown flavor", flavor);
		return next(new Error("Unknown flavor"));
	}
	const serverName = "oo-flavor-" + flavor + "-" + uuidv4().substr(0, 13);
	const personality = JSON.stringify({
		flavor,
		serverName
	}) + "\n";
	const payload = {
		server: {
			name: serverName,
			flavorRef: flavorConfig.rackspaceFlavor,
			personality: [
				{
					path: config.rackspace.personality_filename,
					contents: Buffer.from(personality).toString("base64")
				}
			],
			networks: [
				{
					uuid: flavorConfig.network_uuid
				},
				{
					uuid: "00000000-0000-0000-0000-000000000000"
				},
				{
					uuid: "11111111-1111-1111-1111-111111111111"
				}
			]
		}
	};
	if (flavorConfig.blockVolume) {
		payload.server.block_device_mapping_v2 = [{
			boot_index: 0,
			uuid: flavorConfig.image_uuid,
			volume_size: 50,
			source_type: "image",
			destination_type: "volume",
			delete_on_termination: true
		}];
	} else {
		payload.server.imageRef = flavorConfig.image_uuid;
	}
	rackapi.callRackspaceApi("POST", "/servers", payload, next);
}

function doDeleteServer(serverName, next) {
	async.waterfall([
		(_next) => {
			rackapi.callRackspaceApi("GET", "/servers", {
				name: serverName
			}, _next);
		},
		(details, _next) => {
			if (!details || !details.servers) {
				log.error(details);
				return _next(new Error("Unexpected format of details"));
			}
			if (details.servers.length !== 1) {
				log.error(details);
				return _next(new Error("Too many or few servers in return list"));
			}
			const serverId = details.servers[0].id;
			rackapi.callRackspaceApi("DELETE", "/servers/" + serverId, {}, _next);
		}
	], next);
}

function deleteSelf(personality, next) {
	// Reload the personality from disk to double-check
	async.waterfall([
		(_next) => {
			fs.readFile(config.rackspace.personality_filename, _next);
		},
		(data, _next) => {
			const personality2 = JSON.parse(data.toString("utf8"));
			if (personality.serverName !== personality2.serverName) {
				log.error("Server name changed!", personality, personality2);
				return _next(new Error("Server name changed"));
			}
			doDeleteServer(personality.serverName, _next);
		}
	], next);
}

module.exports = {
	listFlavors,
	getFlavorServers,
	createFlavorServer,
	deleteSelf
};
