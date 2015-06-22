-- Perform Operational Transormation.
-- This code is heavily based on the JavaScript implementation ot.js:
-- https://github.com/Operational-Transformation/ot.js/

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
			table.insert(ops2p, string.len(op1)) -- retain
			i1 = i1+1; op1 = ops1[i1]

		-- insert by player 2
		elseif type(op2) == "string" then
			table.insert(ops1p, string.len(op2)) -- retain
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
			res = res .. string.sub(str, j, j+op-1)
			j = j + op
		end
	end

	return res
end

