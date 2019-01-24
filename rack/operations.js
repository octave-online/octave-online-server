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

const log = require("@oo/shared").logger("rack-ops");
const mlog = require("@oo/shared").logger("rack-ops:minor");
const config = require("@oo/shared").config;
const rackapi = require("./rackapi");
const uuidv4 = require("uuid/v4");

function createFlavorServer(flavor, next) {
	const serverName = "oo-" + flavor + "-" + uuidv4().substr(0, 13);
	const personality = JSON.stringify({
		flavor,
		serverName
	});
	rackapi.callRackspaceApi("POST", "/servers", {
		server: {
			name: serverName,
			imageRef: "",
			flavorRef: config.flavors[flavor].rackspaceFlavor,
			block_device_mapping_v2: [
				{
					boot_index: 0,
					uuid: config.rackspace.image_uuid,
					volume_size: 50,
					source_type: "image",
					destination_type: "volume",
					delete_on_termination: true
				}
			],
			personality: [
				{
					path: config.rackspace.personality_filename,
					contents: Buffer.from(personality).toString("base64")
				}
			],
			networks: [
				{
					uuid: config.rackspace.network_uuid
				},
				{
					uuid: "00000000-0000-0000-0000-000000000000"
				},
				{
					uuid: "11111111-1111-1111-1111-111111111111"
				}
			]
		}
	}, next);
}

module.exports = {
	createFlavorServer
};
