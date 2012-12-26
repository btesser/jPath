//jpath.js - is a library that allows filtering of JSON data based on pattern-like expression
(function(Array, undef) {
	var
	TRUE = !0,
		FALSE = !1,
		STRING = "string",
		FUNCTION = "function",
		PERIOD = ".",
		EMPTY = '',
		FLAGS = 'g',
		NULL = null,

		rxTokens = /([A-Za-z0-9_\*@\$\(\)]+(?:\[.+?\])?)/g,
		rxIndex = /^(\S+)\((\d+)\)$/,
		rxPairs = /(\(+)?([\w\.\(\)\$\_]+)(?:\s*)([\=\^\!\*\~\>\<\?\$]{1,2})\s*(?:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^' \&\|\)\(]+)\s*(\)+)?/g,
		rxCondition = /(\S+)\[(.+)\]/,
		rxTrim = /\S+(?:\s+\S+)*/,
		rxEscQuote = /\\('|")/g,

		app = Array.prototype.push,
		apc = Array.prototype.concat,

		hidden = {
			trim: function(s) {
				var str = s.match(rxTrim);
				return str ? str[0] : EMPTY;
			},
			qtrim: function(s) {
				return((!s.indexOf("'") || !s.indexOf('"')) && (s.slice(-1) === "'" || s.slice(-1) === '"')) ? s.slice(1, -1) : s;
			},
			toArray: function(o) {
				return o instanceof Array ? o : (o === undef || o === NULL) ? [] : [o];
			},
			traverse: function(pattern, cfn, obj) {
				var out, data = (obj || this.data),
					temp, tokens, token, idxToken, index, expToken, condition, tail, self = arguments.callee,
					found, i, j, l;
				if(data && typeof(pattern) === STRING) {
					tokens = pattern.match(rxTokens); //dot notation splitter
					//Get first token
					token = tokens[0];
					//Trailing tokens
					tail = tokens.slice(1).join(PERIOD);

					if(data instanceof Array) {
						temp = [];
						for(i = 0, j;
						(j = data[i]) != NULL; i++) {
							found = self.call(this, token, cfn, j);
							if(((found instanceof Array) && found.length) || found !== undef) {
								app.call(temp, found);
							}
						}
						if(temp.length) {
							return tail ? self.call(this, tail, cfn, temp) : temp;
						} else {
							return;
						}
					} else if(token === "*") {
						return tail ? self.call(this, tail, cfn, data) : data;
					} else if(data[token] !== undef) {
						return tail ? self.call(this, tail, cfn, data[token]) : data[token];
					} else if(rxIndex.test(token)) {
						idxToken = token.match(rxIndex);
						token = idxToken[1];
						index = +idxToken[2];
						temp = data[token];
						return tail ? self.call(this, tail, cfn, (temp && temp.length) ? temp[index] : temp) : (temp && temp.length) ? temp[index] : temp;
					} else if(rxCondition.test(token)) {
						expToken = token.match(rxCondition);
						token = expToken[1];
						condition = expToken[2];

						var evalStr, isMatch, subset = token === "*" ? data : data[token],
							elem;

						if(subset instanceof Array) {
							temp = [];
							//Second loop here is faster than recursive call
							for(i = 0;
							(elem = subset[i]) != NULL; i++) {
								//Convert condition pairs to booleans
								evalStr = condition.replace(rxPairs, function(match, pl, left, operator, right, pr) {
									return [pl, hidden.testPairs.call(elem, left, right, operator, cfn), pr].join(EMPTY);
								});
								//Evaluate expression
								isMatch = eval(evalStr);
								if(isMatch) {
									app.call(temp, elem);
								}
							}
							if(temp.length) {
								return tail ? self.call(this, tail, cfn, temp) : temp;
							} else {
								return;
							}
						} else {
							elem = subset;
							//Convert condition pairs to booleans
							evalStr = condition.replace(rxPairs, function(match, pl, left, operator, right, pr) {
								return [pl, hidden.testPairs.call(elem, left, right, operator, cfn), pr].join(EMPTY);
							});
							//Evaluate expression
							isMatch = eval(evalStr);
							if(isMatch) {
								return tail ? self.call(this, tail, cfn, elem) : elem;
							}
						}
					}
				}
				return out;
			},
			//Matches type of a to b
			matchTypes: function(a, b) {
				var _a, _b;
				switch(typeof(a)) {
				case "string":
					_b = b + EMPTY;
					break;
				case "boolean":
					_b = b === "true" ? TRUE : FALSE;
					break;
				case "number":
					_b = +b;
					break;
				case "date":
					_b = new Date(b).valueOf();
					_a = a.valueOf();
					break;
				default:
					_b = b;
				}
				if(b === "null") {
					_b = null;
				}
				if(b === "undefined") {
					_b = undef;
				}
				return {
					left: (_a || a),
					right: _b
				};
			},
			testPairs: (function() {
				var conditions = {
					"=": function(l, r) {
						return l === r;
					},
					"==": function(l, r) {
						return l === r;
					},
					"!=": function(l, r) {
						return l !== r;
					},
					"<": function(l, r) {
						return l < r;
					},
					"<=": function(l, r) {
						return l <= r;
					},
					">": function(l, r) {
						return l > r;
					},
					">=": function(l, r) {
						return l >= r;
					},
					"~=": function(l, r) {
						return(l + EMPTY).toLowerCase() === (r + EMPTY).toLowerCase();
					},
					"^=": function(l, r) {
						return !((l + EMPTY).indexOf(r));
					},
					"$=": function(l, r) {
						return(r + EMPTY) === (l + EMPTY).slice(-(r + EMPTY).length);
					},
					"*=": function(l, r) {
						return(l + EMPTY).toLowerCase().indexOf((r + EMPTY).toLowerCase()) !== -1;
					}
				};

				return function(left, right, operator, fn) {
					var out = FALSE,
						leftVal = left.indexOf(PERIOD) >= 0 ? hidden.traverse(left, null, this) : this[left],
						//We clean up r to remove wrapping quotes and escaped quotes (both single/dbl)
						pairs = hidden.matchTypes(leftVal, hidden.trim(hidden.qtrim(right)).replace(rxEscQuote,'$1'));
					if(operator === "?") {
						if(typeof(fn) === FUNCTION) {
							out = fn.call(this, pairs.left, right);
						}
					} else {
						out = conditions[operator](pairs.left, pairs.right);
					}
					return out;
				};
			})(),
			merge: function(pattern) {
				var out = [],
					temp = hidden.toArray(pattern ? hidden.traverse.apply(this, arguments) : this.selection);
				out = apc.apply([], temp);
				return out;
			}
		},

		module = {};


	function JPath(obj) {
		if(!(this instanceof JPath)) {
			return new JPath(obj);
		}
		this.data = obj || NULL;
		this.selection = [];
	}

	JPath.prototype = {
		//Sets JSON object source on the fly
		from: function(obj) {
			this.data = obj;
			return this;
		},
		//Returns the first element value of the search
		first: function() {
			return this.selection.length ? this.selection[0] : NULL;
		},
		//Returns the last element value of the search
		last: function() {
			return this.selection.length ? this.selection.slice(-1)[0] : NULL;
		},
		//Returns an exact element value specified by index position
		eq: function(idx) {
			return this.selection.length ? this.selection[idx] : NULL;
		},
		//Performs a search on the JSON object
		select: function(pattern, cfn, obj) {
			this.selection = hidden.merge.apply(this, arguments);
			return this;
		},
		//Appends result of additional search to original search results
		and: function(pattern) {
			this.selection = this.selection.concat(hidden.merge.apply(this, arguments));
			return this;
		},
		//Returns search results as an Array
		val: function() {
			return this.selection;
		}
	};

	//Returns an insance if JPath object
	//@obj - JSON object
	//@pattern - <String> search pattern
	//@cfn - <Function> custom compare function. This function has two input arguments: @left, @right
	module.select = function(obj, pattern, cfn) {
		return JPath(obj).select(pattern, NULL, cfn);
	};

	//Returns a result of the selection <Array>
	//WARNING: This function returns references to the values contained in JSON object, so if you modify them they will affect your JSON object.
	//@obj - JSON object
	//@pattern - <String> search pattern
	//@cfn - <Function> custom compare function. This function has two input arguments: @left, @right
	module.filter = function(obj, pattern, cfn) {
		return JPath(obj).select(pattern, cfn, NULL).val();
	};

	window.jPath = window.jPath || module;
})(Array);