///<reference path='iuser.ts'/>

interface IWorkspace {
	sessCode:string;

	destroyD(message:string): void;
	destroyU(message:string): void;
	dataD(name:string, val:any): void;
	dataU(name:string, val:any): void;
	beginOctaveRequest(): void;

	on(event:string, callback: (...args:any[])=>void):void;
	removeAllListeners(): void;
	subscribe(): void;
	unsubscribe(): void;
}
