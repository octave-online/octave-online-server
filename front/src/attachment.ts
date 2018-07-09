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
///<reference path='boris-typedefs/redis/redis.d.ts'/>
///<reference path='typedefs/uuid.d.ts'/>

import Redis = require("redis");
import IRedis = require("./typedefs/iredis");
import Config = require("./config");
import Uuid = require("uuid");

export function serializeMessage(name: string, content: any): string {
	// Protect against name length
	if (name.length > Config.redis.maxPayload)
		throw new Error("ERROR: Name length exceeds max redis payload length!");

	// If data is too long, save it as an "attachment"
	let contentString = JSON.stringify(content);
	if (contentString.length > Config.redis.maxPayload) {
		let id = Uuid.v4();
		console.log("Sending content as attachment:", name, id, contentString.length);
		uploadAttachment(id, contentString, (err) => {
			if (err) console.log("UPLOAD ATTACHMENT ERROR", err);
		});
		return JSON.stringify({ name, attachment: id });
	}

	// The message can be processed in one chunk!
	return JSON.stringify({ name, data: content });
}

export function loadMessage(message: IRedis.Message, next: (name: string, content: any) => void) {
	if (message.data) return process.nextTick(() => {
		next(message.name, message.data);
	});

	else return downloadAttachment(message.attachment, (err, contentString) => {
		if (err) console.log("LOAD ATTACHMENT ERROR", err);
		console.log("Received content as attachment:", message.name, message.attachment, contentString.length);
		try {
			next(message.name, JSON.parse(contentString));
		} catch (err) {
			console.log("ATTACHMENT PARSE ERROR", err);
			next(message.name, {});
		}
	});
}

export function uploadAttachment(id: string, contentString: string, next: (err: Error) => void) {
	let channel = IRedis.Chan.attachment(id);

	// Create a new client to offload bandwidth from the main artery channel
	let client = IRedis.createClient();
	client.on("error", console.log);

	// Upload the attachment along with an expire time
	let multi = client.multi();
	multi.lpush(channel, contentString);
	multi.expire(channel, Config.redis.expire.timeout);
	multi.exec((err) => {
		client.quit();
		next(err);
	});
}

export function downloadAttachment(id: string, next: (err: Error, contentString: string) => void) {
	let channel = IRedis.Chan.attachment(id);

	// Create a new client to offload bandwidth from the main artery channel
	let client = IRedis.createClient();
	client.on("error", console.log);

	// Download the attachment
	client.brpoplpush(channel, channel, Config.redis.expire.timeout, (err, response) => {
		client.quit();
		if (response) {
			// Succeeded getting the data
			next(err, response);
		} else {
			// Timeout
			next(err, JSON.stringify(null));
		}
	});
}
