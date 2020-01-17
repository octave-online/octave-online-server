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

// Small unit tests that are fast and don't require external services

"use strict";

const stream = require("stream");

const test = require("ava");

const shared = require("@oo/shared");

test("json byte stream", (t) => {
	{
		const pt = new stream.PassThrough();
		const jss = new shared.JSONStreamSafe(pt);

		// Objects that are expected out of the stream:
		const expectedObjects = [
			["a", "b"],
			["c"],
			"�",
			{ key: "�Ȗ��" },
			[]
		];

		let i = 0;
		// let closed = false;
		jss.on("data", (data) => {
			t.deepEqual(data, expectedObjects[i++], `Index ${i}`);
		});
		jss.on("end", () => {
			// closed = true;
		});

		// Write data to the stream:
		pt.write("[\"a\",\"b\"][\"c\"]");
		pt.write(Buffer.from([34, 128, 34]));
		pt.write("{\"key\":\"");
		pt.write(Buffer.from([
			237, 137, // 3-byte character missing third byte
			200, 150, // valid 2-byte char
			150, // dangling continuation char
			250 // lead char with nothing following
		]));
		pt.write("\"}");
		pt.write("[]");
		pt.end();

		// All objects should have been read:
		t.is(i, expectedObjects.length);

		// TODO: It seems the end event does not bubble through.
		// t.true(closed);
	}
});
