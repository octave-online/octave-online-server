///<reference path='../boris-typedefs/node/node.d.ts'/>

declare module 'uuid' {
	interface UuidOptionsV1 {
		node?: Buffer
		clockseq?: number
		msecs?: number
		nsecs?: number
	}

	interface UuidOptionsV4 {
		random: number
		rng: Function
	}

	module Uuid {
		export function v1(options: UuidOptionsV1, buffer: Buffer, offset: number): Buffer;
		export function v1(options?: UuidOptionsV1): string;

		export function v4(options: UuidOptionsV4, buffer: Buffer, offset: number): Buffer;
		export function v4(options?: UuidOptionsV4): string;

		export function parse(id: string, buffer?: Buffer, offset?: number): Buffer;
		export function unparse(id: Buffer, offset?: number): string;
	}

	export = Uuid;
}

