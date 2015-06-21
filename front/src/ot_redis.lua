-- Perform OT transformation in Redis
local rev = tonumber(ARGV[1])
local op = cjson.decode(ARGV[2])


