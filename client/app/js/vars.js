/*
 * Copyright © 2018, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

define(["knockout", "require"], function(ko, require){

	// MVVM class for variables
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
			var isLogicl = (self.class_name() === "logical");
			var isNumeric = (self.class_name() === "double");
			var isStruct = (self.class_name() === "struct");
			var isSym = (self.class_name() === "sym");
			var isTF = (self.class_name() === "tf");
			var isImg = (self.class_name() === "uint8");

			if ( isChar                ) return "(abc)";
			if ( isSym                 ) return "$";
			if ( isTF                  ) return "ℒ";
			if ( isStruct              ) return "⊡";
			if ( isLogicl &&  isScalar ) return "¬";
			if ( isLogicl              ) return "["+self.dimension()+"]¬";
			if ( isImg    &&  isComplex) return "❬"+self.dimension()+"❭*";
			if ( isImg    && !isComplex) return "❬"+self.dimension()+"❭";
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
			var isLogicl = (self.class_name() === "logical");
			var isNumeric = (self.class_name() === "double");
			var isStruct = (self.class_name() === "struct");
			var isSym = (self.class_name() === "sym");
			var isTF = (self.class_name() === "tf");
			var isImg = (self.class_name() === "uint8");
			
			if ( isChar                ) return "characters";
			if ( isSym                 ) return "symbolic";
			if ( isTF                  ) return "transfer function";
			if ( isStruct              ) return "struct";
			if ( isLogicl              ) return "logical (boolean)";
			if ( isImg                 ) return "uint8 data (images)";
			if ( isCell   &&  isComplex) return "complex cell array";
			if ( isCell   && !isComplex) return "cell array";
			if ( isFn     &&  isComplex) return "complex function handle";
			if ( isFn     && !isComplex) return "function handle";
			if (!isNumeric             ) return self.class_name();
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