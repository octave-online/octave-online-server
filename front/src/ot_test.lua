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
