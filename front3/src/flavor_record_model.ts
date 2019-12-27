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

// Mongoose Flavor Record: logs the amount of time using flavor servers.

import Mongoose = require("mongoose");

// Initialize the schema
var flavorRecordSchema = new Mongoose.Schema({
	user_id: Mongoose.Schema.Types.ObjectId,
	sesscode: String,
	start: Date,
	current: Date,
	flavor: String
});

export interface IFlavorRecord extends Mongoose.Document {
	_id: Mongoose.Types.ObjectId;
	user_id: Mongoose.Types.ObjectId;
	sesscode: string;
	start: Date;
	current: Date;
	flavor: string;
};

export var FlavorRecord = Mongoose.model<IFlavorRecord>("FlavorRecord", flavorRecordSchema);
