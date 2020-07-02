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

define(["js/client", "js/ot-handler", "js/polyfill"], function(OctMethods, OtHandler){

	var documentClients = {};

	var socketListeners = {
		subscribe: function(socket) {
			socket.on("ws.command", socketListeners.command);
			socket.on("ws.save", socketListeners.save);
			socket.on("ws.promptid", socketListeners.promptid);
			socket.on("ws.doc", socketListeners.doc);
			socket.on("ws.rename", socketListeners.renamed);
			socket.on("ws.delete", socketListeners.deleted);
		},
		command: function(cmd){
			OctMethods.console.command(cmd, true);
		},
		save: function(data){
			var octFile = OctMethods.ko.viewModel.getOctFileFromName(data.filename);
			if (!octFile)
				OctMethods.editor.add(data.filename, data.content);
			else
				octFile.savedContent(data.content);
		},
		promptid: function(promptId){
			if (!promptId) return;
			console.log("OT PROMPT:", promptId);

			var otClient = OtHandler.create(promptId);
			otClient.attachEditor(OctMethods.prompt.instance);
		},
		doc: function(obj){
			if (!obj) return;
			console.log("OT SCRIPT:", obj.docId, obj.filename);

			var octFile = OctMethods.ko.viewModel.getOctFileFromName(obj.filename);
			if (!octFile) {
				// TODO: What to do in this case?
				console.log("Could not find OctFile:", obj.filename);
				return;
			}
			var otClient = OtHandler.create(obj.docId, octFile.content);
			documentClients[obj.filename] = otClient;
		},
		renamed: function(obj){
			var oldname = obj.oldname;
			var newname = obj.newname;
			var newDocId = obj.newDocId;

			if (!documentClients[oldname]) return;
			if (documentClients[newname]) return;

			var otClient = documentClients[oldname];
			delete documentClients[oldname];
			documentClients[newname] = otClient;

			otClient.changeDocId(newDocId);
		},
		deleted: function(obj){
			var filename = obj.filename, docId = obj.docId;
			if (!documentClients[filename]) return;

			var otClient = documentClients[filename];
			delete documentClients[filename];
			otClient.destroy();

			OtHandler.destroy(docId);
		}
	};

	function clientForFilename(filename) {
		return documentClients[filename];
	}

	function forEachDocClient(cb){
		for (var filename in documentClients) {
			if (!documentClients.hasOwnProperty(filename)) continue;
			cb(filename, documentClients[filename]);
		}
	}

	return {
		listeners: socketListeners,
		clientForFilename: clientForFilename,
		forEachDocClient: forEachDocClient
	};
});