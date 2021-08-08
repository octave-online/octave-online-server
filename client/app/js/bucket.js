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

define(["knockout", "require", "js/octfile", "js/utils"], function(ko, require, OctFile, utils){

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
		self.butype = ko.observable("readonly");
		self.base_bucket_id = ko.observable(null);
		self.baseModel = ko.observable(null);
		self.shortlink = ko.observable(null);
		self.url = ko.computed(function() {
			var prefix = (self.butype() === "readonly") ? "bucket" : "project";
			return window.location.origin + "/" + prefix + "~" + self.id();
		});
		self.shortUrl = ko.computed(function() {
			return "https://octav.onl/" + self.shortlink();
		});
		self.displayName = ko.computed(function() {
			return "octav.onl/" + self.shortlink();
		});
		self.createdTimeString = ko.computed(function() {
			return self.createdTime().toLocaleString();
		});
		self.isOwnedByCurrentUser = ko.computed(function() {
			return !!ko.utils.arrayFirst(OctMethods.ko.viewModel.allBuckets(), function(bucket) {
				return bucket.id() === self.id();
			}, null);
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
		};
		self.moveRightToLeft = function() {
			self.files.removeAll(self.selectedRight());
			self.selectedRight.removeAll();
		};

		self.textFiles = ko.pureComputed(function() {
			return ko.utils.arrayFilter(self.files(), function(octfile) {
				return octfile.editable;
			});
		});

		self.setAutoShortlink = function() {
			var shortlink = "";
			// 5 lowercase letters
			for (var i = 0; i < 5; i++) {
				shortlink += String.fromCharCode(97 + Math.floor(Math.random() * 26));
			}
			// 3 numbers
			for (var i = 0; i < 3; i++) {
				shortlink += Math.floor(Math.random() * 10);
			}
			self.shortlink(shortlink);
		};
		self.editShortlink = function() {
			var result = window.prompt("Enter a new short link:\n\nhttps://octav.onl/…", self.shortlink());
			if (result) {
				OctMethods.socket.changeBucketShortlink(self, result);
			}
		}

		self.createOnServer = function() {
			OctMethods.socket.createBucket(self);
			self.showCreateButton(false);
		};
		self.deleteit = function() {
			if (confirm("Are you sure you want to delete this bucket?\n\n" + self.displayName())) {
				OctMethods.socket.deleteBucket(self);
			}
		};
	}

	Bucket.fromBucketInfo = function(info) {
		var bucket = new Bucket();
		bucket.id(info.bucket_id);
		bucket.mainFilename(info.main);
		bucket.createdTime(new Date(info.createdTime));
		bucket.butype(info.butype);
		bucket.base_bucket_id(info.base_bucket_id);
		bucket.shortlink(info.shortlink);
		if (info.baseModel) {
			bucket.baseModel(Bucket.fromBucketInfo(info.baseModel));
		}
		return bucket;
	};

	// Expose interface
	return Bucket;

});
