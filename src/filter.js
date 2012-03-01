define(function() {

// split the string up into a matched part and the rest, and remove any tokens
// surrounding the matched part (left and regex).
// regex should be of the form, e.g. /\]\](.*)/ with (.*) capturing the "rest"
var splitInner = function(left, regex) {
	return function(str) {
		var res = str.slice(left).split(regex);
		return [res[0], res[1]];
	};
};

var Regexps = {
	whitespace: /((?:\s|,).*)/,
	doubleSquare: /\]\](.*)/,
	doubleQuote: /"(.*)/
};

var states = {
	title: {
		match: /^\[\[[^\]\]]+\]\]/,
		action: splitInner(2, Regexps.doubleSquare),
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.title === value) ? true : false;
			};
		}
	},
	tag: {
		match: /^#.+/,
		action: splitInner(1, Regexps.whitespace),
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.tags && ~tiddler.tags.indexOf(value)) ?
					true : false;
			};
		}
	},
	field: {
		match: /^\[[^!=\]]+!?=[^\]]+\]/,
		action: function(text) {
			var split = text.indexOf('!='),
				not = !!~split,
				firstSplit = (!not) ? text.indexOf('=') : split,
				secondSplit = text.indexOf(']'),
				match, value
				field = text.slice(1, firstSplit),
				rest = text.slice(secondSplit + 1);
				if (not) {
					value = text.slice(firstSplit + 2, secondSplit);
				} else {
					value = text.slice(firstSplit + 1, secondSplit);
				}
			match = {
				field: field,
				value: value,
				not: not
			};
			return [match, rest];
		},
		tiddlerTest: function(value) {
			return function(tiddler) {
				var matches = ((tiddler[value.field] || (tiddler.fields &&
					tiddler.fields[value.field])) === value.value) ?
						true : false;
				return (value.not) ? !matches : matches;
			};
		}
	},
	space: {
		match: /^@.+/,
		action: splitInner(1, Regexps.whitespace),
		tiddlerTest: function(value) {
			return function(tiddler) {
				var regex = /_(public|private|archive)$/;
				return (tiddler.bag.name.replace(regex, '')
					=== value) ? true : false;
			};
		}
	},
	modifier: {
		match: /^\+.+/,
		action: splitInner(1, Regexps.whitespace),
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.modifier === value) ? true : false;
			};
		}
	},
	text: {
		match: /^"[^"]+"/,
		action: splitInner(1, Regexps.doubleQuote),
		tiddlerTest: function(value) {
			return function(tiddler) {
				return (tiddler.text && ~tiddler.text.indexOf(value)) ?
					true : false;
			};
		}
	},
	not: {
		match: /!(?:\W|,)+/,
		action: function(text) {
			return ['not', text.slice(1)];
		}
	},
	subBlock: {
		match: /\(.+/,
		action: function(text) {
			var numBrackets = 1, i, l, curChar, pos = -1, matched, rest;
			for (i=1, l=text.length; i < l; i++) {
				curChar = text.charAt(i);
				if (curChar === '(') {
					numBrackets++;
				} else if (curChar === ')') {
					numBrackets--;
				}
				if (numBrackets === 0) {
					pos = i;
					break;
				}
			}
			if (~pos) {
				matched = text.slice(1, pos);
				rest = text.slice(pos + 1);
				return [matched, rest];
			} else {
				throw {
					name: 'ParseError',
					message: 'Brackets don\'t match'
				};
			}
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
	var trimTxt = $.trim(text), type = null, result, rest, matched;

	$.each(states, function(state, obj) {
		if (obj.match.test(trimTxt)) {
			type = state;
			return false;
		}
	});

	if (type) {
		result = states[type].action(trimTxt);
		matched = result[0];
		rest = result[1] || '';
		return [type, matched, rest]; // return state, text matched and remaining text
	} else {
		return false;
	}
};

// consume one block and return a suitable object
// used by the parse function. block is the array returned by the action functions
var consumeBlock;
consumeBlock = function(block) {
	var objectify = function(res) {
		return {
			type: res[0],
			value: res[1]
		};
	}, obj, nextObj, rest;

	obj = objectify(block);

	// consume any sub blocks
	switch (obj.type) {
		case 'not':
			nextObj = consumeBlock(match(block[2]));
			obj.value = nextObj[0];
			rest = nextObj[1];
			break;
		case 'subBlock':
			obj = parse(block[1]);
			rest = block[2];
			break;
		default:
			rest = block[2];
			break;
	}

	return [obj, rest];
};

// parse an entire filter string
// return an AST
var parse = function(text) {
	var AST = { type: 'or', value: [] }, filter, rest,
		andBlock = { type: 'and', value: [] },
		result = match(text);
	while (result) {
		if (result[0] === 'or') {
			rest = result[2];
			if (andBlock.length === 1) {
				AST.value.push(andBlock.value[0]);
			} else {
				AST.value.push(andBlock);
			}
			andBlock = { type: 'and', value: [] };
		} else {
			filter = consumeBlock(result);
			rest = filter[1];
			andBlock.value.push(filter[0]);
		}
		result = match(rest);
	}

	// reduce the and/or blocks to be as simple as possible
	if (andBlock.value.length === 1) {
		AST.value.push(andBlock.value[0]);
	} else if (andBlock.value.length > 1) {
		AST.value.push(andBlock);
	}

	if (AST.value.length === 1) {
		return AST.value[0];
	} else if (AST.value.length > 1) {
		return AST;
	} else {
		throw {
			name: 'ParseError',
			message: 'No filter found'
		};
	}
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
	var loopAST, tiddlerTester, filterFunc;
	loopAST = function(block) {
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
			case 'not':
				funcList = loopAST(block.value);
				filterFunc = function(tiddler) {
					return !funcList(tiddler);
				};
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
	};

	filterFunc = loopAST(AST);

	// Ensure that the tiddler passed in is not modified during testing
	tiddlerTester = function(tiddler) {
		var safeTid = $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		return filterFunc(safeTid);
	};

	return tiddlerTester;
};

return {
	parse: parse,
	match: match,
	createTester: createTester,
	states: states
};

});
