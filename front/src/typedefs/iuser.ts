///<reference path="../boris-typedefs/mongoose/mongoose.d.ts"/>

// I've spent too much time fighting with TypeScript to be able to make IUser
// extend Mongoose.Document the right way.  If you can figure this out, please
// go right ahead and submit a pull request.  I'm really questioning whether
// TypeScript was the right decision for this project...

interface IUser /* extends require("mongoose").Document */ {
	email: string
	parametrized: string
	profile: any
	openid: {
		identifier: string
		profile: any
	}
	repo_key: string
	program: string
	instructor: string[]

	// Virtuals
	displayName: string
	consoleText: string

	// Extended methods from Mongoose Document
	save<T>(callback?: (err: any, res: T) => void): void
}
