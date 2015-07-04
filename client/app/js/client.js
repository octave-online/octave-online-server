// Client-Side JavaScript for Octave Online

define(
	["jquery", "knockout", "canvg", "splittr", "base64", "js/download",
		"js/anal", "base64-toblob", "ismobile", "exports", "js/octfile",
		"js/vars", "ko-takeArray", "require", "js/onboarding",
		"jquery.md5", "jquery.purl", "ace/theme/crimson_editor",
		"ace/theme/merbivore_soft", "knockout-ace"],
function($, ko, canvg, splittr, Base64, download,
         anal, b64ToBlob, isMobile, exports, OctFile,
         Var, koTakeArray, require, onboarding){

	/* * * * START KNOCKOUT SETUP * * * */

	// Skin MVVM class
	function Skin(name, aceTheme, iconColor){
		var self = this;

		// Main Bindings
		self.name = name;
		self.displayName = name.charAt(0).toUpperCase() + name.slice(1);
		self.iconColor = iconColor;
		self.rawAceTheme = aceTheme;
		self.aceTheme = "ace/theme/"+aceTheme;
		self.cssURL = "styl_css/themes/"+self.name+".css";
	}
	var availableSkins = ko.observableArray([
		new Skin("fire", "crimson_editor", "black"),
		new Skin("lava", "merbivore_soft", "white")
	]);

	// Plot MVVM class
	function PlotObject(id, lineNumber){
		var self = this;

		// Main Bindings
		self.id = id;
		self.lineNumber = lineNumber;
		self.data = ""; // not an observable for performance reasons
		self.complete = ko.observable(false);

		// Functions
		self.addData = function(data){
			self.data += data;
		}
		self.setCurrent = function(){
			var arr = plotHistory();
			for (var i = arr.length - 1; i >= 0; i--) {
				if (arr[i].id === id) {
					currentPlotIdx(i);
				}
			}
		}
		self.download = function(){
			var plotCanvas = document.getElementById("plot_canvas");
			var filename = "octave-online-line-" + self.lineNumber + ".png";

			var renderCallback = function(){
				plotCanvas.toBlob(function(blob){
					download(blob, filename);
				}, "image/png");
			};

			canvg(plotCanvas, self.data, {
				renderCallback: renderCallback,
				ignoreMouse: true
			});
		}
		self.zoom = function(){
			$("#plot_figure_container").toggleClass("fullscreen");
		}
		self.md5 = ko.computed(function(){
			return $.md5(self.data);
		});
		self.completeData = ko.computed(function(){
			if (self.complete()) {
				return self.data;
			} else {
				return "";
			}
		});
	}

	// Initialize MVVM variables
	var allOctFiles = ko.observableArray([]);
	var workspaceVars = ko.observableArray([]);
	var plotHistory = ko.observableArray([]);
	var currentPlotIdx = ko.observable(-1);
	var viewModel = window.viewModel = {
		files: allOctFiles,
		openFile: ko.observable(),
		close: function(){
			OctMethods.editor.close();
		},
		availableSkins: availableSkins,
		selectedSkin: ko.observable(availableSkins()[0]),
		vars: workspaceVars,
		plots: plotHistory,
		currentPlotIdx: currentPlotIdx,

		// More for plots
		currentPlot: ko.computed(function(){
			if (currentPlotIdx()<0) return null;
			return plotHistory()[currentPlotIdx()];
		}),
		showPlot: ko.computed(function(){
			return currentPlotIdx() >= 0;
		}),
		togglePlot: function(){
			var idx = currentPlotIdx();
			var len = plotHistory().length;
			if (len === 0) {
				alert("This button shows and hides the plot window.  Enter an expression that generates a plot.");
			} else if (idx < 0) {
				currentPlotIdx(len-1);
			} else {
				currentPlotIdx(-1);
			}
			OctMethods.prompt.focus();
		},

		// Sign In / Sign Out
		currentUser: ko.observable(),
		doLogout: function(){
			require(["js/login"], function(L){ L.logout(); });
		},

		editorRendered: function(){
			var editor = ko.aceEditors.get("editor");
			editor.setTheme(viewModel.selectedSkin().aceTheme);
			editor.commands.addCommand({
				name: 'save',
				bindKey: { mac: 'Command-S', win: 'Ctrl-S' },
				exec: OctMethods.editorListeners.save,
				readOnly: false
			});
			editor.setOptions({ enableBasicAutocompletion: true });
			OctMethods.editor.instance = editor;
			editor.focus();
		},
		editorUnRendered: function(){
			OctMethods.editor.instance = null;
		},

		fileNameExists: function(filename){
			// return false for filenames like .plot
			if (filename[0] === ".") return false;
			// also return false for the Octave namespace files
			if (filename.substr(0,7) === "octave-") return false;

			return !!ko.utils.arrayFirst(allOctFiles(), function(item){
				return item.filename() === filename;
			});
		}
	};

	/* * * * END KNOCKOUT, START EDITOR/CONSOLE/PROMPT * * * */

	// Helper functions
	function doSessionClose(){
		OctMethods.prompt.disable();
		OctMethods.prompt.endCountdown();
		OctMethods.socket.disconnect();
		// hide the coverall loading div if necessary
		OctMethods.load.hideLoader();
		OctMethods.load.stopPatience();
	}

	function getOrMakePlotById(id, lineNumber){
		var arr = plotHistory();
		for (var i = arr.length - 1; i >= 0; i--) {
			if (arr[i].id === id) return arr[i];
		};

		// Make a new plot object
		var obj = new PlotObject(id, lineNumber);
		plotHistory.push(obj);
		return obj;
	}

	// Define a massive singleton object to contain all methods and listeners
	var OctMethods = {

		// Console Methods
		console: {
			write: function(content){
				$("#console").append(document.createTextNode(content));
				OctMethods.console.scroll();
			},
			writeError: function(content){
				var span = $("<span class=\"prompt_error\"></span>");
				span.append(document.createTextNode(content));
				$("#console").append(span);
				OctMethods.console.scroll();
			},
			writeRow: function(rowString){
				var rowSpan = $("<span class=\"prompt_row\"></span>");
				rowSpan.append(document.createTextNode(rowString));
				$("#console").append(rowSpan);
			},
			writeCommand: function(lineNumber, cmd){
				var rowString;
				if(lineNumber >= 0){
					rowString = "octave:" + lineNumber + "> ";
				}else if(lineNumber === -1){
					rowString = "> ";
				}else{
					rowString = "";
				}
				if(rowString) OctMethods.console.writeRow(rowString);

				var commandSpan = $("<span class=\"prompt_command\"></span>");
				commandSpan.append(document.createTextNode(cmd));
				$("#console").append(commandSpan);

				$("#console").append(document.createTextNode("\n"));

				OctMethods.console.scroll();
			},
			writeRestartBtn: function(){
				var options = $("<span></span>");

				// Construct the normal restart button
				var btn1 = $("<a href=\"javascript:null\"></a>");
				btn1.click(function(){
					OctMethods.socket.reconnect();
					options.remove();
				});
				var txt = "Click Here to Reconnect";
				btn1.append(document.createTextNode(txt));
				options.append(btn1);

				// Append to the console
				$("#console").append(options);
				$("#console").append(document.createTextNode("\n"));
				OctMethods.console.scroll();
			},
			writeUrl: function(url){
				var el = $("<a></a>");
				el.attr("href", url);
				el.attr("target", "_blank");
				el.append(document.createTextNode(url));
				$("#console").append(document.createTextNode("See "));
				$("#console").append(el);
				$("#console").append(document.createTextNode("\n"));
				OctMethods.console.scroll();
			},
			scroll: function(){
				$("#console").scrollTop($("#console")[0].scrollHeight);
				$("#type_here").hide();
			},
			clear: function(){
				$("#console").empty();
			},
			command: function(cmd, skipsend){
				if(!OctMethods.prompt.enabled) return;

				var currentLine = OctMethods.prompt.currentLine;

				// Show the command on screen
				OctMethods.console.writeCommand(currentLine, cmd);

				// Add command to history
				var history = OctMethods.prompt.history;
				history[history.length-1] = cmd;
				history.push("");
				OctMethods.prompt.index = history.length - 1;

				// Start countdown
				OctMethods.prompt.startCountdown();
				OctMethods.prompt.disable();

				// Send to server
				if (!skipsend) OctMethods.socket.command(cmd);
			}
		},

		// Prompt Methods
		prompt: {
			instance: null,
			currentLine: null,
			prevLine: null,
			history: [""],
			index: 0,
			legalTime: 5000,
			countdownInterval: null,
			enabled: true,
			enable: function(){
				$("#runtime_controls_container").hide();
				$("#prompt_container")[0].style.visibility = "visible";
				OctMethods.prompt.enabled = true;
				OctMethods.prompt.endCountdown();
			},
			disable: function(){
				$("#prompt_container")[0].style.visibility = "hidden";
				OctMethods.prompt.enabled = false;
			},
			clear: function(skipLine){
				if(!skipLine){
					if(OctMethods.prompt.currentLine > 0){
						OctMethods.prompt.prevLine = OctMethods.prompt.currentLine;
					}
					OctMethods.prompt.currentLine = null;
				}

				OctMethods.prompt.instance.setValue("");
			},
			focus: function(){
				OctMethods.prompt.instance.focus();
			},
			startCountdown: function(){
				$("#runtime_controls_container").show();
				$("#seconds_remaining").text(OctMethods.prompt.legalTime/1000);
				clearInterval(OctMethods.prompt.countdownInterval);
				OctMethods.prompt.countdownInterval = setInterval(
					OctMethods.promptListeners.countdownTick, 1000
				);
			},
			endCountdown: function(){
				clearInterval(OctMethods.prompt.countdownInterval);
				$("#runtime_controls_container").hide();
				$("#seconds_remaining").text("0");
			},
			askForEnroll: function(program){
				if(!OctMethods.editor.initialized){
					alert("You need to sign in to enroll in a course.");
					return;
				}

				if(confirm("Enroll in \"" + program + "\"?\n\n" +
					"When you enroll in a course, the instructors for that course " +
					"will be able to access the files you save in Octave Online. " +
					"You can cancel your enrollment at any time by running " +
					"enroll('default') at the command prompt.\n\n" +
					"Press Cancel if you don't know what any of this means.")){
					OctMethods.socket.enroll(program);
				}
			}
		},

		// Prompt Callback Funcions
		promptListeners: {
			command: function(prompt){
				var cmd = OctMethods.prompt.instance.getValue();
				OctMethods.socket.notifyCommand(cmd);

				// Check if this command is a front-end command
				var enrollRegex = /^enroll\s*\(['"](\w+)['"]\).*$/;
				var updateStudentsRegex = /^update_students\s*\(['"](\w+)['"]\).*$/;

				if(enrollRegex.test(cmd)){
					var program = cmd.match(enrollRegex)[1];
					OctMethods.prompt.askForEnroll(program);
					OctMethods.prompt.clear(true);
				}else if(updateStudentsRegex.test(cmd)){
					var program = cmd.match(updateStudentsRegex)[1];
					OctMethods.socket.updateStudents(program);
					OctMethods.prompt.clear(true);
				}else{
					OctMethods.console.command(cmd);
					OctMethods.prompt.clear(false);
				}

				anal.command(cmd);
			},
			signal: function(event){
				OctMethods.socket.signal();
				anal.sigint();
			},
			historyUp: function(prompt){
				var history = OctMethods.prompt.history;
				if (OctMethods.prompt.index == history.length-1){
					history[history.length-1] = prompt.getValue();
				}
				if (OctMethods.prompt.index > 0){
					OctMethods.prompt.index -= 1;
					prompt.setValue(history[OctMethods.prompt.index]);
				}
			},
			historyDown: function(prompt){
				var history = OctMethods.prompt.history;
				if (OctMethods.prompt.index < history.length-1){
					OctMethods.prompt.index += 1;
					prompt.setValue(history[OctMethods.prompt.index]);
				}
			},
			keyFocus: function(e){
				e.preventDefault();
				OctMethods.prompt.focus();
			},
			countdownTick: function(){
				var oldSeconds = parseInt($("#seconds_remaining").text());
				$("#seconds_remaining").text(oldSeconds - 1);
				if(oldSeconds===1) OctMethods.prompt.endCountdown();
			},
			permalink: function(){
				// TODO: Add this directly into purl
				var cmd = $(this).text();
				window.location.hash = "cmd=" + encodeURIComponent(cmd);
			}
		},

		// Plot Methods
		plot: {
			displayedId: null,
			loading: function(){
				$("#plot_svg_container").hide();
				$("#plot_loading").show();
				OctMethods.plot.open();
			},
			open: function(){
				$("#plot_container").showSafe();
				onboarding.hideScriptPromo();
			},
			close: function(){
				$("#plot_container").hideSafe();
			},
			toggle: function(){
				$("#plot_container").toggleSafe();
			}
		},

		// Plot Callback Functions
		plotListeners: {
			close: function(){
				OctMethods.plot.close();
				OctMethods.prompt.focus();
			},
			open: function(){
				OctMethods.plot.open();
				OctMethods.prompt.focus();
			},
			toggle: function(){
				OctMethods.plot.toggle();
				OctMethods.prompt.focus();
			}
		},

		// Socket Methods
		socket: {
			instance: null,
			sessCode: null,
			signal: function(){
				return OctMethods.socket.emit("signal", {});
			},
			command: function(cmd){
				return OctMethods.socket.emit("data", {
					data: cmd
				});
			},
			save: function(octfile){
				return OctMethods.socket.emit("save", {
					filename: octfile.filename(),
					content: octfile.content()
				});
			},
			rename: function(octfile, newName){
				return OctMethods.socket.emit("rename", {
					filename: octfile.filename(),
					newname: newName
				});
			},
			deleteit: function(octfile){
				return OctMethods.socket.emit("delete", {
					filename: octfile.filename()
				});
			},
			binary: function(octfile){
				return OctMethods.socket.emit("binary", {
					filename: octfile.filename()
				});
			},
			enroll: function(program){
				return OctMethods.socket.emit("enroll", {
					program: program
				});
			},
			updateStudents: function(program, password){
				return OctMethods.socket.emit("update_students", {
					program: program
				});
			},
			notifyCommand: function(cmd){
				return OctMethods.socket.emit("ws.command", {
					data: cmd
				});
			},
			refresh: function(){
				return OctMethods.socket.emit("refresh", {});
			},
			emit: function(message, data){
				if (!OctMethods.socket.instance
					|| !OctMethods.socket.instance.connected) {
					console.log("Socket Closed", message, data);
					return false;
				}
				OctMethods.socket.instance.emit(message, data);
				return true;
			},
			reconnect: function(){
				OctMethods.load.showLoader();
				OctMethods.load.startPatience();

				return OctMethods.socket.emit("oo.reconnect", {});
			}
		},

		// Socket Callback Functions
		socketListeners: {
			data: function(data){
				switch(data.type){
					case "stdout":
						OctMethods.console.write(data.data);
						break;
					case "stderr":
						OctMethods.console.writeError(data.data);
						break;
					case "exit":
						console.log("exit code: " + data.code);
						break;
					default:
						console.log("unknown data type: " + data.type);
				}
			},
			prompt: function(data){
				var lineNumber = data.line_number || 0;

				// Turn on the input prompt and set the current line number
				if (OctMethods.prompt.currentLine === null
					|| OctMethods.prompt.currentLine < 0){
					OctMethods.prompt.currentLine = lineNumber;
				}
				OctMethods.prompt.enable();

				// Perform other cleanup logic
				if(OctMethods.editor.running){
					if(lineNumber > 0){
						OctMethods.editor.running = false;
					}else{
						OctMethods.prompt.focus();
					}
				}else if(!isMobile){
					OctMethods.prompt.focus();
				}

				// hide the coverall loading div if necessary
				OctMethods.load.callback();
			},
			saved: function(data){
				var revs = OctMethods.editor.fileRevisions[data.filename];
				var i = revs.length-1;
				for(; i>=0; i--){
					var rev = revs[i];
					if(rev.md5 == data.md5){
						window.status = data.filename+" saved";
						return;
					}
				}
			},
			renamed: function(data){
				var newname = data.newname, oldname = data.oldname;
				var octfile = ko.utils.arrayFirst(allOctFiles(), function(item){
					return item.filename() === oldname;
				});
				if(!octfile) return;

				// Rename the file throughout the schema
				octfile.filename(data.newname);
				var oldRevisions = OctMethods.editor.fileRevisions[oldname];
				OctMethods.editor.fileRevisions[newname] = oldRevisions;
				OctMethods.editor.fileRevisions[oldname] = null;
			},
			deleted: function(data){
				var octfile = ko.utils.arrayFirst(allOctFiles(), function(item){
					return item.filename() === data.filename;
				});
				if(!octfile) return;
				OctMethods.editor.remove(octfile);
			},
			binary: function(data){
				var octfile = ko.utils.arrayFirst(allOctFiles(), function(item){
					return item.filename() === data.filename;
				});
				if(!octfile) return;

				// Attempt to download the file
				console.log("Downloading binary file", octfile);
				var blob = b64ToBlob(data.base64data, data.mime);
				return download(blob, octfile.filename());
			},
			user: function(data){

				// Load files
				OctMethods.editor.reset();
				$.each(data.files, function(filename, filedata){
					if(filedata.isText){
						OctMethods.editor.add(filename, Base64.decode(filedata.content));
					}else{
						OctMethods.editor.addNameOnly(filename);
					}
				});

				// One-time methods
				if (!OctMethods.editor.initialized) {
					OctMethods.editor.initialized = true;

					// Legal runtime
					OctMethods.prompt.legalTime = data.legalTime;

					// Set up the UI
					$("#open_container").showSafe();
					$("#files_container").showSafe();
					onboarding.showSyncPromo();

					// Trigger Knockout
					viewModel.currentUser(data);

					// Analytics
					anal.signedin();
				}
			},
			fileadd: function(data){
				if(data.isText){
					var octfile = OctMethods.editor.add(data.filename,
						Base64.decode(data.content));
					OctMethods.editor.open(octfile);
				}else{
					OctMethods.editor.addNameOnly(data.filename);
				}
			},
			plotd: function(data){
				// plot data transmission
				var plot = getOrMakePlotById(data.id, OctMethods.prompt.prevLine);
				plot.addData(data.content);
				plot.setCurrent();
				console.log("Received data for plot ID "+data.id);
			},
			plote: function(data){
				// plot data complete
				var plot = getOrMakePlotById(data.id);
				plot.complete(true);

				if(data.md5 !== plot.md5()){
					// should never happen
					console.log("MD5 discrepancy!");
					console.log(data);
					console.log(plot.md5());
				}
			},
			ctrl: function(data){
				// command from shell
				console.log("Received ctrl '", data.command, "' from server");
				if(data.command === "clc"){
					OctMethods.console.clear();
				}else if(data.command.substr(0,4) === "url="){
					OctMethods.console.writeUrl(data.command.substr(4));
				}else if(data.command.substr(0,6) === "enroll"){
					OctMethods.prompt.askForEnroll(data.command.substr(7));
				}
			},
			workspace: function(data){
				// update workspace variables
				koTakeArray(Var, workspaceVars, "symbol",
					data.vars, "symbol");
				workspaceVars.sort(Var.sorter);
			},
			sesscode: function(data){
				console.log("sessCode", data.sessCode);
				OctMethods.socket.sessCode = data.sessCode;
			},
			init: function(){
				// Regular session or shared session?
				if (OctMethods.vars.wsId) {
					OctMethods.socket.emit("init", {
						action: "workspace",
						wsId: OctMethods.vars.wsId
					});
				}else{
					OctMethods.socket.emit("init", {
						action: "session",
						sessCode: OctMethods.socket.sessCode
					});
				}
			},
			destroyu: function(message){
				OctMethods.console.writeError("Octave Exited. Message: "+message+"\n");
				OctMethods.console.writeRestartBtn();

				// Clean up UI
				OctMethods.prompt.disable();
				OctMethods.prompt.endCountdown();
				OctMethods.load.hideLoader();
			},
			disconnect: function(){
				OctMethods.console.writeError("Connection lost.  Attempting to reconnect...\n");
				
				// Clean up UI
				OctMethods.prompt.disable();
				OctMethods.prompt.endCountdown();
				OctMethods.load.showLoader();
			}
		},

		// Editor Methods
		editor: {
			instance: null,
			fileRevisions: [],
			defaultFilename: "my_script.m",
			defaultContent: 'disp("Hello World");\n',
			running: false,
			initialized: false,
			save: function(octfile){
				if(OctMethods.socket.save(octfile)){
					var md5hash = $.md5(octfile.content);
					OctMethods.editor.fileRevisions[octfile.filename()].push({
						md5: md5hash,
						timestamp: new Date()
					});
					return true;
				} else return false;
			},
			add: function(filename, content){
				var octfile = new OctFile(filename, content, true);
				allOctFiles.push(octfile);
				allOctFiles.sort(OctFile.sorter);
				OctMethods.editor.fileRevisions[filename] = [];
				return octfile;
			},
			addNameOnly: function(filename){
				var octfile = new OctFile(filename, "", false);
				allOctFiles.push(octfile);
				allOctFiles.sort(OctFile.sorter);
				OctMethods.editor.fileRevisions[filename] = [];
				return octfile;
			},
			create: function(filename){
				// check to see if the file already exists
				if (viewModel.fileNameExists(filename)) {
					return false;
				}
				// check for valid filename
				if(!OctFile.regexps.filename.test(filename)){
					return false;
				}
				var octfile = OctMethods.editor.add(
					filename,
					OctMethods.editor.defaultContent);
				OctMethods.editor.save(octfile);
				OctMethods.editor.fileRevisions[filename] = [];
				return octfile;
			},
			remove: function(octfile){
				allOctFiles.remove(octfile);
			},
			deleteit: function(octfile){
				return OctMethods.socket.deleteit(octfile);
			},
			run: function(octfile){
				var cmd = octfile.command();
				if(!cmd) return false;
				OctMethods.console.command(cmd);
				OctMethods.editor.running = true;
				anal.runfile();
				return true;
			},
			rename: function(octfile){
				var oldName = octfile.filename();
				var newName = prompt("Enter a new filename:", oldName);
				if (!newName || oldName === newName) return false;
				if (viewModel.fileNameExists(newName)){
					alert("The specified filename already exists.");
					return false;
				}
				return OctMethods.socket.rename(octfile, newName);
			},
			download: function(octfile){
				// Two cases: front-end text file or back-end binary file.
				if(octfile.editable){
					// If it's a text file, we can download it now
					var mime = "text/x-octave;charset=utf-8";
					var blob = new Blob([octfile.content()], { type: mime });
					return download(blob, octfile.filename());
				}else{
					// If it's a binary file, we have to request it from the server
					return OctMethods.socket.binary(octfile);
				}
			},
			print: function(octfile){
				// Make a new window and a temporary document object
				var w = window.open();
				var doc = $("<div>");

				// Add a title line
				var h1 = $("<h1>");
				h1.append(octfile.filename());
				h1.css("font", "bold 14pt/14pt 'Trebuchet MS',Verdana,sans-serif");
				h1.css("margin", "6pt");
				doc.append(h1);

				// Create the Ace highlighter
				var highlight = require("ace/ext/static_highlight").render(
					octfile.content(),
					new (require("ace/mode/octave").Mode)(),
					require("ace/theme/crimson_editor")
				);

				// Create the Ace stylesheet
				var ss = $("<style type='text/css'></style>");
				ss.append(highlight.css);

				// Append the Ace highlighter and stylesheet
				var editorDiv = $("<div></div>");
				editorDiv.append(highlight.html);
				doc.append(ss);
				doc.append(editorDiv);

				// Add a credit line at the bottom
				var creditDiv = $("<div></div>");
				creditDiv.append("Printed for " + viewModel.currentUser().name);
				creditDiv.append("<br/>");
				creditDiv.append("Powered by Octave Online");
				creditDiv.append("<br/>");
				creditDiv.append("http://octave-online.net");
				creditDiv.css("font", "10pt/10pt 'Trebuchet MS',Verdana,sans-serif");
				creditDiv.css("text-align", "right");
				creditDiv.css("margin-top", "16pt");
				doc.append(creditDiv);

				// Add the document data to the window
				w.document.body.innerHTML += doc.html();

				// Trigger Print
				w.window.print();
			},
			open: function(octfile){
				viewModel.openFile(octfile);
			},
			close: function(){
				viewModel.openFile(null);
			},
			reset: function(){
				viewModel.openFile(null);
				allOctFiles.removeAll();
			}
		},

		// Editor Callback Functions
		editorListeners: {
			newCB: function(e){
				var filename = OctMethods.editor.defaultFilename;
				// do..while to protect against duplicate file names
				do{
					filename = prompt("Please enter a filename:", filename);
				} while(filename && !OctMethods.editor.create(filename));
			},
			refresh: function(e){
				if(confirm("This will reload your files from the server. You will " +
					"lose any unsaved changes.")){
					OctMethods.editor.reset();
					OctMethods.socket.refresh();
				}
			},
			info: function(e){
				$("#sync_info_box").show();
			},
			run: function(editor){
				OctMethods.editor.run(viewModel.openFile());
			},
			keyRun: function(e){
				e.preventDefault();
				if(viewModel.openFile()){
					OctMethods.editor.run(viewModel.openFile());
				}
			},
			save: function(e){
				viewModel.openFile().save();
			}
		},

		load: {
			firstConnection: true,
			loaderVisible: true,
			bePatientTimeout: null,
			callback: function(){
				if(OctMethods.load.loaderVisible){
					OctMethods.load.hideLoader();
				}
				if(OctMethods.load.firstConnection){
					OctMethods.load.firstConnection = false;

					// UI setup
					$("#type_here").show();

					// Evaluate the query string command (uses purl)
					try{
						var initCmd = $.url().fparam("cmd");
					}catch(e){
						console.log(e);
					}

					if(initCmd){
						OctMethods.console.command(initCmd);
					}
				}
			},
			showLoader: function(){
				OctMethods.load.loaderVisible = true;
				$("#site_loading").show();
			},
			hideLoader: function(){
				OctMethods.load.loaderVisible = false;
				OctMethods.load.stopPatience();
				$("#site_loading").fadeOut(500);
			},
			startPatience: function(){
				OctMethods.load.stopPatience();
				OctMethods.load.bePatientTimeout = setTimeout(function(){
					$("#site_loading_patience").show();
					OctMethods.load.bePatientTimeout = null;
					anal.patience();
				}, 10000);
			},
			stopPatience: function(){
				$("#site_loading_patience").hide();
				if (!OctMethods.load.bePatientTimeout) return;
				clearTimeout(OctMethods.load.bePatientTimeout);
				OctMethods.load.bePatientTimeout = null;
			}
		},

		// Other accessor properties
		ko: {
			viewModel: viewModel,
			allOctFiles: allOctFiles
		},
		vars: {
			wsId: null
		}
	};

	// Expose
	exports.console = OctMethods.console;
	exports.prompt = OctMethods.prompt;
	exports.promptListeners = OctMethods.promptListeners;
	exports.plot = OctMethods.plot;
	exports.plotListeners = OctMethods.plotListeners;
	exports.socket = OctMethods.socket;
	exports.socketListeners = OctMethods.socketListeners;
	exports.editor = OctMethods.editor;
	exports.editorListeners = OctMethods.editorListeners;
	exports.load = OctMethods.load;
	exports.ko = OctMethods.ko;
	exports.vars = OctMethods.vars;

}); // AMD Define
