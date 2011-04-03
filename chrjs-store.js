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
		// private variables
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
		};

	// public variables
	self.recipe = null;
	self.bags = {};
	self.tiddlers = {};
	self.pending = {};

	// public functions
	// takes in success and error callbacks. calls success with space object containing name and type
	self.getSpace = function(success, error) {
		if (space.name !== '') {
			success(space);
		} else {
			$.ajax({
				url: '/?limit=1', // get a tiddler from whatever is default
				dataType: 'json',
				success: function(data) {
					var recipe = data[0].recipe || 'No Recipe Found',
						match = recipe.match(/^(.*)_(private|public)$/);
					if (match) {
						space.name = match[1];
						space.type = match[2];
						self.recipe = new tiddlyweb.Recipe(recipe, '/');
						success(space);
					} else {
						error({
							name: 'NoSpaceMatchError',
							message: data.recipe + ' is not a valid space'
						});
					}
				},
				error: function(xhr, txtStatus, err) {
					error(err);
				}
			});
		}
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
		if (binds[type]) {
			if (name) {
				binds[type][name + type] =
					stripCallback(binds[type][name + type]);
			} else {
				binds[type].all = stripCallback(binds[type].all);
			}
		}
	};

	// fire an event manually. message is the object that gets passed into the event handlers
	self.emit = function(type, name, message) {
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
	};

	// refresh the main recipe (i.e. the one currently being used).
	self.refreshRecipe = function() {
		if (self.recipe) {
			self.recipe.get(function(newRecipe) {
				self.recipe = newRecipe;
				$.each(self.recipe.recipe, function(i, bag) {
					self.bags[bag[0]] = new tiddlyweb.Bag(bag[0], '/');
				});
				self.emit('recipe', null, self.recipe);
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
					self.emit('bag', null, self.bags[bag.name]);
					self.emit('bag', name, self.bags[bag.name]);
				}, function(xhr, err, errMsg) {
					// emit anyway...
					self.emit('bag', null, oldBag);
					self.emit('bag', oldBag.name, oldBag);
				});
			});
		} else {
			self.bind('recipe', null, recipeComplete);
			self.refreshRecipe();
		}
	};

	// refresh tiddlers contained in the recipe. Optional bag parameter will refresh tiddlers specifically in a bag
	self.refreshTiddlers = function(bag) {
		var getTiddlersSkinny = function(obj) {
			var tiddlerCollection = obj.tiddlers();
			tiddlerCollection.get(function(tiddlers) {
				$.each(tiddlers, function(i, tiddler) {
					var oldHash = (self.tiddlers[tiddler.title] &&
							self.tiddlers[tiddler.title].fields) ?
						self.tiddlers[tiddler.title].fields._hash : null;
					self.tiddlers[tiddler.title] = tiddler;
					if (tiddler.fields._hash !== oldHash) {
						self.emit('tiddler', null, tiddler);
						self.emit('tiddler', tiddler.title, tiddler);
					}
				});
			}, function(xhr, err, errMsg) {
				throw {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddlers from ' + bagName +
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
		} else {
			if (self.recipe) {
				getTiddlersSkinny(self.recipe);
			} else {
				self.bind('recipe', null, recipeComplete);
				self.refreshRecipe();
			}
		}
	};

	// return public, private or archive when given a bag name, to determine the type of bag
	self.getBagType = function(bagName) {
		var match =  bagName.match(/.*_(private|public|archive)$/);
		if (match) {
			return match[1];
		} else {
			return null;
		}
	};

	// tiddlers are retrieved in refreshTiddlers as skinny. This calls callback with the fat version.
	self.getTiddler = function(tiddlerName, callback) {
		var tiddler = self.tiddlers[tiddlerName];
		if (tiddler) {
			tiddler.get(function(tid) {
				self.tiddlers[tid.title] = tid;
				callback(tid);
			}, function(xhr, err, errMsg) {
				throw {
					name: 'RetrieveTiddlersError',
					message: 'Error getting tiddler: ' + errMsg
				};
			});
		} else {
			callback(null);
		}
	};

	// save any tiddlers in the pending object back to the server, and remove them from pending
	self.savePending = function(callback) {
		$.each(self.pending, function(i, tiddler) {
			var title = tiddler.title;
			self.saveTiddler(tiddler, callback);
		});
	};

	// save a tiddler from pending directly by name, and remove it
	self.saveTiddler = function(tiddler, callback) {
		delete self.pending[tiddler.title];
		tiddler.put(function(response) {
			self.tiddlers[response.title] = response;
			self.emit('tiddler', null, response);
			self.emit('tiddler', response.title, response);
			callback(response);
		}, function(xhr, err, errMsg) {
			throw {
				name: 'SaveError',
				message: 'Error saving ' + tiddler.title + ': ' + errMsg
			};
		});
	};

	return self;
};

})(jQuery);
