define(["js/client", "js/ot-handler", "js/polyfill"],
	function(OctMethods, OtHandler){

	var documentClients = {};

	var socketListeners = {
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
			console.log("Prompt ID:", promptId);
			if (!promptId) return;

			var otClient = OtHandler.create(promptId);
			otClient.attachEditor(OctMethods.prompt.instance);
		},
		doc: function(obj){
			console.log("Adding doc:", obj);
			if (!obj) return;

			var octFile = OctMethods.ko.viewModel.getOctFileFromName(obj.filename);
			var otClient = OtHandler.create(obj.docId, octFile.content);
			documentClients[obj.filename] = otClient;
		},
		renamed: function(obj){
			var oldname = obj.oldname, newname = obj.newname;
			var oldDocId = obj.oldDocId, newDocId = obj.newDocId;

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