"use strict";

const fs = require("fs");

function getCssTimestamp() {
	return fs.statSync("dist/css/themes/fire.css").mtime.valueOf();
}

function getJsTimestamp() {
	return fs.statSync("dist/js/app.js").mtime.valueOf();
}

module.exports = function (grunt) {
	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-stylus");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-regex-replace");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-sync");

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		requirejs: {
			compile: {
				options: {
					baseUrl: "app",
					mainConfigFile: "app/main.js",
					out: "dist/js/app.js",
					name: "js/app",
					optimize: "uglify2"
				}
			}
		},
		stylus: {
			dev: {
				options: {
					compress: false,
					use: [
						require("kouto-swiss")
					],
					urlfunc: {
						name: "inline-image",
						paths: ["app/images"]
					}
				},
				files: [
					{
						expand: true,
						cwd: "app/styl",
						src: ["themes/*.styl"],
						dest: "app/css/",
						ext: ".css"
					}
				]
			},
			dist: {
				options: {
					compress: true,
					use: [
						require("kouto-swiss")
					],
					urlfunc: {
						name: "inline-image",
						paths: ["app/images"]
					}
				},
				files: [
					{
						expand: true,
						cwd: "app/styl",
						src: ["themes/*.styl"],
						dest: "dist/css/",
						ext: ".css"
					}
				]
			}
		},
		uglify: {
			requirejs: {
				files: {
					"dist/js/require.js": ["app/vendor/requirejs/require.js"],
					"dist/js/runtime.js": ["app/js/runtime.js"],
					"dist/js/modernizr-201406b.js": ["app/js/modernizr-201406b.js"]
				}
			}
		},
		sync: {
			dist: {
				files: [{
					cwd: "app",
					src: [
						"index.html",
						"favicon.ico",
						"privacy.txt",
						"compatibility.html",
						"gdpr.html",
						"images/**",
						"errors/**",
						"fonts/**",
						"js/gnuplot/**"
					],
					dest: "dist"
				}],
				verbose: true,
				compareUsing: "md5"
			}
		},
		"regex-replace": {
			appcss: {
				src: ["dist/js/app.js"],
				actions: [
					{
						name: "css-timestamp",
						search: "\\{!css-timestamp!\\}",
						replace: getCssTimestamp,
						flags: "g"
					}
				]
			},
			html: {
				src: ["dist/index.html"],
				actions: [
					{
						name: "requirejs",
						search: "<!-- Begin RequireJS -->[\\s\\S]+?<!-- End RequireJS -->",
						replace: "<script src=\"js/require.js\"></script>",
						flags: "g"
					},
					{
						name: "js-timestamp",
						search: "\\{!js-timestamp!\\}",
						replace: getJsTimestamp,
						flags: "g"
					},
					{
						name: "css-timestamp",
						search: "\\{!css-timestamp!\\}",
						replace: getCssTimestamp,
						flags: "g"
					}
				]
			}
		},
		watch: {
			stylus: {
				files: "app/styl/**/*.styl",
				tasks: ["stylus:dev"]
			}
		}
	});

	grunt.registerTask("default", [
		"requirejs",
		"stylus:dist",
		"regex-replace:appcss",
		"uglify",
		"sync",
		"regex-replace:html"
	]);

	grunt.registerTask("index", ["sync", "regex-replace:html"]);

};
