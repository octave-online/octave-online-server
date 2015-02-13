define(["knockout", "require"], function(ko, require){

	// MVVM class for workspace variables
	function Var(){
		// the "self" variable enables us to refer to the OctFile context even when
		// we are programming within callback function contexts
		var self = this;

		// Main Bindings
		self.scope = ko.observable();
		self.symbol = ko.observable();
		self.class_name = ko.observable();
		self.dimension = ko.observable();
		self.value = ko.observable();
		self.complex_flag = ko.observable();

		// Take values from object
		self.take = function(values){
			ko.utils.objectForEach(values, function(key, value){
				self[key](value);
			});
		};

		// Type string
		self.typeString = ko.computed(function(){
			var isScalar = (self.dimension() === "1x1");
			var isComplex = (self.complex_flag());
			var isChar = (self.class_name() === "char");
			var isCell = (self.class_name() === "cell");
			var isFn = (self.class_name() === "function_handle");
			var isNumeric = (self.class_name() === "double");
			var isSym = (self.class_name() === "sym");
			
			if ( isChar                ) return "(abc)";
			if ( isSym                 ) return "$";
			if ( isCell   &&  isComplex) return "{"+self.dimension()+"}*";
			if ( isCell   && !isComplex) return "{"+self.dimension()+"}";
			if ( isFn     &&  isComplex) return "@*";
			if ( isFn     && !isComplex) return "@";
			if (!isNumeric             ) return "?";
			if ( isScalar &&  isComplex) return "#*";
			if ( isScalar && !isComplex) return "#";
			if (              isComplex) return "["+self.dimension()+"]*";
			if (             !isComplex) return "["+self.dimension()+"]";
		});

		// Type explanation
		self.typeExplanation = ko.computed(function(){
			var isScalar = (self.dimension() === "1x1");
			var isComplex = (self.complex_flag());
			var isChar = (self.class_name() === "char");
			var isCell = (self.class_name() === "cell");
			var isFn = (self.class_name() === "function_handle");
			var isNumeric = (self.class_name() === "double");
			var isSym = (self.class_name() === "sym");
			
			if ( isChar                ) return "characters";
			if ( isSym                 ) return "symbolic";
			if ( isCell   &&  isComplex) return "complex cell array";
			if ( isCell   && !isComplex) return "cell array";
			if ( isFn     &&  isComplex) return "complex function handle";
			if ( isFn     && !isComplex) return "function handle";
			if (!isNumeric             ) return "unknown data type";
			if ( isScalar &&  isComplex) return "complex scalar";
			if ( isScalar && !isComplex) return "scalar";
			if (              isComplex) return "complex matrix";
			if (             !isComplex) return "matrix";
		});

		// Click Method
		self.showDetails = function(){
			alert(self.symbol()+" = "+self.value());
		};

		// Listen on value change
		self.value.subscribe(function(){})

		// toString method
		self.toString = function(){
			return "[Var:"+self.symbol()+" "+self.value()+"]";
		}
	}
	Var.sorter = function(a, b){
		return a.symbol() === b.symbol() ? 0 : (
			a.symbol() < b.symbol() ? -1 : 1
		);
	}

	// Expose interface
	return Var;

});