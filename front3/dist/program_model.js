"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// Mongoose Program: stores metadata about a program.
const Mongoose = require("mongoose");
// Initialize the schema
var programSchema = new Mongoose.Schema({
    program_name: String,
    tier_override: String,
    legal_time_override: Number,
    payload_limit_override: Number,
    countdown_extra_time_override: Number,
    countdown_request_time_override: Number,
});
;
programSchema.set("toJSON", {
    virtuals: true
});
exports.Program = Mongoose.model("Program", programSchema);
