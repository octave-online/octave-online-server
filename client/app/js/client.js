// Client-Side JavaScript for Octave Online

define(
	["jquery", "knockout", "canvg", "base64", "js/download",
		"js/anal", "base64-toblob", "ismobile", "exports", "js/octfile",
		"js/vars", "ko-takeArray", "require", "js/onboarding", "js/ws-shared",
		"blob", "jquery.md5", "jquery.purl", "ace/theme/crimson_editor",
		"ace/theme/merbivore_soft", "js/ko-ace"],
function($, ko, canvg, Base64, download,
         anal, b64ToBlob, isMobile, exports, OctFile,
         Var, koTakeArray, require, onboarding, WsShared){

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
		self.cssURL = "css/themes/"+self.name+".css";
	}
	var availableSkins = [
		new Skin("fire", "crimson_editor", "black"),
		new Skin("lava", "merbivore_soft", "white"),
		new Skin("ice", "crimson_editor", "black")
	];

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
		self.downloadPng = function(){
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
		self.downloadSvg = function(){
			var blob = new Blob([self.data], { type: "image/svg+xml" });
			var filename = "octave-online-line-" + self.lineNumber + ".svg";

			download(blob, filename);
		}
		self.zoom = function(){
			$("#plot_figure_container").toggleClass("fullscreen");
		}
		self.completeData = ko.computed(function(){
			if (self.complete()) {
				return self.data;
			} else {
				return "";
			}
		});
		self.md5 = ko.computed(function(){
			return $.md5(self.completeData());
		});
		self.bindElement = function($el){
			self.complete.subscribe(function(){
				$el.append(self.completeData());
				$el.find(".inline-plot-loading").fadeOut(500);
			});
		};
	}

	// Initialize MVVM variables
	var allOctFiles = ko.observableArray([]);
	var vars = ko.observableArray([]);
	var plotHistory = ko.observableArray([]);
	var currentPlotIdx = ko.observable(-1);
	var viewModel = window.viewModel = {
		files: allOctFiles,
		openFile: ko.observable(),
		close: function(){
			OctMethods.editor.close();
		},
		selectedSkin: ko.observable(availableSkins[0]),
		vars: vars,
		plots: plotHistory,
		currentPlotIdx: currentPlotIdx,
		inlinePlots: ko.observable(true),
		instructorPrograms: ko.observableArray(),

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
		firstPlotShown: ko.computed(function(){
			return currentPlotIdx() === 0;
		}),
		lastPlotShown: ko.computed(function(){
			return currentPlotIdx()+1 === plotHistory().length;
		}),
		showPrevPlot: function(){
			var idx = currentPlotIdx();
			if (idx <= 0) return null;
			currentPlotIdx(idx - 1);
		},
		showNextPlot: function(){
			var idx = currentPlotIdx();
			var len = plotHistory().length;
			if (idx+1 >= len) return null;
			currentPlotIdx(idx + 1);
		},

		// Sign In / Sign Out
		currentUser: ko.observable(),
		doLogout: function(){
			require(["js/login"], function(L){ L.logout(); });
		},

		toggleSharing: function(){
			var shareKey = viewModel.currentUser().share_key;
			var program = viewModel.currentUser().program;
			if (program && program !== "default") {
				alert("You cannot disable sharing as a student enrolled in an Octave Online program.  You need to remove yourself from \"" + program + "\" by running \"enroll('default')\" at the command prompt.");
			} else {
				OctMethods.socket.toggleSharing(!shareKey);
			}
		},

		getOctFileFromName: function(filename){
			return ko.utils.arrayFirst(allOctFiles(), function(item){
				return item.filename() === filename;
			});
		},
		fileNameExists: function(filename){
			// return false for filenames like .plot
			if (filename[0] === ".") return false;
			// also return false for the Octave namespace files
			if (filename.substr(0,7) === "octave-") return false;

			return !!viewModel.getOctFileFromName(filename);
		},

		flex: {
			sizes: ko.observableArray([100, 400, 75, 325]),
			shown: ko.observable(false)
		}
	};
	viewModel.showUserInHeader = ko.computed(function(){
		return (viewModel.currentUser()
			&& viewModel.selectedSkin() === availableSkins[2]);
	});
	viewModel.shareLink = ko.computed(function(){
		if (!viewModel.currentUser()) return "";
		return window.location.origin + window.location.pathname
			+ "?s=" + viewModel.currentUser().share_key;
	});
	viewModel.flex.outputCss = ko.computed(function(){
		return "flex-basis:" + (viewModel.flex.sizes()[2] + viewModel.flex.sizes()[3]) + "px";
	});
	viewModel.flex.sizes.extend({ localStorage: "flex:h" });
	viewModel.inlinePlots.extend({ localStorage: "inline-plots" });
	// Keep the console output visible when the plot window opens
	viewModel.showPlot.subscribe(function(){
		setTimeout(OctMethods.console.scroll, 0);
	});

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

		// Display it, either inline or in the plot window
		if (viewModel.inlinePlots()) {
			obj.bindElement(OctMethods.console.writePlot());
		} else {
			obj.setCurrent();
		}

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
				var btn1 = $("<a class=\"clickable\"></a>");
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
			writePlot: function(){
				var el = $("<div></div>");
				el.attr("class", "inline-plot");
				loading = $("<div></div>");
				loading.attr("class", "inline-plot-loading");
				el.append(loading);
				$("#console").append(el);
				OctMethods.console.scroll();
				return el;
			},
			scroll: function(){
				$("#console").scrollTop($("#console")[0].scrollHeight);
				$("#type_here").hideSafe();
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
				if (!skipsend) {
					OctMethods.socket.command(cmd);
				}
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
			countdownTime: 0,
			countdownDelay: 20,
			enabled: true,
			enable: function(){
				$("#runtime_controls_container").hideSafe();
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
				$("#runtime_controls_container").showSafe();
				OctMethods.prompt.countdownTime = new Date().valueOf();

				OctMethods.prompt.countdownTick();
				clearInterval(OctMethods.prompt.countdownInterval);
				OctMethods.prompt.countdownInterval = setInterval(
					OctMethods.prompt.countdownTick, OctMethods.prompt.countdownDelay
				);
			},
			countdownTick: function(){
				var elapsed = new Date().valueOf() - OctMethods.prompt.countdownTime;
				var remaining = (OctMethods.prompt.legalTime - elapsed);
				if(remaining<=0) {
					clearInterval(OctMethods.prompt.countdownInterval);
					$("#seconds_remaining").text("---");
				}else{
					$("#seconds_remaining").text((remaining/1000).toFixed(2));
				}
			},
			endCountdown: function(){
				clearInterval(OctMethods.prompt.countdownInterval);
				$("#runtime_controls_container").hideSafe();
				$("#seconds_remaining").text("0");

				if (OctMethods.prompt.countdownTime > 0)
					anal.duration(new Date().valueOf() - OctMethods.prompt.countdownTime);
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
					viewModel.currentUser().program = program; // note: this is not observable
				}
			}
		},

		// Prompt Callback Funcions
		promptListeners: {
			command: function(prompt){
				var cmd = OctMethods.prompt.instance.getValue();

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
				// Trigger both a signal and an empty command upstream.  The empty command will sometimes help if, for any reason, the "prompt" message was lost in transit.
				// This could be slightly improved by adding the empty command elsewhere in the stack, to reduce the number of packets that need to be sent.
				OctMethods.socket.signal();
				OctMethods.socket.command("");
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
					prompt.getSelection().clearSelection();
				}
			},
			historyDown: function(prompt){
				var history = OctMethods.prompt.history;
				if (OctMethods.prompt.index < history.length-1){
					OctMethods.prompt.index += 1;
					prompt.setValue(history[OctMethods.prompt.index]);
					prompt.getSelection().clearSelection();
				}
			},
			keyFocus: function(e){
				e.preventDefault();
				OctMethods.prompt.focus();
			},
			permalink: function(){
				// TODO: Add this directly into purl
				var cmd = $(this).text();
				window.location.hash = "cmd=" + encodeURIComponent(cmd);
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
			refresh: function(){
				return OctMethods.socket.emit("refresh", {});
			},
			toggleSharing: function(enabled){
				return OctMethods.socket.emit("oo.toggle_sharing", {
					enabled: enabled
				});
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
				}else if(isMobile && lineNumber>1){
					OctMethods.prompt.focus();
					setTimeout(function(){
						// Does not quite work
						window.scrollTo(0,document.body.scrollHeight);
					}, 500);
				}else if(!isMobile){
					OctMethods.prompt.focus();
				}

				// hide the coverall loading div if necessary
				OctMethods.load.callback();
			},
			saved: function(data){
			},
			renamed: function(data){
				var oldname = data.oldname, newname = data.newname;
				var octfile = viewModel.getOctFileFromName(oldname);
				if(!octfile) return;

				// Rename the file throughout the schema
				octfile.filename(data.newname);
			},
			deleted: function(data){
				var octfile = viewModel.getOctFileFromName(data.filename);
				if(!octfile) return;
				if (viewModel.openFile() === octfile) {
					OctMethods.editor.close();
				}
				OctMethods.editor.remove(octfile);
			},
			binary: function(data){
				var octfile = viewModel.getOctFileFromName(data.filename);
				if(!octfile) return;

				// Attempt to download the file
				console.log("Downloading binary file", octfile);
				var blob = b64ToBlob(data.base64data, data.mime);
				return download(blob, octfile.filename());
			},
			user: function(data){
				// One-time methods
				if (!OctMethods.editor.initialized && data) {
					OctMethods.editor.initialized = true;

					// Set up the UI
					$("#open_container").showSafe();
					onboarding.hideScriptPromo();

					// Trigger Knockout
					data.name = data.name || data.displayName;
					viewModel.currentUser(data);

					// Analytics
					anal.signedin();
				}
			},
			dir: function(data){
				// Load files
				if (allOctFiles().length === 0) {
					$.each(data.files, function(filename, filedata){
						if(filedata.isText){
							OctMethods.editor.add(filename, Base64.decode(filedata.content));
						}else{
							OctMethods.editor.addNameOnly(filename);
						}
					});

					// Set up the UI
					$("#files_container").showSafe();
					onboarding.showSyncPromo();

					// Legal runtime
					OctMethods.prompt.legalTime = data.legalTime;
				}
			},
			fileadd: function(data){
				if(data.isText){
					var octFile = OctMethods.editor.add(data.filename,
						Base64.decode(data.content));
					OctMethods.editor.open(octFile);
				}else{
					OctMethods.editor.addNameOnly(data.filename);
				}
			},
			plotd: function(data){
				// plot data transmission
				var plot = getOrMakePlotById(data.id, OctMethods.prompt.prevLine);
				plot.addData(data.content);
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
			vars: function(data){
				// update variables
				koTakeArray(Var, vars, "symbol",
					data.vars, "symbol");
				vars.sort(Var.sorter);
			},
			sesscode: function(data){
				console.log("SESSCODE:", data.sessCode);
				OctMethods.socket.sessCode = data.sessCode;
			},
			reload: function(){
				window.location.reload();
			},
			instructor: function(data){
				data.users.forEach(function(user){
					user.shareUrl = window.location.origin + window.location.pathname
						+ "?s=" + user.share_key;
				});
				viewModel.instructorPrograms.push(data);
			},
			restartCountdown: function(){
				OctMethods.prompt.startCountdown();
			},
			init: function(){
				// Regular session or shared session?
				if (OctMethods.vars.wsId) {
					OctMethods.socket.emit("init", {
						action: "workspace",
						info: OctMethods.vars.wsId
					});

					// Use the "ice" theme to visually differentiate shared sessions
					viewModel.selectedSkin(availableSkins[2]);
					$("#change-skin").hide();

				}else if(OctMethods.vars.studentId){
					OctMethods.socket.emit("init", {
						action: "student",
						info: OctMethods.vars.studentId
					});

					// Use the "ice" theme to visually differentiate shared sessions
					viewModel.selectedSkin(availableSkins[2]);
					$("#change-skin").hide();

				}else{
					OctMethods.socket.emit("init", {
						action: "session",
						info: OctMethods.socket.sessCode
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
			defaultFilename: "my_script.m",
			defaultContent: 'disp("Hello World");\n',
			running: false,
			initialized: false,
			save: function(octfile){
				if(OctMethods.socket.save(octfile)){
					var md5hash = $.md5(octfile.content);
					return true;
				} else return false;
			},
			add: function(filename, content){
				var octfile = new OctFile(filename, content, true);
				allOctFiles.push(octfile);
				allOctFiles.sort(OctFile.sorter);
				return octfile;
			},
			addNameOnly: function(filename){
				var octfile = new OctFile(filename, "", false);
				allOctFiles.push(octfile);
				allOctFiles.sort(OctFile.sorter);
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
				if(confirm("This will reload your files from the server. Any " +
					"unsaved changes will be lost.")){
					OctMethods.editor.reset();
					OctMethods.socket.refresh();
				}
			},
			info: function(e){
				$("#sync_info_box").showSafe();
			},
			run: function(editor){
				OctMethods.editor.run(viewModel.openFile());
			},
			keyRun: function(e){
				e.preventDefault();
				if(viewModel.openFile()){
					OctMethods.editor.run(viewModel.openFile());
				}
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
					$("#type_here").showSafe();
					$("#vars_panel").showSafe();

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
				$("#site_loading").showSafe();
			},
			hideLoader: function(){
				OctMethods.load.loaderVisible = false;
				OctMethods.load.stopPatience();
				$("#site_loading").fadeOutSafe(500);
			},
			startPatience: function(){
				OctMethods.load.stopPatience();
				OctMethods.load.bePatientTimeout = setTimeout(function(){
					$("#site_loading_patience").showSafe();
					anal.patience();
					OctMethods.load.bePatientTimeout = setTimeout(function(){
						$("#site_loading_patience").hideSafe();
						$("#site_loading_more_patience").showSafe();
						OctMethods.load.bePatientTimeout = null;
					}, 35000);
				}, 10000);
			},
			stopPatience: function(){
				$("#site_loading_patience").hideSafe();
				$("#site_loading_more_patience").hideSafe();
				if (!OctMethods.load.bePatientTimeout) return;
				clearTimeout(OctMethods.load.bePatientTimeout);
				OctMethods.load.bePatientTimeout = null;
			}
		},

		// Other accessor properties
		ko: {
			viewModel: viewModel,
			allOctFiles: allOctFiles,
			availableSkins: availableSkins
		},
		vars: {
			wsId: null,
			studentId: null
		}
	};

	// Expose
	exports.console = OctMethods.console;
	exports.prompt = OctMethods.prompt;
	exports.promptListeners = OctMethods.promptListeners;
	exports.plot = OctMethods.plot;
	exports.socket = OctMethods.socket;
	exports.socketListeners = OctMethods.socketListeners;
	exports.editor = OctMethods.editor;
	exports.editorListeners = OctMethods.editorListeners;
	exports.load = OctMethods.load;
	exports.ko = OctMethods.ko;
	exports.vars = OctMethods.vars;

}); // AMD Define
