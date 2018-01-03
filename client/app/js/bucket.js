define(["knockout", "require", "js/octfile", "js/utils"],
	function(ko, require, OctFile, utils){

	var OctMethods = require("js/client");

	// Bucket MVVM class
	function Bucket(){
		// the "self" variable enables us to refer to the Bucket context even when
		// we are programming within callback function contexts
		var self = this;

		// Main Bindings
		self.files = ko.observableArray();
		self.main = ko.observable(null);
		self.id = ko.observable(null);
		self.createdTime = ko.observable(new Date());
		self.mainFilename = ko.pureComputed({
			read: function() {
				return self.main() ? self.main().filename() : null;
			},
			write: function(filename) {
				if (filename) {
					self.main(new OctFile(filename, "", false));
				} else {
					self.main(null);
				}
			}
		});
		self.url = ko.computed(function() {
			return window.location.origin + "/bucket~" + self.id();
		});
		self.displayName = ko.computed(function() {
			return self.mainFilename() ? self.mainFilename() : self.id() ? self.id() : "headless bucket";
		});
		self.createdTimeString = ko.computed(function() {
			return self.createdTime().toLocaleString();
		});

		// Bindings used during bucket creation
		self.selectedLeft = ko.observableArray();
		self.selectedRight = ko.observableArray();
		self.showCreateButton = ko.observable(true);

		self.filesNotIncluded = ko.pureComputed(function() {
			return utils.sortedFilter(OctMethods.ko.allOctFiles(), self.files(), function(octfile) {
				return octfile.filename();
			});
		});
		self.moveLeftToRight = function() {
			self.files.push.apply(self.files, self.selectedLeft());
			self.selectedLeft.removeAll();
			self.files.sort(OctFile.sorter);
		}
		self.moveRightToLeft = function() {
			self.files.removeAll(self.selectedRight());
			self.selectedRight.removeAll();
		}

		self.textFiles = ko.pureComputed(function() {
			return ko.utils.arrayFilter(self.files(), function(octfile) {
				return octfile.editable;
			});
		});

		self.createOnServer = function() {
			OctMethods.socket.createBucket(self);
			self.showCreateButton(false);
		}
		self.deleteit = function() {
			if (confirm("Are you sure you want to delete this bucket?\n\n" + self.displayName())) {
				OctMethods.socket.deleteBucket(self);
			}
		}
	}

	Bucket.fromBucketInfo = function(info) {
		var bucket = new Bucket();
		bucket.id(info.bucket_id);
		bucket.mainFilename(info.main);
		bucket.createdTime(new Date(info.createdTime));
		return bucket;
	}

	// Expose interface
	return Bucket;

});
