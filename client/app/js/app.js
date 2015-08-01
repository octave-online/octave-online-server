define(
	["knockout", "socket.io", "js/client", "ace/ace", "jquery", "ismobile",
		"splittr", "SocketIOFileUpload", "js/anal", "js/onboarding",
		"js/ot-handler", "js/ws-shared",
		"js/utils", "jquery.purl", "ko-flash", "ace/mode/octave",
		"ace/ext/language_tools", "js/ko-ace"],

	function (ko, io, OctMethods, ace, $, isMobile,
	          splittr, SocketIOFileUpload, anal, onboarding,
	          OtHandler, WsShared) {

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
		socket.on("prompt", OctMethods.socketListeners.prompt);
		socket.on("saved", OctMethods.socketListeners.saved);
		socket.on("renamed", OctMethods.socketListeners.renamed);
		socket.on("deleted", OctMethods.socketListeners.deleted);
		socket.on("binary", OctMethods.socketListeners.binary); // TODO: Stop this event from operating on everyone in a shared workspace
		socket.on("user", OctMethods.socketListeners.user);
		socket.on("fileadd", OctMethods.socketListeners.fileadd);
		socket.on("plotd", OctMethods.socketListeners.plotd);
		socket.on("plote", OctMethods.socketListeners.plote);
		socket.on("ctrl", OctMethods.socketListeners.ctrl);
		socket.on("workspace", OctMethods.socketListeners.vars);
		socket.on("sesscode", OctMethods.socketListeners.sesscode);
		socket.on("init", OctMethods.socketListeners.init);
		socket.on("destroy-u", OctMethods.socketListeners.destroyu);
		socket.on("disconnect", OctMethods.socketListeners.disconnect);
		socket.on("reload", OctMethods.socketListeners.reload);
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
					}
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
		prompt.setOptions({enableBasicAutocompletion: true});
		prompt.commands.addCommand({
			name: 'nullifyLineNumber',
			bindKey: {mac: 'Command-L', win: 'Ctrl-L'},
			exec: function () {
			},
			readOnly: true
		});
		prompt.commands.addCommand({
			name: 'previousCommand',
			bindKey: 'Up',
			exec: OctMethods.promptListeners.historyUp,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: 'nextCommand',
			bindKey: 'Down',
			exec: OctMethods.promptListeners.historyDown,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: 'startAutocompleteOnTab',
			bindKey: 'Tab',
			exec: ace.require("ace/autocomplete").Autocomplete.startCommand.exec,
			readOnly: false
		});
		prompt.commands.addCommand({
			name: 'submitPrompt',
			bindKey: {win: 'Enter', mac: 'Enter'},
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
			console.log(e);
		}

		// Shared workspace setup
		var wsId = $.url().param("w");
		if (wsId) OctMethods.vars.wsId = wsId;

		// Student workspace setup
		var studentId = $.url().param("s");
		if (studentId) OctMethods.vars.studentId = studentId;

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
		$.get("privacy.txt", function (data) {
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

		// Sign-In
		$("#hamburger, #sign_in_shortcut").click(function () {
			$("#main_menu").toggleSafe();
			onboarding.hideScriptPromo();
			anal.sitecontrol("hamburger");
		});
		$("#sign_in_with_email").click(function () {
			require(["js/login"], function(L){
				L.login(false);
			});
		});
		$("#sign_in_with_google").click(function () {
			require(["js/login"], function(L){
				L.login(true);
			});
		});

		// Theme bindings
		function updateTheme(newValue) {
			$("#theme").attr("href", newValue.cssURL);
			$("body").attr("data-sanscons-color", newValue.iconColor);
			$("[data-theme]").hideSafe();
			$("[data-theme='"+newValue.name+"']").showSafe();
			OctMethods.prompt.instance.setTheme(newValue.aceTheme);
		};
		updateTheme(viewModel.selectedSkin());
		viewModel.selectedSkin.subscribe(updateTheme);
		$("#change-skin").click(function () {
			if (viewModel.selectedSkin() === OctMethods.ko.availableSkins[0]) {
				viewModel.selectedSkin(OctMethods.ko.availableSkins[1]);
			} else {
				viewModel.selectedSkin(OctMethods.ko.availableSkins[0]);
			}
			OctMethods.prompt.focus();
			anal.sitecontrol("theme");
		});

		// Other GUI Initialization
		OctMethods.prompt.disable();
		$("#twitter-follow-holder").click(function () {
			anal.sitecontrol("twitter");
		});
		$("#feedback-btn").click(function () {
			anal.sitecontrol("feedback");
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