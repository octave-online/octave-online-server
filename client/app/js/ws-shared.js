define(["js/client", "js/ot-handler", "js/polyfill"],
	function(OctMethods, OtHandler){

	var documentClients = {};

	var socketListeners = {
		command: function(cmd){
			OctMethods.console.command(cmd, true);
			OctMethods.prompt.clear();
		},
		save: function(data){
			var octFile = OctMethods.ko.viewModel.getOctFileFromName(data.filename);
			if (!octFile)
				OctMethods.editor.add(data.filename, data.content);
			else
				octFile.savedContent(data.content);
		},
		fileadd: function(data){
			OctMethods.editor.add(data.filename, Base64.decode(data.content));
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

			var otClient = OtHandler.create(obj.docId);
			documentClients[obj.filename] = otClient;
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