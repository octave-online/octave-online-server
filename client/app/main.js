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

// Main RequireJS configuration for local builds.

require.config({
	waitSeconds: 0,
	paths: {
		// jQuery and Plugins
		"jquery": "vendor/jquery/dist/jquery",
		"jquery.cookie": "vendor/jquery.cookie/jquery.cookie",
		"jquery.md5": "vendor/jquery-md5/jquery.md5",
		"jquery.purl": "vendor/purl/purl",

		// Vendor Libraries
		"canvg": "vendor/canvg/dist/canvg.bundle",
		"knockout": "vendor/knockoutjs/dist/knockout.debug",
		"splittr": "vendor/splittr/splittr",
		"filesaver": "vendor/FileSaver/FileSaver",
		"canvas-toblob": "vendor/canvas-toBlob.js/canvas-toBlob",
		"blob": "vendor/blob/Blob",
		"ot": "vendor/ot/dist/ot",

		// NPM Libraries
		"SocketIOFileUpload": "../node_modules/socketio-file-upload/client",
		"socket.io": "../node_modules/socket.io-client/socket.io",

		// Local Libraries
		"ismobile": "js/detectmobilebrowser",
		"base64": "js/base64v1.module",
		"base64-toblob": "js/base64-toBlob",
		"ko-takeArray": "js/ko-takeArray",
		"ko-flash": "js/ko-flash"
	},
	packages: [
		{
			name: "ace",
			location: "vendor/ace/lib/ace",
			main: "ace"
		}
	],
	shim: {
		// jQuery Plugins
		"jquery.md5": ["jquery"],
		"jquery.purl": ["jquery"],

		// CanVG
		"canvg": {
			exports: "canvg"
		},

		// ot.js
		"ot": {
			exports: "ot"
		},

		// Other Libraries
		"filesaver": {
			deps: ["canvas-toblob", "blob"]
		}
	}
});
