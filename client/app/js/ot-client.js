define(["js/ace-adapter", "ot", "js/polyfill"], function(Adapter, ot){
	function OTClient(){
		this.client = new ot.Client(0);

		this.client.sendOperation = this._sendOperation.bind(this);
		this.client.applyOperation = this._applyOperation.bind(this);
	}

	OTClient.prototype.attachEditor = function(editor){
		if(this.editor){
			this.adapter.detach(); // removes event listeners
			this.adapter = null;
			this.editor = null;
		}

		this.editor = editor;
		this.adapter = new Adapter(this.editor);
		this.adapter.addEventListener("change", function(operation, inverse){
			console.log("change", arguments);
			client.applyClient(operation);
		}, false);
		this.adapter.addEventListener("cursorActivity", function(){
			console.log("cursorActivity", arguments);
		}, false);
		this.adapter.addEventListener("focus", function(){
			console.log("focus", arguments);
		}, false);
		this.adapter.addEventListener("blur", function(){
			console.log("blur", arguments);
		}, false);
	}

	OTClient.prototype.applyServer = function(operation){
		this.client.applyServer(operation);
	}

	OTClient.prototype._sendOperation = function(operation){
		this.dispatchEvent("change", this.client.revision, operation);
	}

	OTClient.prototype._applyOperation = function(operation){
		if(!this.adapter)
			throw new Error("Attempted to apply operation, but Ace is not attached");

		console.log("apply", operation);
		this.adapter.applyOperation(operation);
	}

	// Begin EventTarget Implementation
	OTClient.prototype.addEventListener = function(event, cb){
		if(!this.callbacks) this.callbacks = {};
		if(!this.callbacks[event]) this.callbacks[event] = [];
		this.callbacks[event].push(cb);
	};
	OTClient.prototype.removeEventListener = function(event, cb){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i>this.callbacks[event].length; i++) {
			if(this.callbacks[event][i] === cb){
				this.callbacks.splice(i, 1);
				return;
			}
		}
	};
	OTClient.prototype.dispatchEvent = function(event){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i>this.callbacks[event].length; i++) {
			this.callbacks[event][i].apply(this,
				Array.prototype.slice.apply(arguments, 1));
		}
	};
	// End EventTarget Implementation

	return OTClient;
});