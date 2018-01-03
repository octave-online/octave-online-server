///<reference path="../boris-typedefs/mongoose/mongoose.d.ts"/>

// See comments about TypeScript and Mongoose in iuser.ts

interface IBucket /* extends require("mongoose").Document */ {
	bucket_id: string
	user_id: string
	main: string

	// Extended methods from Mongoose Document
	save<T>(callback?: (err: any, res: T) => void): void
	remove<T>(callback?: (err: any, res: T) => void): void
}
