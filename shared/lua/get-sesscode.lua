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

local needs_octave_key = KEYS[1]
local token = ARGV[1]

-- TODO: An additional key is used in this script beyond the keys passed in from the arguments.  Could cause issue with clusters.

local sesscodes = redis.call("ZRANGE", needs_octave_key, 0, 0)

while table.getn(sesscodes) == 1
do
	local sesscode = sesscodes[1]
	redis.call("ZREM", needs_octave_key, sesscode)

	-- Check that the sesscode is still valid; if its hash was deleted, then we should discard this sesscode.
	local sess_info_key = "oo:session:" .. sesscode
	local exists = redis.call("EXISTS", sess_info_key)

	if exists == 1 then
		local user = redis.call("HGET", sess_info_key, "user")
		redis.call("HSET", sess_info_key, "worker", token)
		return {sesscode, user}

	else
		-- Try again; loop back to the top
		sesscodes = redis.call("ZRANGE", needs_octave_key, 0, 0)
	end
end

return -1
