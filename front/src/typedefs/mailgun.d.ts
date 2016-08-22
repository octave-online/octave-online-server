declare module 'mailgun-js' {
	interface IMessages {
		send: (options: any, cb: (err: Error, info?: any) => void) => void;
	}

	class Mailgun {
		// this isn't really static but it makes TypeScript happy
		static messages(): IMessages;
	}

	export = (options: any) => Mailgun;
}

