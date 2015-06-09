/*
From https://github.com/firebase/firepad/blob/master/lib/ace-adapter.coffee

Copyright (c) 2015 Firebase, https://www.firebase.com/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

define(["ace/ace", "ot"], function(ace, ot){
	function bind(fn, me){
		return function(){
			return fn.apply(me, arguments);
		};
	}
	var slice = [].slice;

	function ACEAdapter(aceInstance) {
		this.onCursorActivity = bind(this.onCursorActivity, this);
		this.onFocus = bind(this.onFocus, this);
		this.onBlur = bind(this.onBlur, this);
		this.onChange = bind(this.onChange, this);
		var ref;
		this.ace = aceInstance;
		this.aceSession = this.ace.getSession();
		this.aceDoc = this.aceSession.getDocument();
		this.aceDoc.setNewLineMode('unix');
		this.grabDocumentState();
		this.ace.on('change', this.onChange);
		this.ace.on('blur', this.onBlur);
		this.ace.on('focus', this.onFocus);
		this.aceSession.selection.on('changeCursor', this.onCursorActivity);
		this.aceSession.selection.on('changeSelection', this.onCursorActivity);
		if (this.aceRange == null) {
			this.aceRange = ((ref = ace.require) != null ? ref : require)("ace/range").Range;
		}
	}

	ACEAdapter.prototype.ignoreChanges = false;

	ACEAdapter.prototype.grabDocumentState = function() {
		this.lastDocLines = this.aceDoc.getAllLines();
		return this.lastCursorRange = this.aceSession.selection.getRange();
	};

	ACEAdapter.prototype.detach = function() {
		this.ace.removeListener('change', this.onChange);
		this.ace.removeListener('blur', this.onBlur);
		this.ace.removeListener('focus', this.onCursorActivity);
		this.aceSession.selection.removeListener('changeCursor', this.onCursorActivity);
		this.callbacks = {};
	};

	ACEAdapter.prototype.onChange = function(change) {
		var pair;
		if (!this.ignoreChanges) {
			pair = this.operationFromACEChange(change);
			this.trigger.apply(this, ['change'].concat(slice.call(pair)));
			return this.grabDocumentState();
		}
	};

	ACEAdapter.prototype.onBlur = function() {
		if (this.ace.selection.isEmpty()) {
			return this.trigger('blur');
		}
	};

	ACEAdapter.prototype.onFocus = function() {
		return this.trigger('focus');
	};

	ACEAdapter.prototype.onCursorActivity = function() {
		return setTimeout(((function(_this) {
			return function() {
				return _this.trigger('cursorActivity');
			};
		})(this)), 0);
	};

	ACEAdapter.prototype.operationFromACEChange = function(change) {
		var action, delta, inverse, operation, ref, ref1, restLength, start, text;
		delta = change.data;
		if ((ref = delta.action) === "insertLines" || ref === "removeLines") {
			text = delta.lines.join("\n") + "\n";
			action = delta.action.replace("Lines", "");
		} else {
			text = delta.text.replace(this.aceDoc.getNewLineCharacter(), '\n');
			action = delta.action.replace("Text", "");
		}
		start = this.indexFromPos(delta.range.start);
		restLength = this.lastDocLines.join('\n').length - start;
		if (action === "remove") {
			restLength -= text.length;
		}
		operation = new ot.TextOperation().retain(start).insert(text).retain(restLength);
		inverse = new ot.TextOperation().retain(start)["delete"](text).retain(restLength);
		if (action === 'remove') {
			ref1 = [inverse, operation], operation = ref1[0], inverse = ref1[1];
		}
		return [operation, inverse];
	};

	ACEAdapter.prototype.applyOperationToACE = function(operation) {
		var from, index, j, len, op, range, ref, to;
		index = 0;
		ref = operation.ops;
		for (j = 0, len = ref.length; j < len; j++) {
			op = ref[j];
			if (ot.TextOperation.isRetain(op)) {
				index += op;
			} else if (ot.TextOperation.isInsert(op)) {
				this.aceDoc.insert(this.posFromIndex(index), op);
				index += op.length;
			} else if (ot.TextOperation.isDelete(op)) {
				from = this.posFromIndex(index);
				to = this.posFromIndex(index - op);
				range = this.aceRange.fromPoints(from, to);
				this.aceDoc.remove(range);
			}
		}
		return this.grabDocumentState();
	};

	ACEAdapter.prototype.posFromIndex = function(index) {
		var j, len, line, ref, row;
		ref = this.aceDoc.$lines;
		for (row = j = 0, len = ref.length; j < len; row = ++j) {
			line = ref[row];
			if (index <= line.length) {
				break;
			}
			index -= line.length + 1;
		}
		return {
			row: row,
			column: index
		};
	};

	ACEAdapter.prototype.indexFromPos = function(pos, lines) {
		var i, index, j, ref;
		if (lines == null) {
			lines = this.lastDocLines;
		}
		index = 0;
		for (i = j = 0, ref = pos.row; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
			index += this.lastDocLines[i].length + 1;
		}
		return index += pos.column;
	};

	ACEAdapter.prototype.getValue = function() {
		return this.aceDoc.getValue();
	};

	ACEAdapter.prototype.getCursor = function() {
		var e, e2, end, ref, ref1, start;
		try {
			start = this.indexFromPos(this.aceSession.selection.getRange().start, this.aceDoc.$lines);
			end = this.indexFromPos(this.aceSession.selection.getRange().end, this.aceDoc.$lines);
		} catch (_error) {
			e = _error;
			try {
				start = this.indexFromPos(this.lastCursorRange.start);
				end = this.indexFromPos(this.lastCursorRange.end);
			} catch (_error) {
				e2 = _error;
				console.log("Couldn't figure out the cursor range:", e2, "-- setting it to 0:0.");
				ref = [0, 0], start = ref[0], end = ref[1];
			}
		}
		if (start > end) {
			ref1 = [end, start], start = ref1[0], end = ref1[1];
		}
		return {
			position: start,
			selectionEnd: end
		};
	};

	ACEAdapter.prototype.setCursor = function(cursor) {
		var end, ref, start;
		start = this.posFromIndex(cursor.position);
		end = this.posFromIndex(cursor.selectionEnd);
		if (cursor.position > cursor.selectionEnd) {
			ref = [end, start], start = ref[0], end = ref[1];
		}
		return this.aceSession.selection.setSelectionRange(new this.aceRange(start.row, start.column, end.row, end.column));
	};

	ACEAdapter.prototype.setOtherCursor = function(cursor, color, clientId) {
		var clazz, css, cursorRange, end, justCursor, ref, self, start;
		if (this.otherCursors == null) {
			this.otherCursors = {};
		}
		cursorRange = this.otherCursors[clientId];
		if (cursorRange) {
			cursorRange.start.detach();
			cursorRange.end.detach();
			this.aceSession.removeMarker(cursorRange.id);
		}
		start = this.posFromIndex(cursor.position);
		end = this.posFromIndex(cursor.selectionEnd);
		if (cursor.selectionEnd < cursor.position) {
			ref = [end, start], start = ref[0], end = ref[1];
		}
		clazz = "other-client-selection-" + (color.replace('#', ''));
		justCursor = cursor.position === cursor.selectionEnd;
		if (justCursor) {
			clazz = clazz.replace('selection', 'cursor');
		}
		css = "." + clazz + " {\n  position: absolute;\n  background-color: " + (justCursor ? 'transparent' : color) + ";\n  border-left: 2px solid " + color + ";\n}";
		this.addStyleRule(css);
		this.otherCursors[clientId] = cursorRange = new this.aceRange(start.row, start.column, end.row, end.column);
		self = this;
		cursorRange.clipRows = function() {
			var range;
			range = self.aceRange.prototype.clipRows.apply(this, arguments);
			range.isEmpty = function() {
				return false;
			};
			return range;
		};
		cursorRange.start = this.aceDoc.createAnchor(cursorRange.start);
		cursorRange.end = this.aceDoc.createAnchor(cursorRange.end);
		cursorRange.id = this.aceSession.addMarker(cursorRange, clazz, "text");
		return {
			clear: (function(_this) {
				return function() {
					cursorRange.start.detach();
					cursorRange.end.detach();
					return _this.aceSession.removeMarker(cursorRange.id);
				};
			})(this)
		};
	};

	ACEAdapter.prototype.addStyleRule = function(css) {
		var styleElement;
		if (typeof document === "undefined" || document === null) {
			return;
		}
		if (!this.addedStyleRules) {
			this.addedStyleRules = {};
			styleElement = document.createElement('style');
			document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
			this.addedStyleSheet = styleElement.sheet;
		}
		if (this.addedStyleRules[css]) {
			return;
		}
		this.addedStyleRules[css] = true;
		return this.addedStyleSheet.insertRule(css, 0);
	};

	ACEAdapter.prototype.addEventListener = function(event, cb) {
		if(!this.callbacks) this.callbacks = {};
		if(!this.callbacks[event]) this.callbacks[event] = [];
		this.callbacks[event].push(cb);
	};

	ACEAdapter.prototype.trigger = function(event) {
		var args = (2 <= arguments.length) ? slice.call(arguments, 1) : [];
		if(this.callbacks && this.callbacks[event]){
			for (var i = this.callbacks[event].length - 1; i >= 0; i--) {
				this.callbacks[event][i].apply(this, args);
			}
			return true;
		} else return false;
	};

	ACEAdapter.prototype.applyOperation = function(operation) {
		if (!operation.isNoop()) {
			this.ignoreChanges = true;
		}
		this.applyOperationToACE(operation);
		return this.ignoreChanges = false;
	};

	ACEAdapter.prototype.registerUndo = function(undoFn) {
		return this.ace.undo = undoFn;
	};

	ACEAdapter.prototype.registerRedo = function(redoFn) {
		return this.ace.redo = redoFn;
	};

	ACEAdapter.prototype.invertOperation = function(operation) {
		return operation.invert(this.getValue());
	};

	return ACEAdapter;

});