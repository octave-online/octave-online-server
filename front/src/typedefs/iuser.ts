///<reference path="../boris-typedefs/mongodb/mongodb.d.ts"/>
///<reference path="../boris-typedefs/mongoose/mongoose.d.ts"/>

// I've spent too much time fighting with TypeScript to be able to make IUser
// extend Mongoose.Document the right way.  If you can figure this out, please
// go right ahead and submit a pull request.  I'm really questioning whether
// TypeScript was the right decision for this project...

const mongodb = require("mongodb");

interface IUser /* extends require("mongoose").Document */ {
	_id: typeof mongodb.ObjectID
	email: string
	parametrized: string
	profile: any
	openid: {
		identifier: string
		profile: any
	}
	repo_key: string
	share_key: string
	program: string
	instructor: string[]

	// Virtuals
	displayName: string
	consoleText: string

	// Methods
	createShareKey(callback?:(err?:any)=>void): void
	removeShareKey(callback?:(err?:any)=>void): void
	setPassword(password:string, callback?:(err?:any)=>void): void
	checkPassword(password:string, callback?:(err:any, success:boolean)=>void): void

	// Extended methods from Mongoose Document
	save<T>(callback?: (err: any, res: T) => void): void
}
