define(["js/client", "js/ot-handler", "js/polyfill"],
	function(OctMethods, OtHandler){

	var documentClients = {};

	var socketListeners = {
		command: function(cmd){
			OctMethods.console.command(cmd, true);
			OctMethods.prompt.clear();
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

	return {
		listeners: socketListeners,
		clientForFilename: clientForFilename
	};
});