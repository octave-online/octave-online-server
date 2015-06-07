define(["js/ace-adapter", "ot", "js/polyfill"], function(Adapter, ot){
	function OTClientWrapper(){
		this.otClient = new ot.Client(0);

		this.otClient.sendOperation = this._sendOperation.bind(this);
		this.otClient.applyOperation = this._applyOperation.bind(this);
	}

	OTClientWrapper.prototype.attachEditor = function(editor){
		if(this.editor){
			this.adapter.detach(); // removes event listeners
			this.adapter = null;
			this.editor = null;
		}

		this.editor = editor;
		this.adapter = new Adapter(this.editor);
		this.adapter.addEventListener("change", this._onChange.bind(this), false);
		this.adapter.addEventListener("cursorActivity", this._onCursor.bind(this), false);
		this.adapter.addEventListener("focus", this._onFocusBlur.bind(this), false);
		this.adapter.addEventListener("blur", this._onFocusBlur.bind(this), false);
	}

	OTClientWrapper.prototype.applyServer = function(operation){
		this.otClient.applyServer(operation);
	}

	OTClientWrapper.prototype._onChange = function(operation, inverse){
		console.log("change", arguments);
		this.otClient.applyClient(operation);
	}

	OTClientWrapper.prototype._onCursor = function(){
		console.log("cursorActivity", arguments);
	}

	OTClientWrapper.prototype._onFocusBlur = function(){
		console.log("focus/blur", arguments);
	}

	OTClientWrapper.prototype._sendOperation = function(operation){
		console.log("send operation", operation)
		this.dispatchEvent("change", this.otClient.revision, operation);
	}

	OTClientWrapper.prototype._applyOperation = function(operation){
		if(!this.adapter)
			throw new Error("Attempted to apply operation, but Ace is not attached");

		console.log("apply", operation);
		this.adapter.applyOperation(operation);
	}

	// Begin EventTarget Implementation
	OTClientWrapper.prototype.addEventListener = function(event, cb){
		if(!this.callbacks) this.callbacks = {};
		if(!this.callbacks[event]) this.callbacks[event] = [];
		this.callbacks[event].push(cb);
	};
	OTClientWrapper.prototype.removeEventListener = function(event, cb){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i>this.callbacks[event].length; i++) {
			if(this.callbacks[event][i] === cb){
				this.callbacks.splice(i, 1);
				return;
			}
		}
	};
	OTClientWrapper.prototype.dispatchEvent = function(event){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i>this.callbacks[event].length; i++) {
			this.callbacks[event][i].apply(this,
				Array.prototype.slice.apply(arguments, 1));
		}
	};
	// End EventTarget Implementation

	return OTClientWrapper;
});