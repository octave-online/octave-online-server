define(["js/client", "js/ot-client", "ot", "js/polyfill"],
	function(OctMethods, OtClient, ot){
	var clients = [];

	function findDocWithId(docId){
		for (var i = clients.length - 1; i >= 0; i--) {
			if (clients[i].id === docId) {
				return clients[i];
			}
		}
		return null;
	}

	var clientListeners = {
		send: function(revision, operation){
			OctMethods.socket.emit("ot.change", {
				docId: this.id,
				rev: revision,
				op: operation
			});
		},
		cursor: function(cursor){
			OctMethods.socket.emit("ot.cursor", {
				docId: this.id,
				cursor: cursor
			});
		}
	};

	var socketListeners = {
		doc: function(obj){
			var otClient = findDocWithId(obj.docId);
			console.log("ot.doc", obj, otClient);
			if (!otClient) return;

			otClient.initWith(obj.rev, obj.content);
		},
		broadcast: function(obj){
			var otClient = findDocWithId(obj.docId);
			console.log("ot.broadcast", obj, otClient);
			if (!otClient) return;

			var op = ot.TextOperation.fromJSON(obj.ops);
			otClient.applyServer(op);
		},
		ack: function(obj){
			var otClient = findDocWithId(obj.docId);
			console.log("ot.ack", obj, otClient);
			if (!otClient) return;

			otClient.serverAck();
		},
		cursor: function(obj){
			var otClient = findDocWithId(obj.docId);
			console.log("ot.cursor", obj, otClient);
			if (!otClient) return;

			otClient.setOtherCursor(obj.cursor, "#F00", "Remote User");
		}
	};

	function create(docId) {
		var otClient = findDocWithId(docId);
		if (otClient) return otClient;

		otClient = new OtClient(docId);
		otClient.addEventListener("send", clientListeners.send.bind(otClient));
		otClient.addEventListener("cursor", clientListeners.cursor.bind(otClient));
		clients.push(otClient);
		return otClient;
	};

	return {
		create: create,
		listeners: socketListeners,
		_clients: clients
	};
});