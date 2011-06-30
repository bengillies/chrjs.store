define(function() {

var Tiddlers;

// the Tiddlers object is a list of tiddlers that you can operate on/filter. Get a list by calling the Store instance as a function (with optional filter)
Tiddlers = function(store, tiddlers) {
	var self = [];
	self.store = store;
	if (tiddlers) {
		$.each(tiddlers, function(i, tiddler) {
			self.push(tiddler);
		});
	}

	// private functions
	var contains = function(field, match) {
		return (field && field.indexOf(match) !== -1) ? true : false;
	};

	// public functions
	$.extend(self, {
		tag: function(match) {
			return self.map(function(tiddler) {
				return contains(tiddler.tags, match) ? tiddler : null;
			});
		},
		text: function(match) {
			return self.map(function(tiddler) {
				return contains(tiddler.text, match) ? tiddler : null;
			});
		},
		title: function(match) {
			return self.map(function(tiddler) {
				return contains(tiddler.title, match) ? tiddler : null;
			});
		},
		attr: function(name, match) {
			var chkExists = (!match) ? true : false,
				getValue = function(tiddler) {
					return tiddler[name] || (tiddler.fields &&
						tiddler.fields[name]);
				};
			return self.map(function(tiddler) {
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
			return self.map(function(tiddler) {
				if (chkExists) {
					return (getValue(tiddler)) ? null : tiddler;
				} else {
					return contains(getValue(tiddler), match) ? null : tiddler;
				}
			});
		},
		bag: function(name) {
			return self.map(function(tiddler) {
				var bag = tiddler.bag && tiddler.bag.name;
				return (bag === name) ? tiddler : null;
			});
		},
		// the space the tiddler originates from (i.e. not just included in)
		space: function(name) {
			var regex = /(_public|_private|_archive)$/;
			return self.map(function(tiddler) {
				var bag = tiddler.bag && tiddler.bag.name;
				return (bag.replace(regex, '') === name) ? tiddler : null;
			});
		},
		// no arguments matches the default recipe
		recipe: function(name) {
			var matchCurrent = (name === undefined) ? true : false, recipe;
			if (matchCurrent) {
				recipe = self.store.recipe.name;
			}
			return self.map(function(tiddler) {
				if (!matchCurrent) {
					recipe = tiddler.recipe && tiddler.recipe.name;
				}
				return (recipe === name) ? tiddler : null;
			});
		},
		// tiddlers that have been changed (i.e. not synced), lastSynced is optional and if present matches tiddlers that were synced before lastSynced
		dirty: function(lastSynced) {
			if (!lastSynced) {
				return self.map(function(tiddler) {
					return (tiddler.lastSync) ? null : tiddler;
				});
			} else {
				return self.map(function(tiddler) {
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
			$.each(self, function(i, tiddler) {
				fn.apply(self, [tiddler, i]);
			});
			return self;
		},
		// returns a new instance of Tiddlers
		map: function(fn) {
			var result = Tiddlers(self.store);
			$.each(self, function(i, tiddler) {
				var mappedTiddler = fn.apply(self, [tiddler, i]);
				if (mappedTiddler) {
					result.push(mappedTiddler);
				}
			});
			return result;
		},
		// pass in an initial value and a callback. Callback gets tiddler and current result, and returns new result
		reduce: function(init, fn) {
			var result = init;
			$.each(self, function(i, tiddler) {
				result = fn.apply(self, [tiddler, result]);
			});
			return result;
		},
		// bind fn to the current set of matched tiddlers.
		bind: function(fn) {
			var bindFunc = function(tiddler) {
					fn.apply(self, [tiddler]);
				};
			self.each(function(tiddler) {
				self.store.bind('tiddler', tiddler.title, bindFunc);
			});
			return self;
		},
		// save tiddlers currently in list. Callback happens for each tiddler
		save: function(callback) {
			$.each(self, function(i, tiddler) {
				self.store.save(tiddler, callback);
			});
			return self;
		},
		// add one or more tiddlers to the current Tiddlers object and the attached store
		add: function(tiddlers) {
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
	});

	return self;
};

return Tiddlers;

});
