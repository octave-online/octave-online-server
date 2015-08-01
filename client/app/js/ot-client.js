define(["js/ace-adapter", "ot", "js/polyfill"],
	function(AceAdapter, ot){
	function OTClientWrapper(docId, observable){
		this.id = docId;
		this.observable = observable || null;
		this.attachEditor(null);
	}

	function ObservableAdapter(observable){
		this.applyOperation = function(operation){
			var content = observable();
			content = operation.apply(content);
			observable(content);
		};
		this.getValue = function(){
			return observable();
		};

		// TODO: Use these other methods to remember where people's cursors are,
		// so they can be set as soon as the document is actually opened in ACE.
		this.getCursor = function(){}
		this.setOtherCursor = function(){}
		this.detach = function(){}
	}

	OTClientWrapper.prototype.applyContent = function(){
		if (!this.content || !this.adapter) return;
		var currentContent = this.adapter.getValue();
		if (currentContent === this.content) return;

		var op = new ot.TextOperation();
		op["delete"](currentContent.length);
		op.insert(this.content);
		this.adapter.applyOperation(op);
	}

	OTClientWrapper.prototype.initWith = function(rev, content){
		this.otClient = new ot.Client(rev);
		this.otClient.sendOperation = this._sendOperation.bind(this);
		this.otClient.applyOperation = this._applyOperation.bind(this);

		this.content = content;
		this.applyContent();
	}

	OTClientWrapper.prototype.attachEditor = function(editor){
		if (this.adapter) {
			this.adapter.detach(); // removes event listeners
			delete this.adapter;
			this.cursor = {};
		}

		if (editor) {
			// Attach to the ACE Editor Adapter.
			// 
			// Note that the ACE Editor is itself bound to the observable via
			// ko-ace.js, so we don't need to attach to the observable from here.
			this.adapter = new AceAdapter(editor);
			this.adapter.addEventListener("change", this._onChange.bind(this), false);
			this.adapter.addEventListener("cursorActivity", this._onCursor.bind(this), false);
			this.adapter.addEventListener("focus", this._onFocusBlur.bind(this), false);
			this.adapter.addEventListener("blur", this._onFocusBlur.bind(this), false);
			this.cursor = this.adapter.getCursor();

		} else if (this.observable) {
			// Attach to the Knockout observable directly, enabling edit and save
			// actions to propogate even when the file is not open in the editor.
			// 
			// TODO: Make this two-way communication by adding event listeners here.
			this.adapter = new ObservableAdapter(this.observable);
		}

		this.applyContent();
	}

	OTClientWrapper.prototype.changeDocId = function(newDocId){
		this.id = newDocId;
	}

	OTClientWrapper.prototype.destroy = function(){
		this.attachEditor(null);
		delete this.adapter;
		delete this.observable;
		this.callbacks = {};
	}

	// SERVER -> OT
	OTClientWrapper.prototype.applyServer = function(operation){
		if (this.otClient) this.otClient.applyServer(operation);
	}
	OTClientWrapper.prototype.serverAck = function(){
		this.otClient.serverAck();
	}

	// ACE -> OT
	OTClientWrapper.prototype._onChange = function(operation, inverse){
		this.otClient.applyClient(operation);
		this.content = operation.apply(this.content);
	}

	// OT -> SERVER
	OTClientWrapper.prototype._sendOperation = function(revision, operation){
		console.log("send operation", operation)
		this.dispatchEvent("send", revision, operation);
	}

	// OT -> ACE
	OTClientWrapper.prototype._applyOperation = function(operation){
		console.log("apply", operation);
		if (this.adapter) this.adapter.applyOperation(operation);
		this.content = operation.apply(this.content);
	}

	// CURSORS
	OTClientWrapper.prototype._onCursor = function(){
		var cursor = this.adapter.getCursor();
		if(this.cursor.position !== cursor.position
			|| this.cursor.selectionEnd !== cursor.selectionEnd){
			this.cursor = cursor;
			this.dispatchEvent("cursor", cursor);
		}
	}
	OTClientWrapper.prototype._onFocusBlur = function(){
		console.log("focus/blur", arguments);
	}
	OTClientWrapper.prototype.setOtherCursor = function(){
		if (!this.adapter) return;
		this.adapter.setOtherCursor.apply(this.adapter, arguments);
	}

	// Begin EventTarget Implementation
	OTClientWrapper.prototype.addEventListener = function(event, cb){
		if(!this.callbacks) this.callbacks = {};
		if(!this.callbacks[event]) this.callbacks[event] = [];
		this.callbacks[event].push(cb);
	};
	OTClientWrapper.prototype.removeEventListener = function(event, cb){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i<this.callbacks[event].length; i++) {
			if(this.callbacks[event][i] === cb){
				this.callbacks.splice(i, 1);
				return;
			}
		}
	};
	OTClientWrapper.prototype.dispatchEvent = function(event){
		if(!this.callbacks || !this.callbacks[event]) return;
		for (var i=0; i<this.callbacks[event].length; i++) {
			this.callbacks[event][i].apply(this,
				Array.prototype.slice.call(arguments, 1));
		}
	};
	// End EventTarget Implementation

	// TextOperation polyfill

	return OTClientWrapper;
});