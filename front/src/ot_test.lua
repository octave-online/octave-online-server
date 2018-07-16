-- Copyright © 2018, Octave Online LLC
--
-- This file is part of Octave Online Server.
--
-- Octave Online Server is free software: you can redistribute it and/or
-- modify it under the terms of the GNU Affero General Public License as
-- published by the Free Software Foundation, either version 3 of the License,
-- or (at your option) any later version.
--
-- Octave Online Server is distributed in the hope that it will be useful, but
-- WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
-- or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
-- License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with Octave Online Server.  If not, see
-- <https://www.gnu.org/licenses/>.

-- Tests for the OT implementation.

require "ot"

function table_equals(a,b)
	i = 1
	while a[i] ~= nil do
		if a[i] ~= b[i] then return false end
		i = i+1
	end
	if a[i]~=nil or b[i]~=nil then return false end
	return true
end

-- Test a few condense operations
ops = {5, "hello", -3, 6}
condense(ops)
assert(table_equals(ops, {5, "hello", -3, 6}))

ops = {5, -3, "hello", 6}
condense(ops)
assert(table_equals(ops, {5, "hello", -3, 6}))

ops = {2, 3, "he", -2, "llo", -1, 4, 2}
condense(ops)
assert(table_equals(ops, {5, "hello", -3, 6}))

-- Test some apply operations
str = apply("hello world", {6, "earth", -5})
assert(str == "hello earth")

ops1 = {6, "world", -5} -- lorem world
ops2 = {"hello", -5, 6} -- hello ipsum
str = apply(apply("lorem ipsum", ops1), ops2)
assert(str == "hello world")

-- Test a transform operation
str = "lorem ipsum"
ops1 = {6, "world", -5} -- lorem world
ops2 = {"hello", -5, 6} -- hello ipsum
ops1p, ops2p = transform(ops1, ops2) -- hello world
str1 = apply(apply(str, ops1), ops2p)
str2 = apply(apply(str, ops2), ops1p)
assert(str1 == str2)

-- Test some UTF-8 commands
str = "abçd"
assert(lutf8_len(str) == 4)
assert(lutf8_sub(str, 2, 3) == "bç")
