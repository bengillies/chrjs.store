/* Taken and modified from ACE IDE to provide a lightweight RequireJS that
 * loads dependencies immediately, instead of inside a setTimeout (as RequireJS
 * does). See:
 * (https://github.com/mozilla/ace/blob/master/build_support/mini_require.js)
 * for the original version.
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Define a module along with a payload
 * @param module a name for the payload
 * @param payload a function to call with (require, exports, module) params
 */

(function() {

var _define = window.define;
window.define = function(module, deps, payload) {
    if (typeof define.original === 'function') {
        define.original.apply(this, arguments);
    }

    if (typeof module !== 'string') {
        return;
    }

    if (arguments.length === 2) {
        payload = deps;
    }

    if (!define.modules) {
        define.modules = {
            require: { payload: window.require, deps: [] },
            define: { payload: window.define, deps: [] },
            exports: { payload: {}, deps: [] },
            module: { payload: {}, deps: [] }
        };
    }

    define.modules[module] = {
        payload: payload,
        deps: deps
    };
};
define.original = _define;
define.modules = (_define && _define.modules) ? _define.modules : {};

/**
 * Get at functionality define()ed using the function above
 */
var _require = window.require;
window.require = function(module, callback) {
    var params, dep, payload, i, l;

    if (Object.prototype.toString.call(module) === "[object Array]") {
        params = [];
        for (i = 0, l = module.length; i < l; ++i) {
            dep = lookup(module[i]);
            if (dep) {
                params.push(dep);
            } else {
                require.original.apply(this, arguments);
                return null;
            }
        }
        if (callback) {
            callback.apply(null, params);
        }
    } else if (typeof module === 'string') {
        payload = lookup(module);

        if (!payload) {
            return require.original.apply(this, arguments);
        }

        if (callback) {
            callback();
        }

        return payload;
    }
};
require.original = _require;

/**
 * Internal function to lookup moduleNames and resolve them by calling the
 * definition function if needed.
 */
var lookup = function(moduleName) {
    var mod = define.modules[moduleName],
        module = mod ? mod.payload : null,
        deps = mod ? mod.deps : null;
    if (!module) {
        return null;
    }

    if (typeof module === 'function') {
        var exports = {}, i, args = [], result;
        for (i = 0; i < deps.length; i++) {
            args.push(lookup(deps[i]));
        }
        if (args.length === 0) {
            args = [require, exports, { id: moduleName, uri: '' }];
        }
        result = module.apply(this, args);
        return result || exports;
    }

    return module;
};

}());
define('filter-syntax',['require','exports','module'],function() {

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
	whitespace: /((?:\W|,).*)/,
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
				return (~tiddler.tags.indexOf(value)) ? true : false;
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
				var matches = (tiddler[value.field] || (tiddler.fields &&
					tiddler.fields[value.field]) === value.value) ?
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
				return (tiddler.bag.name.split(/_(public|private)$/)[0] ===
					value) ? true : false;
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
				return (~tiddler.text.indexOf(value)) ? true : false;
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
	createTester: createTester
};

});
define('filter',['filter-syntax'], function(parser) {

var Tiddlers, contains;

// the Tiddlers object is a list of tiddlers that you can operate on/filter. Get a list by calling the Store instance as a function (with optional filter)
Tiddlers = function(store, tiddlers) {
	var self = [];
	self.store = store;
	self.ast = { type: 'and', value: [] };
	if (tiddlers) {
		$.each(tiddlers, function(i, tiddler) {
			self.push(tiddler);
		});
	}

	$.extend(self, Tiddlers.fn);

	return self;
};

// Check if match is in field
contains = function(field, match) {
	return (field && field.indexOf(match) !== -1) ? true : false;
};

Tiddlers.fn = {
	find: function(match) {
		var AST = parser.parse(match), filterFunc;

		// generate a function to test whether each tiddler matches
		filterFunc = parser.createTester(AST);

		// now we have a function we can use to test with, loop through all the
		// tiddlers and test them
		return this.map(function(tiddler) {
			return (filterFunc(tiddler)) ? tiddler : null;
		});
	},
	tag: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.tags, match) ? tiddler : null;
		});
	},
	text: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.text, match) ? tiddler : null;
		});
	},
	title: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.title, match) ? tiddler : null;
		});
	},
	attr: function(name, match) {
		var chkExists = (!match) ? true : false,
			getValue = function(tiddler) {
				return tiddler[name] || (tiddler.fields &&
					tiddler.fields[name]);
			};
		return this.map(function(tiddler) {
			if (chkExists) {
				return (getValue(tiddler)) ? tiddler : null;
			} else {
				return contains(getValue(tiddler), match) ? tiddler : null;
			}
		});
	},
	not: function(name, match) {
		var chkExists = (!match) ? true : false,
			getValue = function(tiddler) {
				return tiddler[name] || (tiddler.fields &&
					tiddler.fields[name]);
			};
		return this.map(function(tiddler) {
			if (chkExists) {
				return (getValue(tiddler)) ? null : tiddler;
			} else {
				return contains(getValue(tiddler), match) ? null : tiddler;
			}
		});
	},
	bag: function(name) {
		return this.map(function(tiddler) {
			var bag = tiddler.bag && tiddler.bag.name;
			return (bag === name) ? tiddler : null;
		});
	},
	// the space the tiddler originates from (i.e. not just included in)
	// blank/true matches the current space, false matches everything else
	space: function(name) {
		var regex = /(_public|_private|_archive)$/,
			current, spaceName;
		if (name === true || name === undefined) {
			current = true;
		} else if (name === false) {
			current = false;
		}
		if (current !== undefined) {
			spaceName = this.store.recipe &&
				this.store.recipe.name.replace(regex, '');
		}
		return this.map(function(tiddler) {
			var bag = (tiddler.bag && tiddler.bag.name).replace(regex, '');
			if (!spaceName) {
				spaceName = (this.store.recipe &&
					this.store.recipe.name.replace(regex, '')) || bag;
			}
			if (current) {
				return (bag === spaceName) ? tiddler : null;
			} else if (current === false) {
				return (bag === spaceName) ? null: tiddler;
			} else {
				return (bag === name) ? tiddler : null;
			}
		});
	},
	// no arguments matches the default recipe
	recipe: function(name) {
		var matchCurrent = (name === undefined) ? true : false, recipe;
		if (matchCurrent) {
			recipe = this.store.recipe.name;
		}
		return this.map(function(tiddler) {
			if (!matchCurrent) {
				recipe = tiddler.recipe && tiddler.recipe.name;
			}
			return (recipe === name) ? tiddler : null;
		});
	},
	// tiddlers that have been changed (i.e. not synced), lastSynced is optional and if present matches tiddlers that were synced before lastSynced
	dirty: function(lastSynced) {
		if (!lastSynced) {
			return this.map(function(tiddler) {
				return (tiddler.lastSync) ? null : tiddler;
			});
		} else {
			return this.map(function(tiddler) {
				if (tiddler.lastSync) {
					// return true if tiddler.lastSync is older than lastSynced
					return (+tiddler.lastSync < +lastSynced) ? tiddler :
						null;
				} else {
					return tiddler;
				}
			});
		}
	},
	each: function(fn) {
		var self = this;
		$.each(self, function(i, tiddler) {
			fn.apply(self, [tiddler, i]);
		});
		return self;
	},
	// returns a new instance of Tiddlers
	map: function(fn) {
		var self = this,
			result = Tiddlers(self.store);
		result.ast = self.ast;
		result.ast.value.push({
			type: 'function',
			value: function(tiddler) {
				var res = fn.apply(result, [tiddler]);
				return (res) ? true : false;
			}
		});
		$.each(self, function(i, tiddler) {
			var mappedTiddler = fn.apply(self, [tiddler]);
			if (mappedTiddler) {
				result.push(mappedTiddler);
			}
		});
		return result;
	},
	// pass in an initial value and a callback. Callback gets tiddler and current result, and returns new result
	reduce: function(init, fn) {
		var result = init, self = this;
		$.each(self, function(i, tiddler) {
			result = fn.apply(self, [tiddler, result]);
		});
		return result;
	},
	// turn the list of tiddlers into a set (i.e. make them unique)
	unique: function() {
		var set = {}, self = this,
			result = Tiddlers(self.store);
		$.each(this, function(i, tiddler) {
			if (!set[tiddler.title]) {
				set[tiddler.title] = tiddler;
			} else if (!tiddler.lastSync) {
				set[tiddler.title] = tiddler;
			}
		});

		$.each(set, function(title, tiddler) {
			result.push(tiddler);
		});
		return result;
	},
	// bind fn to the current set of matched tiddlers.
	bind: function(fn) {
		var self = this,
			bindFunc = function(tiddler) {
				fn.apply(self, [tiddler]);
			};
		self.store.bind('filter', parser.createTester(self.ast), bindFunc);
		return self;
	},
	// save tiddlers currently in list. Callback happens for each tiddler
	save: function(callback) {
		var self = this;
		$.each(self, function(i, tiddler) {
			self.store.save(tiddler, callback);
		});
		return self;
	},
	// add one or more tiddlers to the current Tiddlers object and the attached store
	add: function(tiddlers) {
		var self = this;
		if (tiddlers instanceof tiddlyweb.Tiddler) {
			self.push(tiddlers);
			self.store.add(tiddlers);
		} else {
			$.each(tiddlers, function(i, tiddler) {
				self.push(tiddler);
				self.store.add(tiddlers);
			});
		}
		return self;
	}
};

return Tiddlers;

});
define('event',['require','exports','module'],function() {

return function() {
	var binds = {
		recipe: { all: [] },
		bag: { all: [] },
		tiddler: { all: [] },
		filter: []
	};

	var result = {
		// takes thing to bind to (e.g. 'tiddler'), optional name (e.g. tiddler title), and callback that fires whenever object updates.
		// if name not present, then callbck fires whenever any object of that type updates.
		bind: function(type, name, callback) {
			if (type === 'filter') {
				binds.filter.push({ test: name, callback: callback });
			} else if (binds[type]) {
				if (name) {
					if (!binds[type][name + type]) {
						binds[type][name + type] = [];
					}
					binds[type][name + type].push(callback);
				} else {
					binds[type].all.push(callback);
				}
			}
		},

		// same input as bind, though name and callback both optional. If callback present, any function the same (i.e. ===) as callback
		// will be removed.
		unbind: function(type, name, callback) {
			var stripCallback = function(list) {
				if (callback) {
					$.each(list, function(i, func) {
						if (callback === func) {
							list.splice(i, 1);
						}
					});
					return list;
				} else {
					return [];
				}
			};
			if (type === 'filter') {
				$.each(binds.filter, function(i, obj) {
					if (obj.test === callback) {
						binds.filter.splice(i, 1);
					}
				});
			} else if ((binds[type]) && (name)) {
					binds[type][name + type] =
						stripCallback(binds[type][name + type]);
			} else {
				binds[type].all = stripCallback(binds[type].all);
			}
		},

		// fire an event manually. args is the object that gets passed into the event handlers
		trigger: function(type, name, args) {
			var message = ($.isArray(args)) ? args : [args],
				tiddler, self = this;
			if (binds[type]) {
				$.each(binds[type].all, function(i, func) {
					func.apply(self, message);
				});
				if (name && binds[type][name + type]) {
					$.each(binds[type][name + type], function(i, func) {
						func.apply(self, message);
					});
				}
			}

			// trigger any filters that have been bound
			if (type === 'tiddler') {
				tiddler = (args instanceof tiddlyweb.Tiddler) ? args : args[0];
				$.each(binds.filter, function(i, obj) {
					if (obj.test(tiddler)) {
						obj.callback.apply(self, message);
					}
				});
			}
		}
	};

	return result;
};

});
define('cache',['require','exports','module'],function() {

var isLocalStorage = (function() {
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch(e) {
			return false;
		}
	}()),
	// construct an ID for use in localStorage
	getStorageID = function(tiddler) {
		var bag = (tiddler.bag && tiddler.bag.name) || '';
		return encodeURIComponent(bag) + '/' +
			encodeURIComponent(tiddler.title);
	};

return {
	isCaching: isLocalStorage,
	set: function(tiddler) {
		var key = getStorageID(tiddler);
		if (isLocalStorage) {
			window.localStorage.setItem(key, tiddler.toJSON());
		}
	},
	get: function(tiddler) {
		var key = getStorageID(tiddler), result, tidJSON;
		if (isLocalStorage) {
			result = window.localStorage[key];
			tidJSON = $.parseJSON(result);
			result = new tiddlyweb.Tiddler(tiddler.title);
			result.bag = tiddler.bag;
			$.extend(result, tidJSON);
			return result;
		}
		return null;
	},
	remove: function(tiddler) {
		var key = getStorageID(tiddler),
			noBagKey = '/' + key.split('/')[1];
		if (isLocalStorage) {
			window.localStorage.removeItem(key);
			window.localStorage.removeItem(noBagKey);
		}
	},
	list: function() {
		var tiddlers = [], i, l;
		if (isLocalStorage) {
			for (i = 0, l = window.localStorage.length; i < l; i++) {
				try {
					var key = window.localStorage.key(i), names, bagName, name,
						tiddlerJSON, tiddler;
					names = key.split('/');
					if (names.length !== 2) {
						throw "BadKey";
					}
					bagName = decodeURIComponent(names[0]);
					name = decodeURIComponent(names[1]);
					tiddlerJSON = $.parseJSON(window.localStorage[key]);
					tiddler = new tiddlyweb.Tiddler(name);
					if (bagName) {
						tiddler.bag = new tiddlyweb.Bag(bagName, '/');
					}
					$.extend(tiddler, tiddlerJSON);
					tiddlers.push(tiddler);
				} catch(e) {
					// not a chrjs-store cached tiddler
				}
			};
		}
		return tiddlers;
	},
	clear: function() {
		if (isLocalStorage) {
			window.localStorage.clear();
		}
	}
};

});
/*
 * Store tiddlers in a local object
 */

define('localStore',['require','exports','module'],function() {
	return function() {
		var store = {},
			bagList = [];

		// returns a unique key to be used for getting/setting tiddlers directly
		var createKey = function(tiddler) {
			var bag = tiddler.bag;
			return encodeURIComponent(bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		};

		// returns a tiddler
		// if bag is not present, search through bags until we find a match
		var get = function(tiddler) {
			var match;
			if (tiddler.bag) {
				return store[createKey(tiddler)];
			} else {
				for (var i = 0, l = bagList.length; i < l; i++) {
					tiddler.bag = bagList[i];
					match = store[createKey(tiddler)];
					if (match) {
						tiddler.bag = undefined;
						return match;
					}
				}
			}
			return null;
		};

		// set a tiddler
		var set = function(tiddler) {
			if (!bagList[tiddler.bag.name]) {
				bagList[tiddler.bag.name] = tiddler.bag;
			}
			tiddler.lastSync = new Date();
			store[createKey(tiddler)] = tiddler;
		};

		// remove a tiddler
		var remove = function(tiddler) {
			var key = createKey(tiddler),
				removed = store[key];

			delete store[createKey(tiddler)];

			return removed;
		};

		// list all tiddlers
		var list = function() {
			var results = [];
			$.each(store, function(key, tiddler) {
				results.push(tiddler);
			});
			return results;
		}

		// list all bags
		var bags = function() {
			return bagList;
		};

		return {
			get: get,
			set: set,
			remove: remove,
			list: list,
			bags: bags
		};
	};
});
define('store',['filter', 'event', 'cache', 'localStore'], function(filter, events, cache, localStore) {

return function(tiddlerCallback, getCached) {
	if (getCached === undefined) {
		getCached = true;
	}

	var self,
		// private
		space = {
			name: '',
			type: 'private' // private or public (aka r/w or read only)
		},
		// setup the bind/unbind module
		ev = events(),
		// set up the local store object
		store = localStore(),
		// remove items from the store that have already been deleted on the server
		removeDeleted = function(container, tiddlers) {
			var newTiddlers = filter(self, tiddlers).map(function(tiddler) {
				return tiddler.title;
			});

			self.each(function(tiddler, title) {
				if ((tiddler.recipe &&
						tiddler.recipe.name === container.name) &&
						(newTiddlers.indexOf(tiddler.title) === -1)) {
					store.remove(tiddler);
					self.trigger('tiddler', title, [tiddler, 'deleted']);
				}
			});
		},
		replace;
	// add/replace the thing in the store object with the thing passed in.
	// different to add, which only adds to pending
	replace = function(tiddler) {
		var oldTid = store.get(tiddler);
		store.set(tiddler);
		if (oldTid && oldTid.revision !== tiddler.revision) {
			self.trigger('tiddler', tiddler.title, tiddler);
		}
		return true;
	};

	// public variables
	// take in an optional filter and return a Tiddlers object with the tiddlers that match it
	self = function(name, match) {
		var allTiddlers = filter(self);

		self.each(function(tiddler, title) {
			allTiddlers.push(tiddler);
		});

		if ((typeof match === 'undefined') && (typeof name === 'string')) {
			allTiddlers = allTiddlers.find(name);
		} else if (typeof name === 'function') {
			allTiddlers = allTiddlers.map(name);
		} else if (allTiddlers[name]) {
			allTiddlers = allTiddlers[name](match);
		} else if (name) {
			allTiddlers = allTiddlers.attr(name, match);
		}

		// create new copies so any modifications do not affect the original
		allTiddlers = allTiddlers.map(function(tiddler) {
			return $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		});

		return allTiddlers;
	};
	self.recipe = null;
	self.pending = {};

	// public functions

	// let filter be extensible
	self.fn = filter.fn;

	// takes in a  callback. calls callback with space object containing name and type or error
	self.getSpace = function(callback) {
		if (space.name !== '') {
			callback(space);
		} else {
			$.ajax({
				url: '/?limit=1', // get a tiddler from whatever is default
				dataType: 'json',
				success: function(data) {
					var recipeName = ((data instanceof Array) ? data[0].recipe :
							data.recipe) || 'No Recipe Found',
						match = recipeName.match(/^(.*)_(private|public)$/);
					if (match) {
						space.name = match[1];
						space.type = match[2];
						self.recipe = new tiddlyweb.Recipe(recipeName, '/');
						callback(space);
					} else {
						callback(null, {
							name: 'NoSpaceMatchError',
							message: data.recipe + ' is not a valid space'
						});
					}
				},
				error: function(xhr, txtStatus, err) {
					callback(null, err, xhr);
				}
			});
		}

		return self;
	};

	self.bind = function() {
		ev.bind.apply(self, arguments);

		return self;
	};

	self.unbind = function() {
		ev.unbind.apply(self, arguments);

		return self;
	};

	self.trigger = function() {
		ev.trigger.apply(self, arguments);

		return self;
	};

	// refresh tiddlers contained in the recipe.
	self.refresh = function(callback) {
		var getTiddlersSkinny = function(container) {
			var tiddlerCollection = container.tiddlers();
			tiddlerCollection.get(function(result) {
				$.each(result, function(i, tiddler) {
					replace(tiddler);
				});
				removeDeleted(container, result);
				if (callback) {
					callback.apply(self, [result]);
				}
			}, function(xhr, err, errMsg) {
				callback(null, {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddlers: ' + errMsg
				}, xhr);
			});
		};

		if (self.recipe) {
			getTiddlersSkinny(self.recipe);
		} else {
			self.getSpace(function() {
				if (self.recipe) {
					getTiddlersSkinny(self.recipe);
				}
			});
		}

		return self;
	};

	// returns the tiddler, either directly if no callback, or fresh from the server inside the callback if given
	// returns pending first, then in recipe order (ie last bag first) if > 1 exist
	// render sets the render=1 flag on the GET request, server forces the function to return the server version
	self.get = function(tid, callback, render, server) {
		var pending = self.pending[tid] || self.pending[tid.title] || null,
			tiddler = (function() {
				var tiddler = (!server && pending) ? pending : tid;
				if (tiddler instanceof tiddlyweb.Tiddler) {
					return tiddler;
				}
				self.each(function(t, title) {
					if (title === tiddler) {
						tiddler = t;
						return false;
					}
				});
				return (tiddler instanceof tiddlyweb.Tiddler) ? tiddler : null;
			}());

		if (!callback && tiddler) {
			return $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		} else if (!server && pending) {
			callback.call(self, $.extend(true, new tiddlyweb.Tiddler(),
				tiddler));
		} else if (tiddler) {
			tiddler.get(function(t) {
				replace(t);
				callback.call(self, $.extend(true, new tiddlyweb.Tiddler(), t));
			}, function(xhr, err, errMsg) {
				callback.call(self, null, {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddler: ' + errMsg
				}, xhr);
			}, (render) ? 'render=1' : '');
		} else if (callback) {
			callback.call(self, null, {
				name: 'NotFoundError',
				message: 'Tiddler not found'
			});
		} else {
			return null;
		}

		return self;
	};

	// loops over every tiddler and calls callback with them
	self.each = function(callback) {
		var continueLoop = true;
		$.each(self.pending, function(title, tiddler) {
			continueLoop = callback(tiddler, title);
			return continueLoop;
		});

		if (continueLoop || typeof continueLoop === 'undefined') {
			$.each(store.list(), function(i, tiddler) {
				return callback(tiddler, tiddler.title);
			});
		}

		return self;
	};

	// add a tiddler to the store. Adds to pending (and localStorage).  will add whether a tiddler exists or not. Won't save until save
	// if bag is not present, will set bag to <space_name> + _public
	// if tiddler already in store[bag], will remove until saved to server
	self.add = function(tiddler) {
		var saveLocal = function(tiddler) {
			var tid;
			cache.remove(tiddler);
			cache.set(tiddler);
			tid = $.extend( true, new tiddlyweb.Tiddler(), tiddler);
			tid.lastSync = null;
			self.pending[tid.title] = tid;
			if (tiddler.bag) {
				self.trigger('tiddler', tid.title, tid);
			}
		};

		if (!tiddler.bag) {
			// save locally without a bag, and add the bag ASAP
			saveLocal(tiddler);
			self.getSpace(function(space) {
				var bagName = space.name + '_public';
				tiddler.bag = new tiddlyweb.Bag(bagName, '/');
				saveLocal(tiddler);
			});
		} else {
			saveLocal(tiddler);
		}

		return self;
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending.
	// tiddler should be a tiddlyweb.Tiddler to save just that tiddler directly, or a callback to save all tiddlers in pending
	self.save = function(tiddler, cllbck) {
		var empty = true, isTiddler = (tiddler instanceof tiddlyweb.Tiddler),
			callback = (!isTiddler && tiddler) ? tiddler : cllbck,
			// do the actual saving bit
			saveTiddler = function(tiddler, callback) {
				delete self.pending[tiddler.title]; // delete now so that changes made during save are kept
				if (!tiddler.bag) {
					self.getSpace(function(space) {
						tiddler.bag = new tiddlyweb.Bag(space.name + '_public',
							'/');
						saveTiddler(tiddler, callback);
					});
					return;
				}
				tiddler.put(function(response) {
					cache.remove(tiddler);
					replace(response);
					callback(response);
				}, function(xhr, err, errMsg) {
					if (!self.pending[tiddler.title]) {
						// there was an error, so put it back (if it hasn't already been replaced)
						tiddler.lastSync = null;
						self.pending[tiddler.title] = tiddler;
					}
					callback(null, {
						name: 'SaveError',
						message: 'Error saving ' + tiddler.title + ': ' + errMsg
					}, xhr);
				});
			};

		if (isTiddler) {
			saveTiddler(tiddler, callback);
			return self;
		}

		$.each(self.pending, function(i, tiddler) {
			if (empty) {
				empty = false;
			}
			saveTiddler(tiddler, callback);
		});
		if (empty) {
			callback(null, {
				name: 'EmptyError',
				message: 'Nothing to save'
			});
		}

		return self;
	};

	// remove a tiddler, either locally from pending, from the store, or delete from the server.
	// cllbck is optional. tid can be a tiddler object, a string with the title, or an object with the following:
	// tiddler, server (bool, delete from server), callback, pending (bool, delete pending)
	// default is don't delete from server, only remove pending
	self.remove = function(tid, cllbck) {
		var options = {
			pending: true,
			server: false,
			tiddler: tid,
			callback: cllbck || function() {}
		};

		if (typeof tid === 'string') {
			options.tiddler = self.get(tid);
		} else if (!(tid instanceof tiddlyweb.Tiddler)) {
			$.extend(options, tid);
		}

		if (!options.tiddler) {
			return self;
		} else {
			if (options.pending) {
				delete self.pending[options.tiddler.title];
				cache.remove(options.tiddler);
			}
			if (options.server && (options.tiddler.bag ||
					options.tiddler.recipe)) {
				options.tiddler['delete'](function(tiddler) {
					store.remove(tiddler);
					self.trigger('tiddler', tiddler.title, [tiddler, 'deleted']);
					options.callback(tiddler);
				}, function(xhr, err, errMsg) {
					options.callback((options.pending) ? options.tiddler : null,
						{
							name: 'DeleteError',
							message: 'Error deleting ' + options.tiddler.title +
								': ' + errMsg
					}, xhr);
				});
			} else {
				self.trigger('tiddler', options.tiddler.title, [options.tiddler,
					'deleted']);
				options.callback(options.tiddler);
			}
		}

		return self;
	};

	// search for some tiddlers and add the results to the store.
	// callback fires when the search returns.
	// query is a string appended to the url as /search?q=<query>
	self.search = function(query, callback) {
		var searchObj = new tiddlyweb.Search(query, '/');
		searchObj.get(function(tiddlers) {
			var safeCollection = [];
			$.each(tiddlers, function(i, tiddler) {
				replace(tiddler);
				safeCollection.push($.extend(true, new tiddlyweb.Tiddler(),
					tiddler));
			});

			callback(safeCollection);
		}, function(xhr, err, errMsg) {
			callback(null, {
				name: 'SearchError',
				message: 'Error retrieving tiddlers from search: ' + errMsg,
			}, xhr);
		});

		return self;
	};

	// make sure we get everything we can from xhrs
	$.ajaxSetup({
		beforeSend: function(xhr) {
			xhr.setRequestHeader("X-ControlView", "false");
		}
	});

	// import pending from localStorage
	self.retrieveCached = function() {
		$.each(cache.list(), function(i, tiddler) {
			self.add(tiddler);
		});

		return self;
	};

	// initialisation
	if (getCached) {
		self.retrieveCached();
	}
	if (tiddlerCallback) {
		self.refresh(tiddlerCallback);
	}

	return self;
};

});
(function(tiddlyweb) {

require(['store'], function(store) {

	tiddlyweb.Store = store;

});

}(window.tiddlyweb));
