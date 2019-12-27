"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const shared_1 = require("@oo/shared");
const Mongo = require("./mongo");
const Passport = require("./passport_setup");
const log = shared_1.logger("app");
async function main() {
    try {
        log.trace("Connecting to Mongo...");
        await Mongo.connect();
        log.info("Connected to Mongo");
    }
    catch (err) {
        log.warn("Could not connect to Mongo:", err);
    }
    Passport.init();
    const app = express();
    app.get("/", (req, res) => res.send(shared_1.config.client.title));
    app.listen(3000, () => console.log("Example app listening on port 3000!"));
}
main().catch((err) => {
    log.error(err);
});
