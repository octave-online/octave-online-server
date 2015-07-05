module.exports = function (grunt) {
	grunt.loadNpmTasks("grunt-contrib-requirejs");
	grunt.loadNpmTasks("grunt-contrib-compass");
	grunt.loadNpmTasks("grunt-contrib-stylus");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-contrib-copy");
	grunt.loadNpmTasks("grunt-regex-replace");
	grunt.loadNpmTasks("grunt-contrib-uglify");

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
		compass: {
			dist: {
				options: {
					sassDir: "app/sass",
					cssDir: "dist/css",
					environment: "production",
					outputStyle: "compact" // using "compress" breaks the sanscons
				}
			},
			dev: {
				options: {
					sassDir: "app/sass",
					cssDir: "app/css"
				}
			}
		},
		stylus: {
			dev: {
				options: {
					compress: false,
					use: [
						require("kouto-swiss"),
						// function(){
						// 	return require("autoprefixer-stylus")({
						// 		"browsers": ">0.01%"
						// 	})
						// }
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
						src: ["**/*.styl"],
						dest: "app/styl_css/",
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
					"dist/js/login.js": ["app/js/login.js"],
					"dist/js/modernizr-201406b.js": ["app/js/modernizr-201406b.js"]
				}
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
					"fonts/**"
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
						replace: "<script src=\"js/require.js\"></script>\n",
						flags: "g"
					}
				]
			}
		},
		watch: {
			compass: {
				files: "app/sass/**/*.scss",
				tasks: ["compass:dev"]
			},
			stylus: {
				files: "app/styl/**/*.styl",
				tasks: ["stylus:dev"]
			}
		}
	});

	grunt.registerTask("default", [
		"requirejs",
		"compass:dist",
		"uglify",
		"copy",
		"regex-replace"
	]);

	grunt.registerTask("sass", ["compass:dev"]);
	grunt.registerTask("index", ["copy", "regex-replace"]);

};
