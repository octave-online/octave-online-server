/// <reference path="boris-typedefs/mongoose/mongoose.d.ts"/>

import mongoose = require("mongoose");

interface IUser extends mongoose.Document {
	email: string
	parametrized: string
	profile: any
	openid: {
		identifier: string
		profile: any
	}
	repo_key: string
	program: string
	instructor: {
		program: string
		password: string
	}

	// Virtuals
	displayName: string
	consoleText: string
}

export = IUser