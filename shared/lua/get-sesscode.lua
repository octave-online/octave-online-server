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
