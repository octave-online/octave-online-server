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

define([
	"knockout", "require", "js/ws-shared", "jquery",
	"jquery.md5"], function(ko, require, WsShared, $){

	var OctMethods = require("js/client");

	// OctFile MVVM class
	function OctFile(filename, content, editable){
		// the "self" variable enables us to refer to the OctFile context even when
		// we are programming within callback function contexts
		var self = this;

		// Main Bindings
		self.filename = ko.observable(filename);
		self.content = ko.observable(content);
		self.editable = editable;

		// Identifier: needs to be URL hash safe
		self.identifier = ko.computed(function(){
			// Replace all nonalphanumeric characters with underscores
			return self.filename().replace(/\W/g, "_");
		});
		self.hash = ko.computed(function(){
			return "#"+self.identifier();
		});

		// Methods relating to running the file
		self.baseName = ko.computed(function(){
			var nameMatch = OctFile.regexps.functionname.exec(self.filename());
			if (!nameMatch || nameMatch.length < 1) return false;
			return nameMatch[1];
		});
		self.isFunction = ko.computed(function(){
			return OctFile.regexps.isFunction.test(self.content());
		});
		self.getFunctionParameters = ko.computed(function(){
			if(!self.isFunction()) return false;
			var match = OctFile.regexps.matchParameters.exec(self.content());
			if(!match || match[1]==="") return [];
			return match[1].split(/\s*,\s*/);
		});
		var argumentsStore = [];
		self.command = function(){
			if (!self.runnable()) return false;
			var parameters = self.getFunctionParameters();
			var baseName = self.baseName();
			if (parameters) {
				var arg;
				for(var i=0; i<parameters.length; i++){
					if(typeof argumentsStore[i] === "undefined"){
						argumentsStore.push("");
					}
					arg = argumentsStore[i];
					if((arg=prompt(parameters[i]+" = ?", arg))===null){
						return false;
					}
					argumentsStore[i] = arg;
				}
				return (self.dirpart()?"source(\""+self.filename()+"\"); ":"")+baseName+"("+argumentsStore.join(", ")+")";
			} else {
				return "source(\""+self.filename()+"\")";
			}
		};
		self.runnable = ko.computed(function(){
			return OctFile.regexps.filename.test(self.filename());
		});

		// Display functions
		self.dirpart = ko.computed(function(){
			var slashIndex = self.filename().lastIndexOf("/");
			if (slashIndex === -1) return "";
			return self.filename().substring(0, slashIndex + 1);
		});
		self.filepart = ko.computed(function(){
			var slashIndex = self.filename().lastIndexOf("/");
			if (slashIndex === -1) return self.filename();
			return self.filename().substring(slashIndex + 1);
		});

		// Open file in the editor
		self.open = function(){
			OctMethods.editor.open(self);
		};

		// Toolbar functions
		self.runit = function(){
			if(!OctMethods.editor.run(self)){
				alert("You can only run Octave *.m files. :-)");
			}
		};
		self.deleteit = function(){
			if(confirm("You are about to delete the following file. After deleting the file, you may still be able to recover it from the file revision history viewer.\n\n"+self.filename())){
				if(!OctMethods.editor.deleteit(self)){
					alert("Can't delete file. Did you disconnect from " +
					"Octave Online?");
				}
			}
		};
		self.savedContent = ko.observable(content);
		self.save = function(){
			if(!OctMethods.editor.save(self)){
				alert("Can't save file. Did you disconnect from Octave Online?");
			}
		};
		self.md5 = function(){
			return $.md5(self.content());
		};
		self.print = function(){
			OctMethods.editor.print(self);
		};
		self.rename = function(){
			OctMethods.editor.rename(self);
		};
		self.download = function(){
			OctMethods.editor.download(self);
		};
		self.share = function(){
			OctMethods.ko.viewModel.startNewBucket(self);
		};
		self.isActive = ko.computed(function(){
			return self === OctMethods.ko.viewModel.openFile();
		});
		self.isModified = ko.computed(function(){
			return self.content() !== self.savedContent();
		});
		self.buttonsShown = ko.observable(true);
		self.buttonsShown.subscribe(function(){
			// Fire the "resize" event here so that the Ace editor redraws itself.
			// This is probably not the most efficient way to achieve that end goal.
			// Do it in a setTimeout so that the other buttonsShown callbacks finish
			// first.
			setTimeout(function(){
				var evt = document.createEvent("UIEvents");
				evt.initUIEvent("resize", true, false, window, 0);
				window.dispatchEvent(evt);
			}, 0);
		});
		self.wrap = ko.observable(true);

		self.getOtClient = function(){
			return WsShared.clientForFilename(self.filename());
		};

		// toString method
		self.toString = function(){
			return "[File:"+self.filename()+" "+self.content()+"]";
		};
	}
	OctFile.sorter = function(a, b){
		return a.filename() === b.filename() ? 0 : (
			a.filename() < b.filename() ? -1 : 1
		);
	};
	OctFile.regexps = {};
	OctFile.regexps.isFunction = /^(?:[\t\f ]*(?:[\%\#].*)?\n)*\s*function\s/;
	OctFile.regexps.matchParameters = /function[^\(]+\(\s*([^\)]*?)\s*\)/;
	OctFile.regexps.filename = /^(?:\.?[^\/\.\0]+\/){0,3}\.?[^\/\.\0]+[^\/\0]*$/;
	OctFile.regexps.functionname = /([^\/\.\0]+)\.m$/;

	// Expose interface
	return OctFile;

});
