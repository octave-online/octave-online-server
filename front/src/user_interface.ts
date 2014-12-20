/// <reference path="boris-typedefs/mongoose/mongoose.d.ts"/>

import mongoose = require("mongoose");

interface IUser extends mongoose.Document {
	openid: {
		identifier: string
		profile: any
	}
	program: string
	parametrized: string
	consoleText: string
}

export = IUser