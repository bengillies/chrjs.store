/*
 * A store object, using the chrjs library.
 *
 * mechanisms to interact with tiddlers, bags, recipes, etc on TiddlySpace
 * and mechanisms to refresh those things and keep them up to date in the
 * browser.
 *
 * Dependencies: chrjs, jQuery
 *
 * Written by Ben Gillies
 */

(function($) {

tiddlyweb.Store = function() {
	var self = (this instanceof tiddlyweb.Store) ? this : new tiddlyweb.Store(),
		// private
		space = {
			name: '',
			type: 'private'
		},
		routes = null,
		binds = {
			recipe: {
				all: []
			},
			bag: {
				all: []
			},
			tiddler: {
				all: []
			}
		},
		getStorageID = function(tiddler) {
			return encodeURIComponent(tiddler.bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		};

	// public variables
	self.recipe = null;
	self.bags = {};
	self.tiddlers = {};
	self.pending = {};

	// public functions

	// takes in a  callback. calls callback with space object containing name and type or error
	self.getSpace = function(callback) {
		if (space.name !== '') {
			callback(space);
		} else {
			$.ajax({
				url: '/?limit=1', // get a tiddler from whatever is default
				dataType: 'json',
				success: function(data) {
					var recipeName = data[0].recipe || 'No Recipe Found',
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
					callback(null, err);
				}
			});
		}

		return self;
	};

	// takes thing to bind to (e.g. 'tiddler'), optional name (e.g. tiddler title), and callback that fires whenever object updates.
	// if name not present, then callbck fires whenever any object of that type updates.
	self.bind = function(type, name, callback) {
		if (binds[type]) {
			if (name) {
				if (!binds[type][name + type]) {
					binds[type][name + type] = [];
				}
				binds[type][name + type].push(callback);
			} else {
				binds[type].all.push(callback);
			}
		}

		return self;
	};

	// same input as bind, though name and callback both optional. If callback present, any function the same (i.e. ===) as callback
	// will be removed.
	self.unbind = function(type, name, callback) {
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
		if ((binds[type]) && (name)) {
				binds[type][name + type] =
					stripCallback(binds[type][name + type]);
		} else {
			binds[type].all = stripCallback(binds[type].all);
		}

		return self;
	};

	// fire an event manually. message is the object that gets passed into the event handlers
	self.trigger = function(type, name, message) {
		if (binds[type]) {
			$.each(binds[type].all, function(i, func) {
				func(message);
			});
			if (name && binds[type][name + type]) {
				$.each(binds[type][name + type], function(i, func) {
					func(message);
				});
			}
		}

		return self;
	};

	// refresh the main recipe (i.e. the one currently being used).
	self.refreshRecipe = function() {
		if (self.recipe) {
			self.recipe.get(function(newRecipe) {
				self.recipe = newRecipe;
				$.each(self.recipe.recipe, function(i, bag) {
					self.bags[bag[0]] = new tiddlyweb.Bag(bag[0], '/');
				});
				self.trigger('recipe', null, self.recipe);
			}, function(xhr, err, errMsg) {
				// ignore
			});
		} else {
			self.getSpace(function() {
				if (self.recipe) {
					self.refreshRecipe();
				}
			});
		}

		return self;
	};

	// refresh the bags contained in the recipe. it is likely that some will return 403. This is expected
	self.refreshBags = function() {
		var recipeComplete = function() {
			if (!$.isEmptyObject(self.bags)) {
				self.refreshBags();
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (!$.isEmptyObject(self.bags)) {
			$.each(self.bags, function(i, oldBag) {
				oldBag.get(function(bag) {
					self.bags[bag.name] = bag;
					self.trigger('bag', null, self.bags[bag.name]);
					self.trigger('bag', name, self.bags[bag.name]);
				}, function(xhr, err, errMsg) {
					// trigger anyway...
					self.trigger('bag', null, oldBag);
					self.trigger('bag', oldBag.name, oldBag);
				});
			});
		} else {
			self.bind('recipe', null, recipeComplete);
			self.refreshRecipe();
		}

		return self;
	};

	// refresh tiddlers contained in the recipe. Optional bag parameter will refresh tiddlers specifically in a bag
	self.refreshTiddlers = function(bag) {
		var getTiddlersSkinny = function(container) {
			var tiddlerCollection = container.tiddlers();
			tiddlerCollection.get(function(result) {
				$.each(result, function(i, tiddler) {
					var oldRevision= (self.tiddlers[tiddler.title]) ?
						self.tiddlers[tiddler.title].revision : null;
					self.tiddlers[tiddler.title] = tiddler;
					if (tiddler.revision !== oldRevision) {
						self.trigger('tiddler', null, tiddler);
						self.trigger('tiddler', tiddler.title, tiddler);
					}
				});
			}, function(xhr, err, errMsg) {
				throw {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddlers from ' + bag.name +
						': ' + errMsg
				};
			});
		},
		recipeComplete = function() {
			if (self.recipe) {
				self.refreshTiddlers(self.recipe);
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (bag && self.bags[bag]) {
			getTiddlersSkinny(bag);
		} else if (self.recipe) {
			getTiddlersSkinny(self.recipe);
		} else {
			self.bind('recipe', null, recipeComplete);
			self.refreshRecipe();
		}

		return self;
	};

	// returns the tiddler, either directly if no callback, or fresh from the server inside the callback if given
	self.getTiddler = function(tiddlerName, callback) {
		var pending = self.pending[tiddlerName] || null,
			tiddler = pending || self.tiddlers[tiddlerName] || null,
			skinny = (typeof(callback) === 'function') ? false : true;
		if (skinny) {
			return tiddler;
		} else if (pending) {
			callback(pending);
		} else if (tiddler) {
			tiddler.get(function(tid) {
				self.tiddlers[tid.title] = tid;
				callback(tid);
			}, function(xhr, err, errMsg) {
				callback(null, {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddler: ' + errMsg
				});
			});
		} else {
			callback(null);
		}
		return self;
	};

	// loops over every thing (tiddler (default) or bag) and calls callback with them
	self.each = function(thing, cllbck) {
		var thingIsCallback = (typeof thing === 'function');
			callback = (thingIsCallback) ? thing : cllbck,
			list = (!thingIsCallback && ['bag', 'tiddler'].indexOf(thing) !== -1) ?
				thing + 's' : 'tiddlers';
		for (title in self[list]) {
			if (self[list].hasOwnProperty(title)) {
				callback(self[list][title], title);
			}
		}

		return self;
	};

	// add a tiddler to the store. Adds to pending (and localStorage).  will add whether a tiddler exists or not. Won't save until savePending
	// if bag is not present, will set bag to <space_name> + _public
	self.addTiddler = function(tiddler) {
		var saveLocal = function(tiddler) {
				if ('localStorage' in window) {
					localStorageID = getStorageID(tiddler);
					window.localStorage.setItem(localStorageID,
						tiddler.toJSON());
				}
			},
			localStorageID;
		self.pending[tiddler.title] = tiddler;

		if (!tiddler.bag) {
			self.getSpace(function(space) {
				var bagName = space.name + '_public';
				tiddler = self.bags[bagName];
				saveLocal(tiddler);
			});
		} else {
			saveLocal(tiddler);
		}

		return self;
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending
	self.savePending = function(callback) {
		var empty = true;
		$.each(self.pending, function(i, tiddler) {
			var title = tiddler.title;
			if (empty) {
				empty = false;
			}
			self.saveTiddler(tiddler, callback);
		});
		if (empty) {
			callback(null, {
				name: 'EmptyError',
				message: 'Nothing to save'
			});
		}

		return self;
	};

	// save a tiddler from pending directly by name, and remove it
	self.saveTiddler = function(tiddler, callback) {
		delete self.pending[tiddler.title]; // delete now so that changes made during save are kept
		tiddler.put(function(response) {
			if ('localStorage' in window) {
				window.localStorage.removeItem(getStorageID(tiddler));
			}
			self.tiddlers[response.title] = response;
			self.trigger('tiddler', null, response);
			self.trigger('tiddler', response.title, response);
			callback(response);
		}, function(xhr, err, errMsg) {
			if (!self.pending[tiddler.title]) {
				self.pending[tiddler.title] = tiddler;
			}
			callback(null, {
				name: 'SaveError',
				message: 'Error saving ' + tiddler.title + ': ' + errMsg
			});
		});

		return self;
	};

	// import pending from localStorage
	self.retrieveCached = function() {
		if ('localStorage' in window) {
			$.each(window.localStorage, function(i) {
				var key = window.localStorage.key(i),
					names = key.split('/'),
					bagName = decodeURIComponent(names[0]),
					name = decodeURIComponent(names[1]),
					tiddlerJSON = $.parseJSON(window.localStorage[key]),
					tiddler = new tiddlyweb.Tiddler(name);
				tiddler.bag = new tiddlyweb.Bag(bagName, '/');
				$.extend(tiddler, tiddlerJSON);
				self.addTiddler(tiddler, true);
				self.trigger('tiddler', null, tiddler);
				self.trigger('tiddler', name, tiddler);
			});
		}

		return self;
	};

	return self;
};

})(jQuery);
