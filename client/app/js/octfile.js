define(["knockout", "require"], function(ko, require){

	var OctMethods = require("js/client");

	// OctFile MVVM class
	function OctFile(filename, content, editable){
		// the "self" variable enables us to refer to the OctFile context even when
		// we are programming within callback function contexts
		var self = this;

		// Main Bindings
		self.filename = ko.observable(filename);
		self.content = ko.observable(content);
		this.editable = editable;

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
			var nameMatch = OctFile.regexps.filename.exec(self.filename());
			if (!nameMatch || nameMatch.length < 2) return false;
			return nameMatch[2];
		})
		self.isFunction = ko.computed(function(){
			return OctFile.regexps.isFunction.test(self.content());
		});
		self.getFunctionParameters = ko.computed(function(){
			if(!self.isFunction()) return false;
			var match = OctFile.regexps.matchParameters.exec(self.content());
			if(!match) return [];
			return match[1].split(/\s*,\s*/);
		});
		var argumentsStore = [];
		self.command = function(){
			if (!self.runnable()) return false;
			var parameters = self.getFunctionParameters();
			var baseName = self.baseName();
			if(parameters){
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
				return baseName+"("+argumentsStore.join(", ")+")";
			}else{
				return 'source("'+self.filename()+'")';
			}
		};
		self.runnable = ko.computed(function(){
			return OctFile.regexps.filename.test(self.filename());
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
			if(confirm("You are about to PERMANENTLY DELETE "+self.filename())){
				if(OctMethods.editor.deleteit(self)){
					OctMethods.editor.close(self);
				}else{
					alert("Can't delete file. Did you disconnect from " +
					"Octave Online?");
				}
			}
		};
		self.savedContent = ko.observable(content);
		self.save = function(){
			if(OctMethods.editor.save(self)){
				self.savedContent(self.content());
			}else{
				alert("Can't save file. Did you disconnect from Octave Online?");
			}
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
		self.isModified = ko.computed(function(){
			return self.content() !== self.savedContent();
		});

		// toString method
		self.toString = function(){
			return "[File:"+self.filename()+" "+self.content()+"]";
		}
	}
	OctFile.sorter = function(a, b){
		return a.filename() === b.filename() ? 0 : (
			a.filename() < b.filename() ? -1 : 1
		);
	}
	OctFile.regexps = {};
	OctFile.regexps.isFunction = /^(?:\s*(?:[\%\#].*)?\n)*\s*function\s/;
	OctFile.regexps.matchParameters = /function[^\(]+\(\s*([^\)]*?)\s*\)/;
	OctFile.regexps.filename = /^(([\w_\-]+)\.m|\.octaverc)$/;

	// Expose interface
	return OctFile;

});