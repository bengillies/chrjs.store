define(['filter-syntax'], function(parser) {

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
		var newList = Tiddlers(this.store),
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
