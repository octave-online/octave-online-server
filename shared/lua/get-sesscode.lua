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

-- FIXME: An additional key is used in this script beyond the keys passed in from the arguments.  Could cause issue with clusters.

local sesscodes = redis.call("ZRANGE", needs_octave_key, 0, 0)

if table.getn(sesscodes) == 1 then
	local sesscode = sesscodes[1]
	local sess_info_key = "oo:session:" .. sesscode
	redis.call("ZREM", needs_octave_key, sesscode)
	local user = redis.call("HGET", sess_info_key, "user")
	redis.call("HSET", sess_info_key, "worker", token)
	return {sesscode, user}
else
	return -1
end
