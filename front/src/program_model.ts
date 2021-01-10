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
import { User, IUser } from "./user_model";

type Err = Error | null;

// Initialize the schema
const programSchema = new Mongoose.Schema({
	program_name: String,

	// Feature overrides
	tier_override: String,
	legal_time_override: Number,
	payload_limit_override: Number,
	countdown_extra_time_override: Number,
	countdown_request_time_override: Number,
	ads_disabled_override: Boolean,
});

// Workaround to make TypeScript apply signatures to the method definitions
interface IProgramMethods {
	loadStudents(next: (err: Err, program: IProgram) => void): void;
	logf(): ILogger;
}

export interface IProgram extends Mongoose.Document, IProgramMethods {
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

	// Cached sub-models
	_students?: IUser[];
}

// Virtuals for return results from sub-models
programSchema.virtual("students").get(function(this: IProgram) {
	return this._students;
});

// Define the methods in a class to help TypeScript
class ProgramMethods implements IProgramMethods {
	loadStudents(this: IProgram, next: (err: Err, program: IProgram) => void): void {
		User.find({ program: this.program_name }, (err, students) => {
			if (err) return next(err, this);
			this.logf().trace("Loaded students:", students?.length);
			this._students = students;
			next(err, this);
		});
	}

	logf(this: IProgram): ILogger {
		return logger("program:" + this.id.valueOf());
	}
}

// Copy the methods into programSchema
programSchema.methods.loadStudents = ProgramMethods.prototype.loadStudents;
programSchema.methods.logf = ProgramMethods.prototype.logf;

programSchema.set("toJSON", {
	virtuals: true
});

export const Program = Mongoose.model<IProgram>("Program", programSchema);
