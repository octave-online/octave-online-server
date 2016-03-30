#!/usr/bin/env node

const HostProcessHandler = require("../../back-master/src/session-impl").selinux_handler;
const uuid = require("uuid");
const path = require("path");
const async = require("async");
const fs = require("fs");
const child_process = require("child_process");
const silent = require("../../shared/silent");

// Packages for which to generate placeholder files that tell the user to run "pkg load XXX"
const PLACEHOLDER_PACKAGES = ["ltfat", "nan", "stk", "tsa"];

// Additional functions for which to ignore "shadow" warnings
const EXTRA_IGNORE_SHADOWS = ["sumsq"];

const id = `placeholder-${uuid.v4()}`;
const process = new HostProcessHandler(id);

RegExp.prototype.execAll = function(str) {
	var match = null;
	var matches = [];
	while ((match = this.exec(str)) !== null) {
		matches.push(match);
	}
	return matches;
};

Array.prototype.diff = function(other) {
	return this.filter((v) => {
		return other.indexOf(v) < 0;
	});
};

Array.prototype.unique = function() {
	return this.reduce(function(p, c) {
		if (p.indexOf(c) < 0) p.push(c);
		return p;
	}, []);
};

var out = "";
process.on("msg:out", (content) => {
	out += content;
});

var err = "";
process.on("msg:err", (content) => {
	err += content;
});

var placeholders = [];
var ignoreShadows = EXTRA_IGNORE_SHADOWS.slice();

async.series([
	(_next) => {
		process.once("msg:request-input", () => { _next() });
	},
	(_next) => {
		process.sendMessage("cmd", "pkg unload all");
		process.once("msg:request-input", () => { _next() });
	},
	(_next) => {
		async.eachSeries(PLACEHOLDER_PACKAGES, (package, __next) => {
			async.series([
				(___next) => {
					process.sendMessage("cmd", `pkg describe -verbose ${package}`);
					process.once("msg:request-input", () => { ___next() });
				},
				(___next) => {
					process.sendMessage("cmd", `pkg load ${package}`);
					process.once("msg:request-input", () => { ___next() });
				},
				(___next) => {
					var funcsStr = new RegExp(`Package name:\\n\\t${package}[\\s\\S]+?Provides:\\n([\\s\\S]+)`).exec(out)[1];
					var funcs = /^\t(\w+)$/mg.execAll(funcsStr).map((m) => { return m[1] });
					var shadows = new RegExp(`packages/${package}-[\\d\\.]+/(\\w+)\\.m shadows a core library function`, "mg").execAll(err).map((m) => { return m[1] });
					var goodFuncs = funcs.diff(shadows);
					placeholders = placeholders.concat(goodFuncs.map((fn) => { return { package, fn } }));
					ignoreShadows = ignoreShadows.concat(goodFuncs.map((fn) => { return { package, fn } }));
					ignoreShadows = ignoreShadows.concat(shadows.map((fn) => { return { package, fn } }));
					___next();
				},
				(___next) => {
					process.sendMessage("cmd", `pkg unload ${package}`);
					process.once("msg:request-input", () => { ___next() });
				}
			], __next);
		}, _next);
	},
	(_next) => {
		child_process.exec("rm ../placeholders/*.m", { cwd: __dirname }, silent(/.*/, _next));
	},
	(_next) => {
		fs.mkdir(path.join(__dirname, "../placeholders"), silent(/.*/, _next));
	},
	(_next) => {
		async.each(placeholders, (ph, __next) => {
			text = `function ${ph.fn}()
% Run 'pkg load ${ph.package}' to enable ${ph.fn}.
	fprintf(stderr, "Run 'pkg load ${ph.package}' to enable ${ph.fn}.\\n");
endfunction`;
			fs.writeFile(path.join(__dirname, "../placeholders", `${ph.fn}.m`), text, __next);
		}, _next);
	}
], (err) => {
	if (err) console.log("error:", err);
	else {
		console.log("Re-generated the placeholder files.\nReplace config.forge.placeholders with the following:");
		console.log('["'
			+ ignoreShadows
				.map((ph) => { return ph.fn })
				.filter((fn) => { return !!fn })
				.unique()
				.sort()
				.join('", "') + '"]');
	}
	process.destroy();
});

const cwd = path.join(__dirname, "cwd");
try { fs.mkdirSync(cwd) } catch(err) {}
process.create(()=>{}, cwd, true);
