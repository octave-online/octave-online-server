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

///<reference path='boris-typedefs/node/node.d.ts'/>
///<reference path='boris-typedefs/mongoose/mongoose.d.ts'/>

// Mongoose Program: stores metadata about a program.

import Mongoose = require("mongoose");
import Config = require("./config");

// Patch for https://github.com/Automattic/mongoose/issues/4951
Mongoose.Promise = <any> global.Promise

// Initialize the schema
var programSchema = new Mongoose.Schema({
	program_name: String,
	tier_override: String,
	legal_time_override: Number,
	payload_limit_override: Number
});

programSchema.set("toJSON", {
	virtuals: true
});

// See comment in user_model.ts about the casting.
var Program = <any> Mongoose.model("Program", programSchema);
export = Program;
