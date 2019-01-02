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

define(
	["knockout", "socket.io", "js/client", "ace/ace", "jquery", "ismobile", "splittr", "SocketIOFileUpload", "js/anal", "js/onboarding", "js/ot-handler", "js/ws-shared", "js/utils", "jquery.purl", "ko-flash", "ace/mode/octave", "ace/ext/language_tools", "js/ko-ace", "js/flex-resize"],
	function (ko, io, OctMethods, ace, $, isMobile, splittr, SocketIOFileUpload, anal, onboarding, OtHandler, WsShared) {

		// Set OO version for index.html compatibility
		window.oo$version = 20161230.1;

		// Initial GUI setup
		splittr.init();

		// Make conveinence variable references
		var viewModel = OctMethods.ko.viewModel;
		var allOctFiles = OctMethods.ko.allOctFiles;
		var vars = viewModel.vars;

		// Run Knockout
		ko.applyBindings(viewModel);

		// Make Socket Connection and Add Listeners:
		var socket = io();
		socket.on("data", OctMethods.socketListeners.data);
		socket.on("alert", OctMethods.socketListeners.alert);
		socket.on("prompt", OctMethods.socketListeners.prompt);
		socket.on("saved", OctMethods.socketListeners.saved);
		socket.on("renamed", OctMethods.socketListeners.renamed);
		socket.on("deleted", OctMethods.socketListeners.deleted);
		// TODO: Stop this event from operating on everyone in a shared workspace
		socket.on("binary", OctMethods.socketListeners.binary);
		socket.on("userinfo", OctMethods.socketListeners.userinfo);
		// The inconsistent naming convention here ("user" vs. "filelist") is for backwards compatibility.  At some point I would like to rename this and other events all the way through the stack.
		socket.on("user", OctMethods.socketListeners.filelist);
		socket.on("fileadd", OctMethods.socketListeners.fileadd);
		socket.on("plotd", OctMethods.socketListeners.plotd);
		socket.on("plote", OctMethods.socketListeners.plote);
		socket.on("ctrl", OctMethods.socketListeners.ctrl);
		socket.on("workspace", OctMethods.socketListeners.vars);
		socket.on("sesscode", OctMethods.socketListeners.sesscode);
		socket.on("init", OctMethods.socketListeners.init);
		socket.on("files-ready", OctMethods.socketListeners.filesReady);
		socket.on("destroy-u", OctMethods.socketListeners.destroyu);
		socket.on("disconnect", OctMethods.socketListeners.disconnect);
		socket.on("reload", OctMethods.socketListeners.reload);
		socket.on("instructor", OctMethods.socketListeners.instructor);
		socket.on("bucket-info", OctMethods.socketListeners.bucketInfo);
		socket.on("bucket-created", OctMethods.socketListeners.bucketCreated);
		socket.on("bucket-deleted", OctMethods.socketListeners.bucketDeleted);
		socket.on("all-buckets", OctMethods.socketListeners.allBuckets);
		socket.on("oo.pong", OctMethods.socketListeners.pong);
		socket.on("restart-countdown", OctMethods.socketListeners.restartCountdown);
		socket.on("change-directory", OctMethods.socketListeners.changeDirectory);
		socket.on("edit-file", OctMethods.socketListeners.editFile);
		socket.on("payload-paused", OctMethods.socketListeners.payloadPaused);
		socket.on("ot.doc", OtHandler.listeners.doc);
		socket.on("ot.broadcast", OtHandler.listeners.broadcast);
		socket.on("ot.ack", OtHandler.listeners.ack);
		socket.on("ot.cursor", OtHandler.listeners.cursor);
		socket.on("ws.command", WsShared.listeners.command);
		socket.on("ws.save", WsShared.listeners.save);
		socket.on("ws.promptid", WsShared.listeners.promptid);
		socket.on("ws.doc", WsShared.listeners.doc);
		socket.on("ws.rename", WsShared.listeners.renamed);
		socket.on("ws.delete", WsShared.listeners.deleted);
		OctMethods.socket.instance = socket;

		// Autocompletion with filenames:
		ace.require("ace/ext/language_tools").addCompleter({
			getCompletions: function (editor, session, pos, prefix, callback) {
				callback(null, $.map(allOctFiles(), function (file) {
					var filenameNoExtension = file.filename().replace(/\.[^/.]+$/, "");
					return {
						value: filenameNoExtension,
						meta: "file"
					};
				}));
			}
		});

		// Autocompletion with variables:
		ace.require("ace/ext/language_tools").addCompleter({
			getCompletions: function (editor, session, pos, prefix, callback) {
				callback(null, ko.utils.arrayMap(vars(), function(v){
					return {
						value: v.symbol(),
						meta: "var"
					};
				}));
			}
		});

		// Make Prompt:
		var prompt = ace.edit("prompt");
		prompt.setTheme(viewModel.selectedSkin().aceTheme);
		prompt.getSession().setMode("ace/mode/octave");
		prompt.renderer.setShowGutter(false);
		prompt.setHighlightActiveLine(false);
		prompt.setShowPrintMargin(false);
		prompt.setOptions({
			enableBasicAutocompletion: true,
			maxLines: 6
		});
		prompt.setBehavioursEnabled(false);  // disables quto-quote
		prompt.renderer.setScrollMargin(5, 5);
		prompt.getSession().setUseWrapMode(true);
		prompt.commands.addCommand({
			name: "nullifyLineNumber",
			bindKey: {mac: "Command-L", win: "Ctrl-L"},
			exec: function () {
			},
			readOnly: true
		});
		prompt.commands.addCommand({
			name: "previousCommand",
			bindKey: "Up",
			exec: OctMethods.promptListeners.historyUp,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: "nextCommand",
			bindKey: "Down",
			exec: OctMethods.promptListeners.historyDown,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: "startAutocompleteOnTab",
			bindKey: "Tab",
			exec: ace.require("ace/autocomplete").Autocomplete.startCommand.exec,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: "submitPrompt",
			bindKey: {win: "Enter", mac: "Enter"},
			exec: OctMethods.promptListeners.command,
			readOnly: false
		});
		OctMethods.prompt.instance = prompt;

		// Initialize the console screen
		OctMethods.console.clear();

		// Add Prompt/Console/Plot Listeners:
		$("#signal").click(OctMethods.promptListeners.signal);
		$("#console").on("click", ".prompt_command", OctMethods.promptListeners.permalink);

		// Add listeners to the file list toolbar
		$("#files_toolbar_create").click(OctMethods.editorListeners.newCB);
		$("#files_toolbar_refresh").click(OctMethods.editorListeners.refresh);
		$("#files_toolbar_info").click(OctMethods.editorListeners.info);

		// Set up the file uploader:
		try {
			var siofu = new SocketIOFileUpload(socket);
			siofu.useBuffer = false;
			var _addDragClass = function () {
				$(this).addClass("drag-over");
			};
			var _removeDragClass = function () {
				$(this).removeClass("drag-over");
			};
			$("#files_list_container").on("dragover", _addDragClass);
			$("#files_list_container").on("dragenter", _addDragClass);
			$("#files_list_container").on("dragleave", _removeDragClass);
			$("#files_list_container").on("drop", _removeDragClass);
			siofu.listenOnDrop($("#files_list_container")[0]);
			$("#files_toolbar_upload").click(siofu.prompt);
		} catch (e) {
			// SIOFU not supported in current browser
			console.error(e);
		}

		// Shared workspace setup
		var wsId = $.url().param("w");
		if (wsId) {
			OctMethods.vars.wsId = wsId;
			viewModel.purpose("shared");
			viewModel.selectedSkin(OctMethods.ko.availableSkins[2]);
		}

		// Student workspace setup
		var studentId = $.url().param("s");
		var match;
		if (!studentId) {
			match = $.url().attr("path").match(/^\/workspace~(\w+)$/);
			if (match) studentId = match[1];
		}
		if (studentId) {
			OctMethods.vars.studentId = studentId;
			viewModel.purpose("student");
			viewModel.selectedSkin(OctMethods.ko.availableSkins[2]);
		}

		// Bucket setup
		var bucketId = $.url().param("b");
		if (!bucketId) {
			match = $.url().attr("path").match(/^\/bucket~(\w+)$/);
			if (match) bucketId = match[1];
		}
		if (bucketId) {
			OctMethods.vars.bucketId = bucketId;
			viewModel.purpose("bucket");
			viewModel.selectedSkin(OctMethods.ko.availableSkins[3]);
			onboarding.showBucketPromo();
		}

		// Global key bindings:
		$(window).keydown(function (e) {
			if (e.keyCode == 82) { // "R" key
				if (e.metaKey || e.ctrlKey) {
					OctMethods.editorListeners.keyRun(e);
				}
			} else if (e.keyCode == 69) { // "E" key
				if (e.metaKey || e.ctrlKey) {
					OctMethods.promptListeners.keyFocus(e);
				}
			}
		});

		/* * * * END EDITOR/CONSOLE/PROMPT, START GUI * * * */

		// Privacy Policy
		$.get("privacy.txt?{!privacy-timestamp!}", function (data) {
			$("#privacy").find("article").text(data);
		});
		$("#privacy").find("[data-purpose='close']").click(function () {
			anal.sitecontrol("privacy-close");
		});
		$("#showprivacy").click(function () {
			$("#privacy").showSafe();
			anal.sitecontrol("privacy");
		});

		// Mobile GUI
		if (isMobile) {
			window.matchMedia("(orientation:portrait)").addListener(function () {
				OctMethods.console.scroll();
			});
		}

		// Sign-In and Password
		$("#hamburger, #sign_in_shortcut").click(function () {
			var opened = $("#main_menu").toggleSafe();
			$("#hamburger").toggleClass("is-active", opened);
			onboarding.hideScriptPromo();
			onboarding.hideBucketPromo();
			anal.sitecontrol("hamburger");
		});
		$("#sign_in_with_google").click(function () {
			window.location.href = "/auth/google";
		});
		$("#sign_in_with_password").click(function () {
			$("#email_password").showSafe();
			$("#emailField2").focus();
		});
		$("#sign_in_with_email").click(function () {
			$("#email_token").showSafe();
			$("#emailField1").focus();
		});
		// Callback for #create-password-btn is in Knockout setup
		$("#save-password-btn").click(function() {
			var password = $("#new_pwd").val();
			$("#new_pwd").val("");
			$("#change_password").hideSafe();

			OctMethods.socket.setPassword(password);
		});

		// Theme bindings
		function updateTheme(newValue) {
			$("#theme").attr("href", newValue.cssURL);
			$("body").attr("data-sanscons-color", newValue.iconColor);
			$("[data-theme]").hideSafe();
			$("[data-theme='"+newValue.name+"']").showSafe();
			OctMethods.prompt.instance.setTheme(newValue.aceTheme);
		}
		updateTheme(viewModel.selectedSkin());
		viewModel.selectedSkin.subscribe(updateTheme);
		$("#change-skin").click(function () {
			var newSkin;
			if (viewModel.selectedSkin() !== OctMethods.ko.availableSkins[1]) {
				newSkin = OctMethods.ko.availableSkins[1];
			} else switch(viewModel.purpose()) {
				case "student":
					newSkin = OctMethods.ko.availableSkins[2];
					break;
				case "bucket":
					newSkin = OctMethods.ko.availableSkins[3];
					break;
				case "default":
				default:
					newSkin = OctMethods.ko.availableSkins[0];
					break;
			}
			viewModel.selectedSkin(newSkin);
			OctMethods.prompt.focus();
			anal.sitecontrol("theme");
		});

		// Callouts positioned relative to non-top-level elements
		window.addEventListener("resize", function() {
			onboarding.reposition();
		}, false);

		// Other GUI Initialization
		OctMethods.prompt.disable();
		$("#twitter-follow-holder").click(function () {
			anal.sitecontrol("twitter");
		});
		$("#feedback-btn").click(function () {
			anal.sitecontrol("feedback");
		});
		$("#reset-layout").click(function () {
			viewModel.flex.sizes([100, 400, 75, 325]);
			viewModel.flex.shown(true);
		});
		$("[data-purpose='close']").click(function () {
			// Clicking on a close button in a popover box
			$(this).closest("[data-purpose='popover']").fadeOutSafe(250);
			OctMethods.prompt.focus();
		});
		OctMethods.load.startPatience();

		/* * * * END GUI * * * */

	}
); // AMD Define
