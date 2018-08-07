/*
 * Copyright © 2018, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

"use strict";

const fs = require("fs");
const config = require("@oo/shared").config;

function getCssTimestamp() {
	return fs.statSync("dist/css/themes/fire.css").mtime.valueOf();
}

function getJsTimestamp() {
	return fs.statSync("dist/js/app.js").mtime.valueOf();
}

function getPrivacyTimestamp() {
	return fs.statSync("app/privacy_standalone.txt").mtime.valueOf() + fs.statSync("app/eula.txt").mtime.valueOf();
}

function getFileUtf8(filepath) {
	return function() {
		return fs.readFileSync(filepath).toString("utf-8");
	};
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
						paths: [
							"app/images",
							"app/images/logo_collections/" + config.client.theme_collection
						]
					}
				},
				files: [
					{
						expand: true,
						cwd: "app/styl/themes/" + config.client.theme_collection,
						src: ["*.styl"],
						dest: "app/css/themes",
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
						paths: [
							"app/images",
							"app/images/logo_collections/" + config.client.theme_collection
						]
					}
				},
				files: [
					{
						expand: true,
						cwd: "app/styl/themes/" + config.client.theme_collection,
						src: ["*.styl"],
						dest: "dist/css/themes",
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
						"privacy.txt",
						"compatibility.html",
						"gdpr.html",
						"images/**",
						"!images/logo_collections/**",
						"!images/logos/**",
						"!images/flaticons/**",
						"!images/sanscons/**",
						"errors/**",
						"fonts/**",
						"js/gnuplot/**"
					],
					dest: "dist"
				}, {
					cwd: "app/images/logo_collections/" + config.client.theme_collection,
					src: ["**"],
					dest: "dist/images/logos"
				}],
				verbose: true,
				compareUsing: "md5"
			}
		},
		"regex-replace": {
			appcss: {
				src: ["dist/js/app.js", "dist/js/runtime.js"],
				actions: [
					{
						name: "css-timestamp",
						search: "\\{!css-timestamp!\\}",
						replace: getCssTimestamp,
						flags: "g"
					},
					{
						name: "privacy-timestamp",
						search: "\\{!privacy-timestamp!\\}",
						replace: getPrivacyTimestamp,
						flags: "g"
					},
					{
						name: "config-session-payloadMessageDelay",
						search: "parseInt\\(\"\\d+!config.session.payloadMessageDelay\"\\)",
						replace: "" + config.session.payloadMessageDelay,
						flags: "g"
					},
					{
						name: "config-session-countdownExtraTime",
						search: "parseInt\\(\"\\d+!config.session.countdownExtraTime\"\\)",
						replace: "" + config.session.countdownExtraTime,
						flags: "g"
					},
					{
						name: "gacode",
						search: "\\{!gacode!\\}",
						replace: config.client.gacode,
						flags: "g"
					},
					{
						name: "uservoice",
						search: "\\{!uservoice!\\}",
						replace: config.client.uservoice,
						flags: "g"
					},
				]
			},
			html: {
				src: ["dist/index.html", "dist/gdpr.html", "dist/privacy.txt"],
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
					},
					{
						name: "logo-svg",
						search: "<!-- Logo SVG -->",
						replace: getFileUtf8("dist/images/logos/banner-black.svg"),
						flags: "g"
					},
					{
						name: "privacy-txt",
						search: "<!-- Privacy TXT -->",
						replace: getFileUtf8("app/privacy_standalone.txt"),
						flags: "g"
					},
					{
						name: "eula-txt",
						search: "<!-- EULA TXT -->",
						replace: getFileUtf8("app/eula.txt"),
						flags: "g"
					},
					{
						name: "title",
						search: "\\{!title!\\}",
						replace: config.client.title,
						flags: "g"
					},
					{
						name: "description",
						search: "\\{!description!\\}",
						replace: config.client.description,
						flags: "g"
					},
					{
						name: "theme-color",
						search: "\\{!theme-color!\\}",
						replace: config.client.theme_color,
						flags: "g"
					},
					{
						name: "app-name",
						search: "\\{!app-name!\\}",
						replace: config.client.app_name,
						flags: "g"
					},
					{
						name: "onboarding",
						search: "<!--ONBOARDING([\\s\\S]+?)ONBOARDING-->",
						replace: function(full, match) {
							if (config.client.onboarding) {
								return match;
							} else {
								return "";
							}
						},
						flags: "g"
					},
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
		"requirejs", // app.js
		"uglify", // runtime.js
		"stylus:dist",
		"regex-replace:appcss",
		"sync",
		"regex-replace:html"
	]);

	grunt.registerTask("index", ["sync", "regex-replace:html"]);

};
