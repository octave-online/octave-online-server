import express = require("express");
import { config, logger } from "@oo/shared";

import * as Mongo from "./mongo";
import * as Passport from "./passport_setup";

const log = logger("app");

async function main() {
	try {
		log.trace("Connecting to Mongo...");
		await Mongo.connect();
		log.info("Connected to Mongo");
	} catch(err) {
		log.warn("Could not connect to Mongo:", err);
	}

	Passport.init();

	const app = express();
	app.get("/", (req, res) => res.send(config.client.title));
	app.listen(3000, () => console.log("Example app listening on port 3000!"));
}

main().catch((err) => {
	log.error(err);
});
