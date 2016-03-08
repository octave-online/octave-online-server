-- Perform Operational Transormation.
-- This code is heavily based on the JavaScript implementation ot.js:
-- https://github.com/Operational-Transformation/ot.js/

-- Lua has poor support for UTF-8, so we need to have custom functions.
-- These are based on those originally written by Cosmin Apreutesei:
-- https://github.com/luapower/utf8
-- Use the prefix "lutf8" in case at some point in the future Redis adds the Lua 5.3 built-in "utf8" library.

-- Byte index of the next char after the char at byte index i, followed by a valid flag for the char at byte index i.
-- nil if not found. invalid characters are iterated as 1-byte chars.
function lutf8_next(s, i)
	if not i then
		if #s == 0 then return nil end
		return 1, true --fake flag (doesn't matter since this flag is not to be taken as full validation)
	end
	if i > #s then return end
	local c = s:byte(i)
	if c >= 0x00 and c <= 0x7F then
		i = i + 1
	elseif c >= 0xC2 and c <= 0xDF then
		i = i + 2
	elseif c >= 0xE0 and c <= 0xEF then
		i = i + 3
	elseif c >= 0xF0 and c <= 0xF4 then
		i = i + 4
	else --invalid
		return i + 1, false
	end
	if i > #s then return end
	return i, true
end

-- Iterator over byte indices in the string.
function lutf8_byte_indices(s, previ)
	return lutf8_next, s, previ
end

-- Returns the number of UTF-8 characters in the string, like string.len.
function lutf8_len(s)
	local len = 0
	for _ in lutf8_byte_indices(s) do
		len = len + 1
	end
	return len
end

-- Performs a substring operation, like string.sub.
function lutf8_sub(s, start_ci, end_ci)
	local ci = 0
	local start_i = 1
	local end_i = s:len()
	for i in lutf8_byte_indices(s) do
		ci = ci + 1
		if ci == start_ci then
			start_i = i
		end
		if ci == end_ci+1 then
			end_i = i-1
			break
		end
	end
	return string.sub(s, start_i, end_i)
end

-- Remove redundant ops from an operations table
function condense(ops)
	local i = 2

	while ops[i] ~= nil do
		-- insert/insert
		if type(ops[i]) == "string" and type(ops[i-1]) == "string" then
			ops[i-1] = ops[i-1] .. ops[i]
			table.remove(ops, i)

		-- delete/insert
		-- The order of these operations does not matter with
		-- respect to the "apply" function, but for consistency
		-- we always put "insert" first.
		elseif type(ops[i]) == "string" and ops[i-1]<0 then
			local tmp = ops[i]
			ops[i] = ops[i-1]
			ops[i-1] = tmp

			-- go backwards in case the new insert can be condensed
			i = i-1

		-- other/insert (do nothing)
		elseif type(ops[i]) == "string" or type(ops[i-1]) == "string" then
			i = i+1

		-- delete/delete
		elseif ops[i]<0 and ops[i-1]<0 then
			ops[i-1] = ops[i-1] + ops[i]
			table.remove(ops, i)

		-- retain/retain
		elseif ops[i]>0 and ops[i-1]>0 then
			ops[i-1] = ops[i-1] + ops[i]
			table.remove(ops, i)

		-- something else that we can't condense
		else
			i = i+1

		end

		if i<2 then
			i = 2
		end
	end
end

-- Transform takes two operations A and B that happened
-- concurrently and produces two operations A' and B'
-- such that apply(apply(S,A),B') == apply(apply(S,B),A')
-- This function is the heart of OT.
function transform(ops1, ops2)
	local ops1p = {}
	local ops2p = {}
	local i1 = 1
	local i2 = 1
	local op1 = ops1[i1]
	local op2 = ops2[i2]
	local minl = 0

	while op1 ~= nil or op2 ~= nil do
		-- insert by player 1
		-- break tie by prefering player 1
		if type(op1) == "string" then
			table.insert(ops1p, op1) -- insert
			table.insert(ops2p, lutf8_len(op1)) -- retain
			i1 = i1+1; op1 = ops1[i1]

		-- insert by player 2
		elseif type(op2) == "string" then
			table.insert(ops1p, lutf8_len(op2)) -- retain
			table.insert(ops2p, op2) -- insert
			i2 = i2+1; op2 = ops2[i2]

		-- retain/retain
		elseif op1>0 and op2>0 then
			if op1>op2 then
				minl = op2
				op1 = op1 - op2
				i2 = i2+1; op2 = ops2[i2]
			elseif op1 == op2 then
				minl = op2
				i1 = i1+1; op1 = ops1[i1]
				i2 = i2+1; op2 = ops2[i2]
			else
				minl = op1
				op2 = op2 - op1
				i1 = i1+1; op1 = ops1[i1]
			end
			table.insert(ops1p, minl) -- retain
			table.insert(ops2p, minl) -- retain

		-- delete/delete
		elseif op1<0 and op2<0 then
			if op1 < op2 then
				op1 = op1 - op2
				i2 = i2+1; op2 = ops2[i2]
			elseif op1 == op2 then
				i1 = i1+1; op1 = ops1[i1]
				i2 = i2+1; op2 = ops2[i2]
			else
				op2 = op2 - op1
				i1 = i1+1; op1 = ops1[i1]
			end

		-- delete/retain
		elseif op1<0 and op2>0 then
			if -op1 > op2 then
				minl = op2
				op1 = op1 + op2
				i2 = i2+1; op2 = ops2[i2]
			elseif -op1 == op2 then
				minl = op2
				i1 = i1+1; op1 = ops1[i1]
				i2 = i2+1; op2 = ops2[i2]
			else
				minl = -op1
				op2 = op2 + op1
				i1 = i1+1; op1 = ops1[i1]
			end
			table.insert(ops1p, -minl) -- delete

		-- retain/delete
		elseif op1>0 and op2<0 then
			if op1 > -op2 then
				minl = -op2
				op1 = op1 + op2
				i2 = i2+1; op2 = ops2[i2]
			elseif op1 == -op2 then
				minl = op1
				i1 = i1+1; op1 = ops1[i1]
				i2 = i2+1; op2 = ops2[i2]
			else
				minl = op1
				op2 = op2 + op1
				i1 = i1+1; op1 = ops1[i1]
			end
			table.insert(ops2p, -minl) -- delete

		-- noop
		elseif op1==0 then
			i1 = i1+1; op1 = ops1[i1]
		elseif op2==0 then
			i2 = i2+1; op2 = ops2[i2]

		-- unknown
		else
			error()
		end
	end

	condense(ops1p)
	condense(ops2p)
	return ops1p, ops2p
end

-- Apply an operation to a text
function apply(str, ops)
	local j = 1
	local res = ""

	for i,op in pairs(ops) do

		-- insert
		if type(op)=="string" then
			res = res .. op

		-- delete
		elseif op<0 then
			j = j - op

		-- retain
		else
			res = res .. lutf8_sub(str, j, j+op-1)
			j = j + op
		end
	end

	return res
end

