"use strict";

module.exports = function (grunt) {
	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-stylus");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-regex-replace");
	grunt.loadNpmTasks("grunt-contrib-uglify");

	const timestamp = new Date().valueOf();
	const __oo_app_path__ = "js/app_" + timestamp;
	const __oo_runtime_path__ = "js/runtime_" + timestamp;
	var uglifyFiles = {
		"dist/js/require.js": ["app/vendor/requirejs/require.js"],
		"dist/js/modernizr-201406b.js": ["app/js/modernizr-201406b.js"]
	};
	uglifyFiles[`dist/${__oo_runtime_path__}.js`] = "app/js/runtime.js";

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		requirejs: {
			compile: {
				options: {
					baseUrl: "app",
					mainConfigFile: "app/main.js",
					out: `dist/${__oo_app_path__}.js`,
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
				files: uglifyFiles
			}
		},
		copy: {
			dist: {
				cwd: "app",
				src: [
					"index.html",
					"favicon.ico",
					"privacy.txt",
					"compatibility.html",
					"images/**",
					"errors/**",
					"fonts/**",
					"js/gnuplot/**"
				],
				dest: "dist",
				expand: true
			}
		},
		"regex-replace": {
			html: {
				src: ["dist/index.html"],
				actions: [
					{
						name: "requirejs",
						search: "<!-- Begin RequireJS -->"
							+ "[\\s\\S]+?<!-- End RequireJS -->",
						replace: `<script src="js/require.js"></script>
<script type="text/javascript">
	var __oo_app_path__ = "${__oo_app_path__}";
	var __oo_runtime_path__ = "${__oo_runtime_path__}";
</script>`,
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
		"uglify",
		"copy",
		"regex-replace"
	]);

	//grunt.registerTask("index", ["copy", "regex-replace"]);

};
