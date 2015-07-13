-- Perform operations on server.
-- Read arguments
local rev = tonumber(ARGV[1])
local message = cjson.decode(ARGV[2])
local expiretime = tonumber(ARGV[3])
local ops_key = KEYS[1]
local doc_key = KEYS[2]
local sub_key = KEYS[3]
local cnt_key = KEYS[4]

-- Load concurrent operations.  The operations store is truncated according
-- to the call to "EXPIRE" later in this file, so we need to compute the index
-- into the operations store relative to the current length of the store.  If
-- that index is out of range of the list, then some of the concurrent
-- operations required for transforming the new operation have been expired
-- out of the cache, and we need to raise an error.
local nrev = redis.call("GET", cnt_key)
local nstore = redis.call("LLEN", ops_key)
local idx = nstore-nrev+rev
if idx < 0 then error("Operation history is too shallow") end
local concurrent = redis.call("LRANGE", ops_key, idx, -1)

-- Transform the new operation against all the concurrent operations
if concurrent then
	for i,cops in pairs(concurrent) do
		message.ops = transform(message.ops, cjson.decode(cops))
	end
end

-- Save the operation
redis.call("RPUSH", ops_key, cjson.encode(message.ops))
redis.call("INCR", cnt_key)

-- Load and apply to the document
local doc = redis.call("GET", doc_key)
if type(doc)=="boolean" then doc="" end
doc = apply(doc, message.ops)
redis.call("SET", doc_key, doc)

-- Touch the operation key's expire value
redis.call("EXPIRE", ops_key, expiretime)

-- Publish to the subscribe channel
redis.call("PUBLISH", sub_key, cjson.encode(message))
