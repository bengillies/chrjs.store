define(function() {

var states = {
	title: {
		match: /^\[\[[^\]\]]+\]\]/,
		action: function(text) {
			return text.slice(2).split(/\]\](.*)/);
		}
	},
	notTitle: {
		match: /^!\[\[[^\]\]]+\]\]/,
		action: function(text) {
			return text.slice(3).split(/\]\](.*)/);
		}
	},
	tag: {
		match: /^#.+/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
		}
	},
	notTag: {
		match: /^!#.+/,
		action: function(text) {
			return text.slice(2).split(/((?:\W|,).*)/);
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
		}
	},
	space: {
		match: /^@.+/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
		}
	},
	notSpace: {
		match: /^!@.+/,
		action: function(text) {
			return text.slice(2).split(/((?:\W|,).*)/);
		}
	},
	text: {
		match: /^[^!\W,]/,
		action: function(text) {
			return text.split(/((?:\W|,).*)/);
		}
	},
	notText: {
		match: /^![^\W,]/,
		action: function(text) {
			return text.slice(1).split(/((?:\W|,).*)/);
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
	var AST = [], filter, andBlock = [],
		result = match(text);
	while (result) {
		filter = {};
		filter[result[0]] = result[1];
		if (filter.or) {
			AST.push(andBlock);
			andBlock = [];
		} else {
			andBlock.push(filter);
		}
		result = match(result[2]);
	}
	if (andBlock.length > 0) {
		AST.push(andBlock);
	}
	return AST;
};

// take in an AST and return a function that, when called with a tiddler,
// returns true or false depending on whether that tiddler matches
var createTester = function(AST) {
	var filterFunc, orBlock = [],
		// construct a single function that does AND matching on a tiddler
		// out of a list of sub match functions
		andFunc = function(fns) {
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
		},
		// construct a single function that does OR matching on a tiddler
		// out of a list of sub match functions
		orFunc = function(fns) {
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

	// loop through the AST and construct a single function that can be used
	// to test whether each tiddler matches the filter given
	$.each(AST, function(i, block) {
		var andBlock = [];
		$.each(block, function(i, matchblock) {
			$.each(matchblock, function(name, value) {
				switch (name) {
					case 'title':
						andBlock.push(function(tiddler) {
							return (tiddler.title === value) ? true : false;
						});
						break;
					case 'notTitle':
						andBlock.push(function(tiddler) {
							return (tiddler.title !== value) ? true : false;
						});
						break;
					case 'tag':
						andBlock.push(function(tiddler) {
							return (~tiddler.tags.indexOf(value)) ? true :
								false;
						});
						break;
					case 'notTag':
						andBlock.push(function(tiddler) {
							return (!~tiddler.tags.indexOf(value)) ? true :
								false;
						});
						break;
					case 'field':
						andBlock.push(function(tiddler) {
							return (tiddler.fields[value.field] &&
								tiddler.fields[value.field] ===
								value.value) ? true : false;
						});
						break;
					case 'notField':
						andBlock.push(function(tiddler) {
							return (tiddler.fields[value.field] &&
								tiddler.fields[value.field] !==
								value.value) ? true : false;
						});
						break;
					case 'space':
						andBlock.push(function(tiddler) {
							return (tiddler.bag.name.
								split(/_(public|private)$/)[0] === value) ?
								true : false;
						});
						break;
					case 'notSpace':
						andBlock.push(function(tiddler) {
							return (tiddler.bag.name.
								split(/_(public|private)$/)[0] !== value) ?
								true : false;
						});
						break;
					case 'text':
						andBlock.push(function(tiddler) {
							return (~tiddler.text.indexOfi(value)) ? true :
								false;
						});
						break;
					case 'notText':
						andBlock.push(function(tiddler) {
							return (~tiddler.text.indexOfi(value)) ? true :
								false;
						});
						break;
				}
			});
		});
		orBlock.push(andFunc(andBlock));
	});

	filterFunc = orFunc(orBlock);

	return filterFunc;
};

return {
	parse: parse,
	match: match,
	createTester: createTester
};

});
