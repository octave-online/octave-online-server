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

import Crypto = require("crypto");
import { EventEmitter } from "events";

import { newRedisMessenger, redisUtil, rack, logger, ILogger } from "./shared_wrap";

type Err = Error|null;

export enum SessionState { Needed, Loading, Live }

const redisMessenger = newRedisMessenger();

class OctaveSessionHelper extends EventEmitter {
	private _log: ILogger;

	constructor() {
		super();
		this._log = logger("octave-helper");
	}

	public getNewSessCode(sessCodeGuess: string|null, next: (err: Err, sessCode: string, state: SessionState) => void){
		let sessCode = sessCodeGuess;

		// Check for proper sessCode format (possible attack vector)
		if (!redisUtil.isValidSessCode(sessCode)) sessCode = null;

		if (!sessCode) {
			// Case 1: No sessCode given
			this.makeSessCode((err,sessCode)=>{
				next(err, sessCode, SessionState.Needed);
			});

		} else {
			this.isValid(sessCode, (state)=> {
				if (state === SessionState.Needed) {
					// Case 2: Invalid sessCode given
					this.makeSessCode((err,sessCode)=>{
						next(err, sessCode, SessionState.Needed);
					});

				} else {
					// Case 3: Valid sessCode given
					next(null, sessCode!, state);
				}
			});
		}
	}

	public askForOctave(sessCode: string, content: any, next: (err: Err) => void) {
		if (content.flavor) {
			redisMessenger.putSessCodeFlavor(sessCode, content.flavor, content);
			// TODO: Move this call somewhere it could be configurable.
			rack.createFlavorServer(content.flavor, (err: Err) => {
				if (err) return this._log.error("RACKSPACE ERROR", err);
				this._log.trace("Spinning up new server with flavor", content.flavor);
			});
		} else {
			redisMessenger.putSessCode(sessCode, content);
		}
		// TODO: Should we do something more interesting for the callback?
		process.nextTick(() => {
			next(null);
		});
	}

	public sendDestroyD(sessCode: string, message: string) {
		this._log.trace("Sending Destroy-D", message, sessCode);
		redisMessenger.destroyD(sessCode, message);
	}

	private makeSessCode(next: (err: Err, sessCode: string) => void) {
		Crypto.pseudoRandomBytes(12, (err, buf) => {
			if (err) {
				return next(err, "zzz");
			}

			const sessCode = buf.toString("hex");
			next(null, sessCode);
		});
	}

	private isValid(sessCode: string, next: (valid: SessionState) => void) {
		redisMessenger.isValid(sessCode, (err: Err, valid: string|null) => {
			if (err) return this._log.error("REDIS ERROR", err);
			const state = (valid === null) ? SessionState.Needed
				: ((valid === "false") ? SessionState.Loading : SessionState.Live);
			next(state);
		});
	}
}

export const octaveHelper = new OctaveSessionHelper();
