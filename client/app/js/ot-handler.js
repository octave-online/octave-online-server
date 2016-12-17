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
			setTimeout(function(){
				OctMethods.socket.emit("ot.change", {
					docId: this.id,
					rev: revision,
					op: operation
				});
			}.bind(this), 150);
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
			if (!otClient) return;

			otClient.initWith(obj.rev, obj.content);
		},
		broadcast: function(obj){
			var otClient = findDocWithId(obj.docId);
			if (!otClient) return;

			var op = ot.TextOperation.fromJSON(obj.ops);
			otClient.applyServer(op);
		},
		ack: function(obj){
			var otClient = findDocWithId(obj.docId);
			if (!otClient) return;

			otClient.serverAck();
		},
		cursor: function(obj){
			var otClient = findDocWithId(obj.docId);
			if (!otClient) return;

			otClient.setOtherCursor(obj.cursor, "#F00", "Remote User");
		}
	};

	function create(docId, observable) {
		var otClient = findDocWithId(docId);
		if (otClient) return otClient;

		otClient = new OtClient(docId, observable);
		otClient.addEventListener("send", clientListeners.send.bind(otClient));
		otClient.addEventListener("cursor", clientListeners.cursor.bind(otClient));
		clients.push(otClient);
		return otClient;
	};

	function destroy(docId) {
		for (var i = clients.length - 1; i >= 0; i--) {
			if (clients[i].id === docId) {
				clients.splice(i, 1);
				return;
			}
		}
	};

	return {
		create: create,
		destroy: destroy,
		listeners: socketListeners,
		_clients: clients
	};
});
