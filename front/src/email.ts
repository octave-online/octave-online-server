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

import Postmark = require("postmark");

import { config, logger } from "./shared_wrap";

const log = logger("email");

let postmarkClient: Postmark.ServerClient|null = null;

if (config.email.provider === "mailgun") {
	log.warn("Mailgun is no longer supported. Feel free to open a PR to add support. See #43");
} else {
	postmarkClient = new Postmark.ServerClient(config.postmark.serverToken);
}

export async function sendLoginToken(email: string, token: string, url: string) {
	if (postmarkClient) {
		const response = await postmarkClient.sendEmailWithTemplate({
			TemplateAlias: config.postmark.templateAlias,
			From: config.email.from,
			To: email,
			TemplateModel: {
				product_name: config.email.productName,
				token_string: token,
				action_url: url,
				support_url: config.email.supportUrl
			}
		});
		log.trace(response);
	} else {
		log.error("Unable to send email: please configure an email client for Octave Online");
	}
}

export async function sendZipArchive(email: string, url: string) {
	if (postmarkClient) {
		const response = await postmarkClient.sendEmailWithTemplate({
			TemplateAlias: config.postmark.onDemandSnapshots.template,
			From: config.email.from,
			To: email,
			TemplateModel: {
				product_name: config.email.productName,
				action_url: url,
				support_url: config.email.supportUrl
			},
  		MessageStream: config.postmark.onDemandSnapshots.stream,
		});
		log.trace(response);
	} else {
		log.error("Unable to send email: please configure an email client for Octave Online");
	}
}
