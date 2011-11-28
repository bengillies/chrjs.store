define(['filter'], function(parser) {

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

			return this.filter(function(t) { return (filterFunc(t)) ? t : null; });
		} else if (typeof name === 'function') {
			return this.filter(name);
		} else if (this[name]) {
			return this[name](match);
		} else if (name) {
			return this.attr(name, match);
		}

		return this;
	},
	tag: function(match) {
		return this.filter(parser.states.tag.tiddlerTest(match));
	},
	text: function(match) {
		return this.filter(parser.states.text.tiddlerTest(match));
	},
	title: function(match) {
		return this.filter(parser.states.title.tiddlerTest(match));
	},
	attr: function(name, match) {
		if (!match) {
			return this.filter(function(t) {
				return t[name] || (t.fields && t.fields[name]);
			});
		} else {
			return this.filter(parser.states.field.tiddlerTest({
				field: name,
				value: match
			}));
		}
	},
	not: function(name, match) {
		if (!match) {
			return this.filter(function(t) {
				return !(t[name] || (t.fields && t.fields[name]));
			});
		} else {
			return this.filter(parser.states.field.tiddlerTest({
				field: name,
				value: match,
				not: true
			}));
		}
	},
	bag: function(name) {
		return this.filter(function(tiddler) {
			var bag = tiddler.bag && tiddler.bag.name;
			return (bag === name) ? true : false;
		});
	},
	// the space the tiddler originates from (i.e. not just included in)
	// blank/true matches the current space, false matches everything else (i.e. non-local)
	// a string specifies the space name to match
	space: function(name) {
		var regex = /(_public|_private|_archive)$/,
			nonLocal = false,
			spaceName,
			filterFunc = parser.states.space.tiddlerTest,
			tester,
			currentSpace = function(recipe) {
				return recipe ? recipe.name.replace(regex, '') : null;
			};

		if (name === false) {
			nonLocal = true;
		} else if (typeof name === 'string') {
			tester = filterFunc(name);
		}

		if (!tester) {
			spaceName = currentSpace(this.store.recipe);
			tester = spaceName ? filterFunc(spaceName) : null;
		}

		return this.filter(function(t) {
			if (!tester) {
				tester = filterFunc(this.store.recipe || t.bag)
			}
			return (nonLocal) ? !tester(t) : tester(t);
		}, this);
	},
	// no arguments matches the default recipe
	recipe: function(name) {
		var matchCurrent = (name === undefined) ? true : false, recipe;
		if (matchCurrent) {
			recipe = this.store.recipe.name;
		}
		return this.filter(function(tiddler) {
			if (!matchCurrent) {
				recipe = tiddler.recipe && tiddler.recipe.name;
			}
			return (recipe === name) ? true : false;
		});
	},
	// tiddlers that have been changed (i.e. not synced), lastSynced is optional and if present matches tiddlers that were synced before lastSynced
	dirty: function(lastSynced) {
		if (!lastSynced) {
			return this.filter(function(tiddler) {
				return (tiddler.lastSync) ? false : true;
			});
		} else {
			return this.filter(function(tiddler) {
				if (tiddler.lastSync) {
					// return true if tiddler.lastSync is older than lastSynced
					return (+tiddler.lastSync < +lastSynced) ? true :
						false;
				} else {
					return true;
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
	// works much like ES5 .filter, but returns a new Tiddlers collection as opposed to an array
	filter: function(fn, thisArg) {
		var self = this,
			thisArg = (thisArg !== undefined) ? thisArg : self,
			res = Tiddlers(self.store, []);

		res.ast = self.ast;
		res.ast.value.push({
			type: 'function',
			value: fn
		});

		$.each(self, function(i, tiddler) {
			if (fn.call(thisArg, tiddler, i, self)) {
				res.push(tiddler);
			}
		});

		return res;
	},
	// works much like ES5 .map but returns a new Tiddlers collection as opposed to an array
	map: function(fn, thisArg) {
		var self = this,
			result = Tiddlers(self.store, []),
			thisArg = (thisArg !== undefined) ? thisArg : self;

		$.each(self, function(i, tiddler) {
			result.push(fn.call(thisArg, tiddler, i, self));
		});
		return result;
	},
	// works much like ES5 .reduce
	reduce: function(fn, init) {
		var i = (init === undefined) ? 1 : 0,
			result = (!i) ? init : this[0],
			self = this,
			l = this.length,
			tiddler;
		for (; i < l; i++) {
			tiddler = self[i];
			result = fn.call(undefined, result, tiddler, i, self);

		}
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
