define(function() {

var states = {
	title: {
		match: /^\[\[[^\]\]]+\]\]/,
		action: function(text) {
			return text.slice(2).split(/\]\](.*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.title === value) ? true : false;
			};
		}
	},
	notTitle: {
		match: /^!\[\[[^\]\]]+\]\]/,
		action: function(text) {
			return text.slice(3).split(/\]\](.*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.title !== value) ? true : false;
			};
		}
	},
	tag: {
		match: /^#.+/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (~tiddler.tags.indexOf(value)) ? true : false;
			};
		}
	},
	notTag: {
		match: /^!#.+/,
		action: function(text) {
			return text.slice(2).split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (!~tiddler.tags.indexOf(value)) ? true : false;
			};
		}
	},
	field: {
		match: /^\[[^!=\]]+=[^\]]+\]/,
		action: function(text) {
			var firstSplit = text.indexOf('='),
				secondSplit = text.indexOf(']'),
				match,
				field = text.slice(1, firstSplit),
				value = text.slice(firstSplit + 1, secondSplit),
				rest = text.slice(secondSplit + 1);
			match = {
				field: field,
				value: value
			};
			return [match, rest];
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler[value.field] || (tiddler.fields &&
					tiddler.fields[value.field]) === value.value) ?
						true : false;
			};
		}
	},
	notField: {
		match: /^\[[^!=\]]+!=[^\]]+\]/,
		action: function(text) {
			var firstSplit = text.indexOf('!='),
				secondSplit = text.indexOf(']'),
				match,
				field = text.slice(1, firstSplit),
				value = text.slice(firstSplit + 2, secondSplit),
				rest = text.slice(secondSplit + 1);
			match = {
				field: field,
				value: value
			};
			return [match, rest];
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler[value.fields] || (tiddler.fields &&
					tiddler.fields[value.field]) !== value.value) ?
						true : false;
			};
		}
	},
	space: {
		match: /^@.+/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.bag.name.split(/_(public|private)$/)[0] ===
					value) ? true : false;
			};
		}
	},
	notSpace: {
		match: /^!@.+/,
		action: function(text) {
			return text.slice(2).split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.bag.name.split(/_(public|private)$/)[0] !==
					value) ? true : false;
			};
		}
	},
	text: {
		match: /^[^!\W,]/,
		action: function(text) {
			return text.split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (~tiddler.text.indexOf(value)) ? true : false;
			};
		}
	},
	notText: {
		match: /^![^\W,]/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (~tiddler.text.indexOf(value)) ? true : false;
			};
		}
	},
	or: {
		match: /^,/,
		action: function(text) {
			return ['or', text.slice(1)];
		}
	}
};

// match the next object and return the match, which object it was, and what's left
var match = function(text) {
	var trimTxt = $.trim(text), type = null, result;

	$.each(states, function(state, obj) {
		if (obj.match.test(trimTxt)) {
			type = state;
			return false;
		}
	});

	if (type) {
		result = states[type].action(trimTxt);
		return [type, result[0], result[1]]; // return state, text matched and remaining text
	} else {
		return false;
	}
};

// parse an entire filter string
// return an AST
var parse = function(text) {
	var AST = { type: 'or', value: [] }, filter,
		andBlock = { type: 'and', value: [] },
		result = match(text);
	while (result) {
		filter = {
			type: result[0],
			value: result[1]
		};
		if (filter.or) {
			AST.value.push(andBlock);
			andBlock = { type: 'and', value: [] };
		} else {
			andBlock.value.push(filter);
		}
		result = match(result[2]);
	}
	if (andBlock.value.length > 0) {
		AST.value.push(andBlock);
	}
	return AST;
};

// construct a single function that does AND matching on a tiddler
// out of a list of sub match functions
var andFunc = function(fns) {
	return function(tiddler) {
		var match = true;
		$.each(fns, function(i, fn) {
			if (!fn(tiddler)) {
				match = false;
				return false;
			}
		});
		return match;
	};
};

// construct a single function that does OR matching on a tiddler
// out of a list of sub match functions
var orFunc = function(fns) {
	return function(tiddler) {
		var match = false;
		$.each(fns, function(i, fn) {
			if (fn(tiddler)) {
				match = true;
				return false;
			}
		});
		return match;
	};
};

// take in an AST and return a function that, when called with a tiddler,
// returns true or false depending on whether that tiddler matches
// AST is an object with type and value attributes
var createTester = function(AST) {
	// recurse through the AST and generate a tiddler tester function
	var loopAST = function(block) {
		var filterFunc, funcList = [];
		switch (block.type) {
			case 'and':
				$.each(block.value, function(i, subBlock) {
					funcList.push(loopAST(subBlock));
				});
				filterFunc = andFunc(funcList);
				break;
			case 'or':
				$.each(block.value, function(i, subBlock) {
					funcList.push(loopAST(subBlock));
				});
				filterFunc = orFunc(funcList);
				break;
			case 'function':
				filterFunc = function(tiddler) {
					return (block.value(tiddler)) ? true : false;
				};
				break;
			default:
				filterFunc = states[block.type].tiddlerTest(block.value);
		}
		return filterFunc;
	}, tiddlerTester, filterFunc;

	filterFunc = loopAST(AST);

	// Ensure that the tiddler passed in is not modified during testing
	var tiddlerTester = function(tiddler) {
		var safeTid = $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		return filterFunc(safeTid);
	};

	return tiddlerTester;
};

return {
	parse: parse,
	match: match,
	createTester: createTester
};

});
