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

// Mongoose Program: stores metadata about a program.

import Mongoose = require("mongoose");
import { logger, ILogger } from "./shared_wrap";
import { IUser } from "./user_model";

type ProgramModel = Mongoose.Model<IProgram, {}, IProgramMethods>;

// Initialize the schema
const programSchema = new Mongoose.Schema<IProgram, ProgramModel, IProgramMethods>({
	program_name: String,

	// Feature overrides
	tier_override: String,
	legal_time_override: Number,
	payload_limit_override: Number,
	countdown_extra_time_override: Number,
	countdown_request_time_override: Number,
	ads_disabled_override: Boolean,
});

programSchema.index({
	program_name: 1
});

// Workaround to make TypeScript apply signatures to the method definitions
interface IProgramMethods {
	logf(): ILogger;
}

export interface IProgram {
	_id: Mongoose.Types.ObjectId;
	program_name: string;

	// Feature overrides
	tier_override?: string;
	legal_time_override?: number;
	payload_limit_override?: number;
	countdown_extra_time_override?: number;
	countdown_request_time_override?: number;
	ads_disabled_override?: boolean;

	// Virtuals
	students: IUser[] | undefined;
}

// Virtuals to return results from sub-models
programSchema.virtual("students", {
	ref: "User",
	localField: "program_name",
	foreignField: "program",
	justOne: false,
});

programSchema.method("logf",
	function(): ILogger {
		return logger("program:" + this.id.valueOf());
	}
);

programSchema.set("toJSON", {
	virtuals: true
});

export const Program = Mongoose.model<IProgram, ProgramModel>("Program", programSchema);

Program.on("index", err => {
	if (err) logger("program-index").error(err);
	else logger("program-index").info("Init Success");
});
