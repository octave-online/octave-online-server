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

-- Set an OT document to the specified value using transformations.
-- Read arguments
local content = ARGV[1]
local message = cjson.decode(ARGV[2])
local op_expiretime = tonumber(ARGV[3])
local doc_expiretime = tonumber(ARGV[4])
local overwrite = ARGV[5]
local ops_key = KEYS[1]
local doc_key = KEYS[2]
local sub_key = KEYS[3]
local cnt_key = KEYS[4]

-- Load the document's current content from Redis
local old_content = redis.call("GET", doc_key)

if type(old_content)=="boolean" then
	-- Document doesn't exist.  Make an operation to set its content.
	message.ops = {content}

elseif old_content==content then
	-- Document exists and is already set to the desired value.  Exit.
	return 0

elseif overwrite=="overwrite" then
	-- Transform the old document into the new one.  The naive approach would
	-- be something like the following:
	message.ops = {-string.len(old_content), content}
	-- TODO: Figure out the best way to do this

else
	-- No action necessary
	return 0

end

-- Update Redis
redis.call("SET", doc_key, content)
redis.call("INCR", cnt_key)
redis.call("RPUSH", ops_key, cjson.encode(message.ops))
redis.call("PUBLISH", sub_key, cjson.encode(message))

-- Touch the operation keys' expire value
redis.call("EXPIRE", ops_key, op_expiretime)
redis.call("EXPIRE", doc_key, doc_expiretime)
redis.call("EXPIRE", cnt_key, doc_expiretime)

return 1