module.exports = function (grunt) {
	grunt.loadNpmTasks("grunt-typescript");
	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-compass");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-regex-replace");

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		typescript: {
			base: {
				src: ["app/src/*.ts"],
				dest: "app/js",
				options: {
					module: "amd",
					basePath: "app/src"
				}
			}
		},
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
		compass: {
			dist: {
				options: {
					sassDir: "app/sass",
					cssDir: "dist/css",
					environment: "production"
				}
			},
			dev: {
				options: {
					sassDir: "app/sass",
					cssDir: "app/css"
				}
			}
		},
		copy: {
			html: {
				src: "app/index.html",
				dest: "dist/index.html"
			},
			requirejs: {
				src: "app/vendor/requirejs/require.js",
				dest: "dist/js/require.js"
			},
			images: {
				cwd: "app/images/",
				src: "**",
				dest: "dist/images/",
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
						replace: "<script src=\"js/require.js\"></script>\n"
						+ "<script>\nrequire([\"js/app\"]);\n</script>\n",
						flags: "g"
					}
				]
			}
		},
		watch: {
			typescript: {
				files: "app/src/**/*.ts",
				tasks: ["typescript:base"]
			},
			compass: {
				files: "app/sass/**/*.scss",
				tasks: ["compass:dev"]
			}
		}
	});

	grunt.registerTask("default", [
		"typescript",
		"requirejs",
		"compass:dist",
		"copy",
		"regex-replace"
	]);

};