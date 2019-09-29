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

"use strict";

const log = require("..").logger("rackapi");
const mlog = require("..").logger("rackapi:minor");
const config = require("..").config;
const asyncCache = require("..").asyncCache;
const got = require("got");
const async = require("async");
const urlJoin = require("url-join");


function getToken(next) {
	mlog.trace("Requesting new token");
	// Note: a newer version of 'got' may add JSON auto-conversion,
	// but as of this writing, the feature is not stable. A newer version
	// also added baseUrl, but the version used here does not have that.
	const fullUrl = urlJoin(config.rackspace.identity_base_url, "tokens");
	got.post(fullUrl, {
		body: JSON.stringify({
			auth: {
				"RAX-KSKEY:apiKeyCredentials": {
					username: config.rackspace.username,
					apiKey: config.rackspace.api_key
				}
			}
		}),
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json"
		}
	}).then((data) => {
		let body = JSON.parse(data.body);
		let token = body.access.token;
		let expires = new Date(token.expires);
		log.trace("Got new token; expiration is:", expires);
		next(null, token, expires);
	}).catch(next);
}

// Store the token in ephemeral memory
let getCachedToken = asyncCache(getToken, 3600000);


function callRackspaceApi(method, url, jsonPayload, next) {
	if (method === "GET") {
		var query = jsonPayload;
		var body = undefined;
	} else {
		var query = "";
		var body = JSON.stringify(jsonPayload);
	}
	async.waterfall([
		getCachedToken,
		(token, _next) => {
			const fullUrl = urlJoin(config.rackspace.servers_base_url, url);
			log.trace("Sending API request to:", fullUrl);
			got(fullUrl, {
				method,
				query,
				body,
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json",
					"X-Auth-Token": token.id
				}
			}).then((response) => {
				mlog.trace("API response body", fullUrl, response.body);
				_next(null, JSON.parse(response.body));
			}).catch(_next);
		}
	], next);
}


module.exports = {
	callRackspaceApi: callRackspaceApi
};
