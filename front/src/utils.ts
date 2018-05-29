///<reference path='boris-typedefs/node/node.d.ts'/>

import Crypto = require("crypto");

module Utils {
	export function emailHash(email) {
		return "email:" + Crypto.createHash("md5").update(email).digest("hex").substr(0, 12);
	}
}

export = Utils
