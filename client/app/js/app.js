define(
	["knockout", "socket.io", "js/client", "ace/ace", "jquery", "ismobile",
		"splittr", "SocketIOFileUpload", "js/anal", "js/ot-client", "js/onboarding",
		"js/utils", "jquery.purl", "knockout-ace", "ko-flash", "ace/mode/octave",
		"ace/ext/language_tools"],

	function (ko, io, OctMethods, ace, $, isMobile,
	          splittr, SocketIOFileUpload, anal, OtClient, onboarding) {

		// Initial GUI setup
		splittr.init();

		// Make conveinence variable references
		var viewModel = OctMethods.ko.viewModel;
		var allOctFiles = OctMethods.ko.allOctFiles;
		var workspaceVars = viewModel.vars;

		// Run Knockout
		ko.applyBindings(viewModel);

		// Make Socket Connection and Add Listeners:
		var socket = io();
		socket.on("data", OctMethods.socketListeners.data);
		socket.on("prompt", OctMethods.socketListeners.prompt);
		socket.on("saved", OctMethods.socketListeners.saved);
		socket.on("renamed", OctMethods.socketListeners.renamed);
		socket.on("deleted", OctMethods.socketListeners.deleted);
		socket.on("binary", OctMethods.socketListeners.binary);
		socket.on("user", OctMethods.socketListeners.user);
		socket.on("fileadd", OctMethods.socketListeners.fileadd);
		socket.on("plotd", OctMethods.socketListeners.plotd);
		socket.on("plote", OctMethods.socketListeners.plote);
		socket.on("ctrl", OctMethods.socketListeners.ctrl);
		socket.on("workspace", OctMethods.socketListeners.workspace);
		socket.on("sesscode", OctMethods.socketListeners.sesscode);
		socket.on("init", OctMethods.socketListeners.init);
		socket.on("destroy-u", OctMethods.socketListeners.destroyu);
		socket.on("disconnect", OctMethods.socketListeners.disconnect);
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

		// Autocompletion with workspace variables:
		ace.require("ace/ext/language_tools").addCompleter({
			getCompletions: function (editor, session, pos, prefix, callback) {
				console.log("Workspace variable completions");
				callback(null, ko.utils.arrayMap(workspaceVars(), function(v){
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

		// Shared workspace setup:
		var wsId = $.url().param("w");
		if (wsId) {
			OctMethods.vars.wsId = wsId;
			socket.on("ot.doc", function(obj){
				console.log("ot.doc", obj);
				var docId = obj.docId;

				prompt.setValue(obj.content);

				otClient = new OtClient(obj.rev);
				otClient.attachEditor(prompt);
				otClient.addEventListener("send", function(revision, operation){
					console.log("client send", arguments);
					socket.emit("ot.change", {
						docId: docId,
						rev: revision,
						op: operation
					});
				});
				otClient.addEventListener("cursor", function(cursor){
					console.log("client cursor", arguments);
					socket.emit("ot.cursor", cursor);
				});

				var socket = window.socket = io();
				socket.on("ot.broadcast", function(obj){
					var op = ot.TextOperation.fromJSON(obj.ops);
					otClient.applyServer(op);
				});
				socket.on("ot.ack", function(obj){
					otClient.serverAck();
				});
				socket.on("ot.cursor", function(cursor){
					otClient.adapter.setOtherCursor(cursor, "#F00", "foo");
				});
				socket.on("ws.command", function(cmd){
					OctMethods.console.command(cmd, true);
					OctMethods.prompt.clear();
				});

			});
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

		// Set up Splittr
		var redraw = function () {
			ko.aceEditors.resizeAll();
		};
		$("#container").on("splittrDone", redraw);

		// Privacy Policy
		$.get("privacy.txt", function (data) {
			$("#privacy").text(data);
		});
		$("#privacy").click(function () {
			$(this).toggle();
			anal.sitecontrol("privacy-close");
		});
		$("#showprivacy").click(function () {
			$("#privacy").show();
			anal.sitecontrol("privacy");
		});

		// Mobile GUI
		if (isMobile) {
			window.matchMedia("(orientation:portrait)").addListener(function () {
				OctMethods.console.scroll();
			});
			$("#console").click(function () {
				OctMethods.prompt.focus();
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

		// Other GUI Initialization
		OctMethods.prompt.disable();
		var updateTheme = function (newValue) {
			$("#theme").attr("href", newValue.cssURL);
			$("body").attr("data-sanscons-color", newValue.iconColor);
			$("[data-theme]").hide();
			$("[data-theme='"+newValue.name+"']").show();
			OctMethods.prompt.instance.setTheme(newValue.aceTheme);
			if (OctMethods.editor.instance) {
				OctMethods.editor.instance.setTheme(newValue.aceTheme);
			}
		};
		updateTheme(viewModel.selectedSkin());
		viewModel.selectedSkin.subscribe(updateTheme);
		$("#change-skin").click(function () {
			if (viewModel.selectedSkin() === viewModel.availableSkins()[0]) {
				viewModel.selectedSkin(viewModel.availableSkins()[1]);
			} else {
				viewModel.selectedSkin(viewModel.availableSkins()[0]);
			}
			OctMethods.prompt.focus();
			anal.sitecontrol("theme");
		});
		$("#twitter-follow-holder").click(function () {
			anal.sitecontrol("twitter");
		});
		$("#feedback-btn").click(function () {
			anal.sitecontrol("feedback");
		});
		$("[data-purpose='close']").click(function () {
			// Clicking on a close button in a popover box
			$(this).closest("[data-purpose='popover']").fadeOut(250);
			OctMethods.prompt.focus();
		});
		OctMethods.load.startPatience();

		/* * * * END GUI * * * */

	}
); // AMD Define