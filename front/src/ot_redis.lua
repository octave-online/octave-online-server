-- Perform operations on server.
-- Read arguments
local rev = tonumber(ARGV[1])
local message = cjson.decode(ARGV[2])
local ops_key = KEYS[1]
local doc_key = KEYS[2]
local sub_key = KEYS[3]

-- Load concurrent operations
local concurrent = redis.call("LRANGE", ops_key, rev, 4294967295)

-- Transform the new operation against all the concurrent operations
if concurrent then
	for i,cops in pairs(concurrent) do
		message.ops = transform(message.ops, cjson.decode(cops))
	end
end

-- Save the operation
redis.call("RPUSH", ops_key, cjson.encode(message.ops))

-- Load and apply to the document
local doc = redis.call("GET", doc_key)
if type(doc)=="boolean" then doc="" end
doc = apply(doc, message.ops)
redis.call("SET", doc_key, doc)

-- Publish to the subscribe channel
redis.call("PUBLISH", sub_key, cjson.encode(message))
