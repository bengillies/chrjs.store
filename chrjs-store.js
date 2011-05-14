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
			type: 'private' // private or public (aka r/w or read only)
		},
		binds = {
			recipe: { all: [] },
			bag: { all: [] },
			tiddler: { all: [] }
		},
		// construct an ID for use in localStorage
		getStorageID = function(tiddler) {
			return encodeURIComponent(tiddler.bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		},
		// wrap a bag in an object to store tiddlers in
		resource = function(thing) {
			return {
				thing: thing, // bag object
				tiddlers: (thing instanceof tiddlyweb.Tiddler) ? null : {}
			};
		},
		// add/replace the thing in the store object with the thing passed in.
		// different to addTiddler, which only adds to pending
		replace = function(thing) {
			if (thing instanceof tiddlyweb.Tiddler) {
				// add the tiddler to the appropriate place in the store. If it comes with a new bag, add that as well
				var bagName = thing.bag.name,
					oldBag = (!store[bagName]) ? !replace(new Bag(bagName, '/')) :
						store[bagName],
					oldRevision = (!oldBag ||
						!oldBag.tiddlers[thing.title]) ? null :
						oldBag.tiddlers[thing.title].revision;
				store[bagName].tiddlers[thing.title] = thing;
				if (thing.revision !== oldRevision) {
					self.trigger('tiddler', null, thing);
					self.trigger('tiddler', thing.title, thing);
				}
				return true;
			} else if (thing instanceof tiddlyweb.Bag) {
				if (store[thing.name]) {
					store[thing.name].thing = thing;
				} else {
					store[thing.name] = resource(thing);
				}
				self.trigger('bag', null, thing);
				self.trigger('bag', thing.name, thing);
				return true;
			}
			return false;
		},
		store = {};

	// public variables
	self.recipe = null;
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
					store[bag[0]] = resource(new tiddlyweb.Bag(bag[0], '/'));
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
			if (!$.isEmptyObject(store)) {
				self.refreshBags();
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (!$.isEmptyObject(store)) {
			$.each(store, function(i, oldBag) {
				oldBag.thing.get(function(bag) {
					replace(bag);
				}, function(xhr, err, errMsg) {
					// trigger anyway...
					replace(oldBag.thing);
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
					replace(tiddler);
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
				self.refreshTiddlers();
			}
			self.unbind('recipe', null, recipeComplete);
		};
		if (bag && store[bag.name]) {
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
	// returns pending first, then in recipe order (ie last bag first) if > 1 exist
	self.getTiddler = function(tiddlerName, callback) {
		var pending = self.pending[tiddlerName] || null,
			tiddler = (function() {
				var tiddler = pending;
				if (tiddler) {
					return tiddler;
				}
				self.each(function(tid, title) {
					if (title === tiddlerName) {
						tiddler = tid;
						return false;
					}
				});
				return tiddler;
			})(),
			skinny = (typeof(callback) === 'function') ? false : true;
		if (skinny) {
			return tiddler;
		} else if (pending) {
			callback(pending);
		} else if (tiddler) {
			tiddler.get(function(tid) {
				replace(tid);
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

	// return the bag, as with getTiddler
	self.getBag = function(bagName, callback) {
		var skinny = (typeof callback === 'undefined') ? true : false,
			result = null;
		self.each('bag', function(bag, name) {
			if (name === bagName) {
				result = bag;
				return false;
			}
		});
		if (skinny) {
			return result;
		} else {
			callback(result);
			return self;
		}
	};

	// loops over every thing (tiddler (default) or bag) and calls callback with them
	self.each = function(thing, cllbck) {
		var callback = (typeof thing === 'function') ? thing : cllbck,
			loopTiddlers = (thing === 'bag') ? false : true,
			loopOver = function(list, callback) {
				var finished = true;
				for (name in list) {
					if (list.hasOwnProperty(name)) {
						if (callback(list[name], name) === false) {
							finished = false;
							break;
						}
					}
				}
				return finished;
			};
		// loop over pending first
		if (loopTiddlers && !loopOver(self.pending, callback)) {
			return self;
		}
		loopOver(store, function(bag, bagName) {
			if (loopTiddlers) {
				if (!loopOver(store[bagName].tiddlers, callback)) {
					return false;
				}
			} else {
				if (callback(bag.thing, bagName) === false) {
					return false;
				}
			}
		});

		return self;
	};

	// add a tiddler to the store. Adds to pending (and localStorage).  will add whether a tiddler exists or not. Won't save until save
	// if bag is not present, will set bag to <space_name> + _public
	// if tiddler already in store[bag], will remove until saved to server
	self.addTiddler = function(tiddler) {
		var saveLocal = function(tiddler) {
				if ('localStorage' in window) {
					localStorageID = getStorageID(tiddler);
					window.localStorage.setItem(localStorageID,
						tiddler.toJSON());
				}
			},
			removeCached = function(tiddler) {
				if (store[tiddler.bag.name] &&
						store[tiddler.bag.name][tiddler.title]) {
					delete store[tiddler.bag.name][tiddler.title];
				}
			},
			localStorageID;
		self.pending[tiddler.title] = tiddler;

		if (!tiddler.bag) {
			self.getSpace(function(space) {
				var bagName = space.name + '_public';
				tiddler.bag = self.getBag(bagName);
				saveLocal(tiddler);
				removeCached(tiddler);
			});
		} else {
			saveLocal(tiddler);
			removeCached(tiddler);
		}

		return self;
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending
	self.save = function(callback) {
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
			replace(response);
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
