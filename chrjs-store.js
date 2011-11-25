/**
 * almond 0.0.2+ Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
/*jslint strict: false, plusplus: false */
/*global setTimeout: false */

var requirejs, require, define;
(function () {

    var defined = {},
        aps = [].slice,
        req;

    if (typeof define === "function") {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseName = baseName.split("/");
                baseName = baseName.slice(0, baseName.length - 1);

                name = baseName.concat(name.split("/"));

                //start trimDots
                var i, part;
                for (i = 0; (part = name[i]); i++) {
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            }
        }
        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(null, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    function makeMap(name, relName) {
        var prefix, plugin,
            index = name.indexOf('!');

        if (index !== -1) {
            prefix = normalize(name.slice(0, index), relName);
            name = name.slice(index + 1);
            plugin = defined[prefix];

            //Normalize according
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            p: plugin
        };
    }

    function main(name, deps, callback, relName) {
        var args = [],
            usingExports,
            cjsModule, depName, i, ret, map;

        //Use name if no relName
        if (!relName) {
            relName = name;
        }

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            if (deps) {
                for (i = 0; i < deps.length; i++) {
                    map = makeMap(deps[i], relName);
                    depName = map.f;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        args[i] = makeRequire(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        args[i] = defined[name] = {};
                        usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        cjsModule = args[i] = {
                            id: name,
                            uri: '',
                            exports: defined[name]
                        };
                    } else if (depName in defined) {
                        args[i] = defined[depName];
                    } else if (map.p) {
                        map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                        args[i] = defined[depName];
                    }
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undefined) {
                    defined[name] = cjsModule.exports;
                } else if (!usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    }

    requirejs = req = function (deps, callback, relName, forceSync) {
        if (typeof deps === "string") {

            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return defined[makeMap(deps, callback).f];
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            //Drop the config stuff on the ground.
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = arguments[2];
            } else {
                deps = [];
            }
        }

        //Simulate async callback;
        if (forceSync) {
            main(null, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(null, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function () {
        return req;
    };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal for the value. Adjust args.
            callback = deps;
            deps = [];
        }

        main(name, deps, callback);
    };

    define.amd = {
        jQuery: true
    };
}());

define('filter',[],function() {

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
	createTester: createTester
};

});

define('collection',['filter'], function(parser) {

// Check if match is in field. fuzzy states whether exact match or just found in
// default is false
var contains = function(field, match, fuzzy) {
	if ((!fuzzy) && (field && !(field instanceof Array))) {
		return (field && field === match) ? true : false;
	} else {
		return (field && ~field.indexOf(match)) ? true : false;
	}
};

// the Tiddlers object is a list of tiddlers that you can operate on/filter. Get a list by calling the Store instance as a function (with optional filter)
var Tiddlers = function(store, tiddlers) {
	var self = [];
	self.store = store;
	self.ast = { type: 'and', value: [] };
	if (tiddlers) {
		$.each(tiddlers, function(i, tiddler) {
			self.push(tiddler);
		});
	} else {
		store.each(function(tiddler) {
			self.push(tiddler);
		});
	}

	$.extend(self, Tiddlers.fn);

	return self;
};

Tiddlers.fn = {
	find: function(name, match) {
		var filterFunc, AST;
		if ((typeof match === 'undefined') && typeof name === 'string') {
			AST = parser.parse(name);
			filterFunc = parser.createTester(AST);

			return this.map(function(t) { return (filterFunc(t)) ? t : null; });
		} else if (typeof name === 'function') {
			return this.map(name);
		} else if (this[name]) {
			return this[name](match);
		} else if (name) {
			return this.attr(name, match);
		}

		return this;
	},
	tag: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.tags, match, true) ? tiddler : null;
		});
	},
	text: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.text, match, true) ? tiddler : null;
		});
	},
	title: function(match) {
		return this.map(function(tiddler) {
			return contains(tiddler.title, match, false) ? tiddler : null;
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
				return contains(getValue(tiddler), match, false) ? tiddler : null;
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
				return contains(getValue(tiddler), match, false) ? null : tiddler;
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
	// ord is, e.g. "tags, -title" (sorts by tags asc, then by title desc), or a function (defaults to Array.prototype.sort)
	sort: function(ord) {
		var sortOrder = (typeof ord === 'string') ? ord.split(/,\s*/) : null,
			_sort = Array.prototype.sort;

		if (sortOrder) {
			return _sort.call(this, function(left, right) {
				var result = 0;
				$.each(sortOrder, function(i, field) {
					var desc = (field.charAt(0) === '-') ? true : false,
						name = (desc) ? field.slice(1) : field,
						leftVal = left[name] ||
							(left.fields && left.fields[name]) || null,
						rightVal = right[name] ||
							(right.fields && right.fields[name]) || null;

					if (typeof leftVal === 'string') {
						leftVal = leftVal.toLowerCase();
					}
					if (typeof rightVal === 'string') {
						rightVal = rightVal.toLowerCase();
					}

					if (desc) {
						result = (leftVal > rightVal) ? -1 :
							((leftVal < rightVal) ? 1 : null);
					} else {
						result = (leftVal > rightVal) ? 1 :
							((leftVal < rightVal) ? -1 : null);
					}

					if (result) {
						return false;
					}
				});

				return result;
			});
		} else {
			return _sort.call(this, ord);
		}
	},
	// return the first n tiddlers in the list
	limit: function(n) {
		var newList = Tiddlers(this.store, []),
			i, l;
		for (i = 0, l = this.length; i < n && i < l; i++) {
			newList.push(this[i]);
		}
		return newList;
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
			result = Tiddlers(self.store, []);
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
			result = Tiddlers(self.store, []);
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
			bindFunc = function() {
				fn.apply(self, arguments);
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

define('event',[],function() {

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

define('cache',[],function() {

var isLocalStorage = (function() {
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch(e) {
			return false;
		}
	}());

return {
	isCaching: isLocalStorage,
	set: function(key, tiddler) {
		if (isLocalStorage) {
			window.localStorage.setItem(key, JSON.stringify(tiddler.baseData()));
		}
	},
	get: function(key, tiddler) {
		var result, tidJSON;
		if (isLocalStorage) {
			tidJSON = window.localStorage[key];
			result = new tiddlyweb.Tiddler(tiddler.title);
			result = result.parse(JSON.parse(tidJSON));
			result.bag = tiddler.bag;
			return result;
		}
		return null;
	},
	remove: function(key) {
		if (isLocalStorage) {
			window.localStorage.removeItem(key);
		}
	},
	each: function(callback) {
		var i, l;
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
					tiddlerJSON = JSON.parse(window.localStorage[key]);
					tiddler = new tiddlyweb.Tiddler(name);
					tiddler = tiddler.parse(tiddlerJSON);
					if (bagName) {
						tiddler.bag = new tiddlyweb.Bag(bagName, '/');
					}
					if (callback(tiddler) === false) {
						break;
					}
				} catch(e) {
					// not a chrjs-store cached tiddler
				}
			};
		}
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

define('localStore',['cache'], function(cache) {
	return function(options) {
		var store = {},
			bagList = [];

		var addLastSync = (options.addLastSync !== undefined) ?
			options.addLastSync : true;

		var useCache = options.useCache;

		// returns a unique key to be used for getting/setting tiddlers directly
		var createKey = function(tiddler) {
			var bag = tiddler.bag || '';
			return encodeURIComponent(bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		};

		// make a deep copy of a tiddler
		var makeCopy = function(tiddler) {
			return $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		};

		// returns a tiddler
		// if bag is not present, search through bags until we find a match
		var get = function(tiddler) {
			var match = store[createKey(tiddler)],
				tidTester, i, l;
			if (match) {
				return makeCopy(match);
			} else if (!tiddler.bag) {
				tidTester = $.extend(new tiddlyweb.Tiddler(), tiddler);
				for (i = 0, l = bagList.length; i < l; i++) {
					tiddler.bag = bagList[i];
					match = store[createKey(tiddler)];
					if (match) {
						return makeCopy(match);
					}
				}
			}
			return null;
		};

		// set a tiddler
		var set = function(tiddler) {
			var bags = $.map(bagList, function(i, bag) {
				return bag.name;
			});

			// remove any bagless duplication
			remove(new tiddlyweb.Tiddler(tiddler.title));

			// add any previously unseen bags
			if (tiddler.bag && !~bags.indexOf(tiddler.bag.name)) {
				bagList.push(tiddler.bag);
			}

			tiddler.lastSync = (addLastSync) ? new Date() : null;
			var key = createKey(tiddler);
			store[key] = makeCopy(tiddler);

			if (useCache) {
				cache.set(key, tiddler);
			}
		};

		// remove a tiddler
		var remove = function(tiddler) {
			var key = createKey(tiddler),
				removed = store[key];

			delete store[createKey(tiddler)];
			if (useCache) {
				cache.remove(key);
			}

			return removed;
		};

		// loop over all tiddlers
		// return false to break
		var each = function(callback) {
			var key, tiddler;
			for (key in store) {
				if (store.hasOwnProperty(key)) {
					tiddler = makeCopy(store[key]);
					if (callback(tiddler, tiddler.title) === false) {
						return false;
					}
				}
			}
			return true;
		};

		// list all bags
		var bags = function() {
			return bagList;
		};

		// test whether the store is empty
		var isEmpty = function() {
			return $.isEmptyObject(store);
		};

		return {
			get: get,
			set: set,
			remove: remove,
			each: each,
			bags: bags,
			isEmpty: isEmpty
		};
	};
});

define('host',[],function() {

return function(container) {

	var defaultContainer, callbackQueue = [];

	// pullFrom = default container to refresh the store from
	// pushTo = default container to push new tiddlers to (unless otherwise specified)
	if ((container instanceof tiddlyweb.Recipe) ||
			(container instanceof tiddlyweb.Bag)) {
		defaultContainer = {
			pullFrom: container,
			pushTo: container
		};
	} else if (container) {
		defaultContainer = {
			pullFrom: container.pullFrom,
			pushTo: container.pushTo
		};
	}

	// Assume default host of /, and that a (list of) tiddler(s) is returned from / as well
	// XXX: This can probably be _vastly_ improved for non-TiddlySpace use-cases
	var determineContainerFromTiddler = function(callback) {
		$.ajax({
			url: '/?limit=1', // get a tiddler from whatever is default
			dataType: 'json',
			success: function(data) {
				var recipeName = (($.isArray(data)) ? data[0].recipe :
						data.recipe) || '',
					match = recipeName.match(/^(.+)_[^_]+$/),
					bagName;
				if (match && recipeName) {
					callback({
						pullFrom: new tiddlyweb.Recipe(recipeName, '/'),
						pushTo: new tiddlyweb.Bag(match[1] + '_public', '/')
					});
				} else if (recipeName) {
					callback({
						pullFrom: new tiddlyweb.Recipe(recipeName, '/'),
						pushTo: new tiddlyweb.Recipe(recipeName, '/')
					});
				} else {
					bagName = ($.isArray(data)) ? data[0].bag : data.bag;
					callback({
						pullFrom: new tiddlyweb.Bag(bagName, '/'),
						pushTo: new tiddlyweb.Bag(bagName, '/')
					});
				}
			},
			error: function(xhr, txtStatus, err) {
				callback(null, err, xhr);
			}
		});
	};

	// assume that /status returns a space attribute that can be used tpo figure out
	// default containers. Fallback to determineContainerFromTiddler if it doesn't
	var determineContainer = function(callback) {
		$.ajax({
			url: '/status', // expect a "space" attribute back from /status
			dataType: 'json',
			success: function(data) {
				var res = data.space;
				if (res) {
					callback({
						pullFrom: new tiddlyweb.Recipe(res.recipe, '/'),
						pushTo: new tiddlyweb.Bag(res.name + '_public', '/')
					});
				} else {
					determineContainerFromTiddler(callback);
				}
			},
			error: function(xhr, txtStatus, err) {
				determineContainerFromTiddler(callback);
			}
		});
	};

	// return default containers (callback is optional, but must be present if
	// defaultContainer hasn't been discovered yet.
	var getDefaultContainer = function(callback) {
		var returnContainer = function(container) {
			$.each(callbackQueue, function(i, fn) {
				fn(container);
			});
			callbackQueue = [];
			return container;
		};

		if (callback) {
			callbackQueue.push(callback);
		}

		if (defaultContainer) {
			return returnContainer(defaultContainer);
		} else if (callbackQueue.length === 0) {
			determineContainer(function(container) {
				defaultContainer = container;
				returnContainer(container);
			});
		}
	};

	// immediately try and figure out where we are
	getDefaultContainer();

	return {
		getDefault: getDefaultContainer
	};
};

});

define('utils',[],function() {
	// compare 2 objects (usually tiddlers) and return true if they are the same
	// note that we only care about certain properties (e.g. we don't compare functions)
	var isEqual = function(tid1, tid2) {
		for (name in tid1) {
			switch(typeof tid1[name]) {
				case 'object':
					if (!isEqual(tid1[name], tid2[name])) {
						return false;
					}
					break;
				case 'function':
					break;
				default:
					if (tid1[name] !== tid2[name]) {
						return false;
					}
					break;
			}
		}

		for (name in tid2) {
			if (typeof tid1[name] === 'undefined' &&
					typeof tid2[name] !== 'undefined') {
				return false;
			}
		}

		return true;
	};

	var chrjsError = function(name, message) {
		this.name = name;
		this.message = message;
	};
	chrjsError.prototype = new Error();
	chrjsError.prototype.constructor = chrjsError;

	// add/replace the thing in the store with the thing passed in
	// and trigger an event if it's new
	var replace = function(ev) {
		return function(store, tiddler) {
			var oldTid = store.get(tiddler), syncedDiff, unsyncedDiff;

			syncedDiff = function() {
				return (oldTid && oldTid.lastSync &&
					oldTid.revision !== tiddler.revision);
			};
			unsyncedDiff = function() {
				return (oldTid && !oldTid.lastSync && !isEqual(tiddler, oldTid));
			};

			store.set(tiddler);
			// check whether the tiddler is new/updated.
			// it _is_ if it
			// a) has a bag and no old tiddler to replace,
			// b) has a bag, an old tiddler to replace, they are both synced, and the revision numbers are different
			// c) has a bag, and old tiddler to replace, they are not synced, and they are different
			if (tiddler.bag) {
				if (!oldTid || syncedDiff() || unsyncedDiff()) {
					ev.trigger('tiddler', tiddler.title, tiddler);
				}
			}
			return true;
		};
	};

	return {
		isEqual: isEqual,
		chrjsError: chrjsError,
		replace: replace
	};
});

define('refresh',['utils'], function(utils) {

return function(ev) {
	var containers = {};

	var _removeDeleted = function(store, tiddlers) {
		var keys = $.map(tiddlers, function(tid) { return tid.bag.name + tid.title; });

		store.each(function(tiddler) {
			if (!~keys[(tiddler.bag && tiddler.bag.name) + tiddler.title]) {
				tiddler.get(function() {}, function() {
					store.remove(tiddler);
					ev.trigger('tiddler', tiddler.title, [tiddler, 'deleted']);
				});
			}
		});
	};

	var _refresh = function(obj, callback) {
		callback = callback || function() {};
		obj.tiddlers.get(function(res) {
			$.each(res, function(i, tiddler) {
				utils.replace(obj.store, tiddler);
			});
			_removeDeleted(obj.store, res);
			callback(res);
		}, function(xhr, err, errMsg) {
			callback(null, new utils.chrjsError('RefreshError',
				'Error refreshing tiddlers: ' + errMsg), xhr);
		});
	};

	return {
		refresh: function(thing, callback) {
			if (typeof thing !== 'function') {
				_refresh(thing, callback);
			} else {
				this.each(function(obj) {
					_refresh(obj, thing);
				});
			}
		},
		set: function(store, thing) {
			containers[thing.route()] = {
				tiddlers: (thing.tiddlers) ? thing.tiddlers() : thing,
				store: store
			};
		},
		each: function(callback) {
			$.each(containers, function(i, obj) {
				return callback(obj);
			});
		}
	};
};

});

define('store',['collection', 'event', 'cache', 'localStore', 'host', 'refresh', 'utils'],
	function(collection, events, cache, localStore, host, refresh, utils) {

return function(tiddlerCallback, getCached, defaultContainers) {

	var self;
	self = function(n, m) { return collection(self).find(n, m); };

	$.extend(self, {
		Collection: function() {
			var args = Array.prototype.slice.call(arguments);
			args.unshift(self);
			return collection.apply(null, args);
		},
		fn: collection.fn
	});

	var ev = events();
	$.each(ev, function(key, fn) {
		self[key] = function() {
			fn.apply(self, arguments);
			return self;
		};
	});

	var defaults = host(defaultContainers);
	$.extend(self, {
		recipe: null,
		getDefaults: function(callback) {
			// callback is optional and either gets passed or returns an object with:
			// pullFrom: default location to refresh the store from
			// pushTo: default location to save to
			var res = defaults.getDefault(function(containers) {
				self.recipe = containers.pullFrom;
				if (callback) {
					callback(containers);
				}
			});

			return (callback) ? self :  res;
		}
	});

	var containers = refresh(ev);
	self.getDefaults(function(c) { containers.set(store, c.pullFrom); });
	$.extend(self, {
		refresh: function(callback) {
			containers.refresh(function(tiddlers) {
				if (tiddlers) {
					callback.call(self, collection(self, tiddlers));
				} else {
					callback.apply(self, arguments);
				}
			});

			return self;
		},
		search: function(query, callback) {
			self.getDefaults(function(c) {
				var search = new tiddlyweb.Search(query, c.pullFrom.host);
				containers.set(store, search);
				containers.refresh(search, function(tiddlers) {
					if (tiddlers) {
						callback.call(self, collection(self, tiddlers));
					} else {
						callback.apply(self, arguments);
					}
				});
			});

			return self;
		}
	});

	var store = localStore({ addLastSync: true }),
		modified = localStore({ addLastSync: false, useCache: true }),
		isEqual = utils.isEqual,
		chrjsError = utils.chrjsError,
		replace = utils.replace(ev);

	// define a helper for extracting tiddlers out of arguments
	// returns an object containing title, modified tid, tid, rawTiddler passed in
	var getTid = function(o) {
		if (!(typeof o === 'string' || o instanceof tiddlyweb.Tiddler)) {
			return {};
		}

		var isTitleOnly = (typeof o === 'string') ? true : false,
			tid = (isTitleOnly) ? new tiddlyweb.Tiddler(o) : o,
			res = {};

		res.modified = modified.get(tid);
		res.title = tid.title;
		res.rawTiddler = tid;

		res.tiddler = res.modified || store.get(tid) ||
			((!isTitleOnly) ? o : null);

		return res;
	};

	// returns the tiddler, either directly if no callback, or fresh from the server inside the callback if given
	// returns pending first, then in recipe order (ie last bag first) if > 1 exist
	// render sets the render=1 flag on the GET request, server forces the function to return the server version
	self.get = function(tiddler, callback, render, server) {
		var args = getTid(tiddler);

		var success = function(t) {
			replace(store, t);
			callback.call(self, t);
		};
		var error = function(xhr, err, errMsg) {
			callback.call(self, null, new chrjsError('GetTiddlerError',
				'Error getting tiddler: ' + errMsg), xhr);
		};

		if (args.tiddler && server && !args.modified) {
			args.tiddler = store.get(args.tiddler);
		}

		if (!callback) {
			return args.tiddler;
		} else if (!server && args.modified) {
			callback.call(self, args.tiddler);
		} else if (args.tiddler) {
			args.tiddler.get(success, error, (render) ? 'render=1' : '');
		} else if (callback && args.title) {
			self.getDefaults(function(container) {
				var tid = new tiddlyweb.Tiddler(args.title, container.pullFrom);
				tid.get(success, error);
			});
		}

		return self;
	};

	// loops over every tiddler and calls callback with them
	self.each = function(callback) {
		$.each([modified, store], function(i, storeObj) {
			return storeObj.each(callback);
		});

		return self;
	};

	// add a tiddler to the store. Adds to pending (and localStorage).  will add whether a tiddler exists or not. Won't save until save
	// if bag is not present, will set bag to defaultContainer.pushTo
	// (which defaults to public bag)
	// if tiddler already in store[bag], will remove until saved to server
	self.add = function(tiddler) {
		var saveLocal = function(tiddler) {
			replace(modified, tiddler);
		};

		if (!tiddler.bag) {
			// save locally without a bag, and add the bag ASAP
			saveLocal(tiddler);
			self.getDefaults(function(containers) {
				tiddler.bag = containers.pushTo;
				saveLocal(tiddler);
			});
		} else {
			saveLocal(tiddler);
		}

		return self;
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending
	// tiddler should be a tiddlyweb.Tiddler to save just that tiddler directly, or a callback to save all tiddlers in pending
	self.save = function(tiddler, cllbck) {
		var args = getTid(tiddler),
			callback = (args.tiddler) ? (cllbck || function() {}) :
				(tiddler || function() {}),
			tiddler = args.modified || args.rawTiddler;

		var saveTiddler;
		saveTiddler = function(tiddler, callback) {
			var preSave = modified.get(tiddler);
			if (!tiddler.bag && !tiddler.recipe) {
				self.getDefaults(function(containers) {
					tiddler.bag = containers.pushTo;
					saveTiddler(tiddler, callback);
				});
				return;
			}
			tiddler.put(function(response) {
				if (isEqual(preSave, modified.get(tiddler))) {
					modified.remove(tiddler);
				}
				replace(store, response);
				callback(response);
			}, function(xhr, err, errMsg) {
				var currModified = modified.get(tiddler);
				if (!currModified || (!isEqual(preSave, tiddler) &&
						isEqual(preSave, currModified))) {
					// put it back (if it hasn't already been replaced)
					replace(modified, tiddler);
				}
				callback(null, new chrjsError('SaveError',
					'Error saving ' + tiddler.title + ': ' + errMsg), xhr);
			});
		};

		if (tiddler) {
			saveTiddler(tiddler, callback);
			return self;
		}

		if (!modified.isEmpty()) {
			modified.each(function(tiddler) {
				saveTiddler(tiddler, callback);
			});
		} else {
			callback(null, new chrjsError('EmptyError', 'Nothing to save'));
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

		$.extend(options, getTid(options.tiddler));

		if (options.tiddler) {
			if (options.pending && options.modified) {
				modified.remove(options.tiddler);
			}
			if (options.server && (options.tiddler.bag ||
					options.tiddler.recipe)) {
				options.tiddler['delete'](function(tiddler) {
					store.remove(tiddler);
					self.trigger('tiddler', tiddler.title, [tiddler, 'deleted']);
					options.callback(tiddler);
				}, function(xhr, err, errMsg) {
					options.callback((options.pending) ? options.tiddler : null,
						new chrjsError('DeleteError',
							'Error deleting ' + options.tiddler.title + ': '
							+ errMsg), xhr);
				});
			} else {
				self.trigger('tiddler', options.tiddler.title, [options.tiddler,
					'deleted']);
				options.callback(options.tiddler);
			}
		}

		return self;
	};

	self.retrieveCached = function() {
		cache.each(function(tiddler) {
			replace(modified, tiddler);
		});

		return self;
	};

	if (getCached || getCached === undefined) {
		self.retrieveCached();
	}

	// make sure we get everything we can from xhrs
	$.ajaxSetup({
		beforeSend: function(xhr) {
			xhr.setRequestHeader("X-ControlView", "false");
		}
	});

	if (tiddlerCallback) {
		self.refresh(tiddlerCallback);
	}

	return self;
};

});

require(['store'], function(store) {

	window.tiddlyweb.Store = store;

});

