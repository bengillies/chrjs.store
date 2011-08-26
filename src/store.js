define(['filter', 'event', 'cache', 'localStore'], function(filter, events, cache, localStore) {

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
		// set up the local store objects
		store = localStore({ addLastSync: true }),
		modified = localStore({ addLastSync: false }),
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

		return allTiddlers;
	};
	self.recipe = null;

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
		var pending = ((tid instanceof tiddlyweb.Tiddler) ? modified.get(tid) :
				modified.get(new tiddlyweb.Tiddler(tid))) || null,
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
			return tiddler;
		} else if (!server && pending) {
			callback.call(self, tiddler);
		} else if (tiddler) {
			tiddler.get(function(t) {
				replace(t);
				callback.call(self, t);
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
		$.each(modified.list(), function(title, tiddler) {
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
			cache.remove(tiddler);
			cache.set(tiddler);
			modified.set(tiddler);
			if (tiddler.bag) {
				self.trigger('tiddler', tiddler.title, tiddler);
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
				modified.remove(tiddler); // delete now so that changes made during save are kept
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
					if (!modified.get(tiddler)) {
						// there was an error, so put it back (if it hasn't already been replaced)
						modified.set(tiddler);
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

		$.each(modified.list(), function(i, tiddler) {
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
				modified.remove(options.tiddler);
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
			$.each(tiddlers, function(i, tiddler) {
				store.set(tiddler);
			});

			callback(tiddlers);
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
