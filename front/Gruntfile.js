module.exports = function (grunt) {
	grunt.loadNpmTasks("grunt-typescript");
	grunt.loadNpmTasks("grunt-contrib-watch");

	grunt.initConfig({
		pkg: grunt.file.readJSON("package.json"),
		typescript: {
			base: {
				src: ["src/*.ts"],
				dest: "build",
				options: {
					module: "commonjs",
					basePath: "src"
				}
			}
		},
		watch: {
			typescript: {
				files: "src/**/*.ts",
				tasks: ["typescript:base"]
			},
		}
	});

	grunt.registerTask("default", [
		"typescript"
	]);

};