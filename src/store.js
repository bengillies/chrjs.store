define(['filter', 'event', 'cache'], function(filter, events, cache) {

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
		// format bags or tiddlers suitable for storing
		resource = function(thing, isLocal) {
			var obj;
			if (thing instanceof tiddlyweb.Bag) {
				obj = {
					thing: thing, // bag object
					tiddlers: {}
				};
			} else {
				thing.lastSync = (!isLocal) ? new Date() : null;
				obj = thing;
			}

			return obj;
		},
		store = {},
		// remove items from the store that have already been deleted on the server
		removeDeleted = function(container, tiddlers) {
			var storeTids, newTiddlers = filter(self, tiddlers),
				deleted = [];
			newTiddlers = newTiddlers.map(function(tiddler) {
				return tiddler.title;
			});

			if (container instanceof tiddlyweb.Bag) {
				storeTids = store[container.name].tiddlers;
				$.each(storeTids, function(title, tiddler) {
					if (newTiddlers.indexOf(tiddler.title) === -1) {
						deleted.push([container.name, title]);
					}
				});
			} else if (container instanceof tiddlyweb.Recipe) {
				self.each(function(tiddler, title) {
					if ((tiddler.recipe &&
							tiddler.recipe.name === container.name) &&
							(newTiddlers.indexOf(tiddler.title) === -1)) {
						deleted.push([tiddler.bag.name, title]);
					}
				});
			}
			// deleted now contains everything tht has been deleted
			$.each(deleted, function(i, toDelete) {
				var title = toDelete[1], bag = toDelete[0],
					tiddler = store[bag].tiddlers[title];
				delete store[bag].tiddlers[title];
				self.trigger('tiddler', title, [tiddler, 'deleted']);
			});
		},
		replace;
	// add/replace the thing in the store object with the thing passed in.
	// different to add, which only adds to pending
	replace = function(thing) {
		if (thing instanceof tiddlyweb.Bag) {
			if (store[thing.name]) {
				store[thing.name].thing = thing;
			} else {
				store[thing.name] = resource(thing);
			}
			self.trigger('bag', thing.name, thing);
			return true;
		} else {
			// add the tiddler to the appropriate place in the store. If it comes with a new bag, add that as well
			var bagName = thing.bag.name,
				oldBag = (!store[bagName]) ? !replace(new tiddlyweb.Bag(bagName,
					'/')) : store[bagName],
				oldRevision = (!oldBag ||
					!oldBag.tiddlers[thing.title]) ? null :
					oldBag.tiddlers[thing.title].revision;
			store[bagName].tiddlers[thing.title] = resource(thing);
			if (thing.revision !== oldRevision) {
				self.trigger('tiddler', thing.title, thing);
			}
			return true;
		}
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
			callback.call(null, {
				name: 'NotFoundError',
				message: 'Tiddler not found'
			});
		} else {
			return null;
		}

		return self;
	};

	// loops over every thing (tiddler (default) or bag) and calls callback with them
	self.each = function(thing, cllbck) {
		var callback = (typeof thing === 'function') ? thing : cllbck,
			loopTiddlers = (thing === 'bag') ? false : true,
			loopOver = function(list, callback) {
				var finished = true, name;
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
	self.add = function(tiddler) {
		var saveLocal = function(tiddler) {
			var tid;
			cache.set(tiddler);
			tid = $.extend( true, new tiddlyweb.Tiddler(), tiddler);
			self.pending[tid.title] = resource(tid, true);
			if (tiddler.bag) {
				self.trigger('tiddler', tid.title, tid);
			}
		};

		if (!tiddler.bag) {
			// save locally without a bag, and add the bag ASAP
			saveLocal(tiddler);
			self.getSpace(function(space) {
				var bagName = space.name + '_public';
				tiddler.bag = (store[bagName] && store[bagName].thing) ||
					new tiddlyweb.Bag(bagName, '/');
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
						return;
					});
				}
				tiddler.put(function(response) {
					cache.remove(tiddler);
					response = resource(response);
					replace(response);
					callback(response);
				}, function(xhr, err, errMsg) {
					if (!self.pending[tiddler.title]) {
						// there was an error, so put it back (if it hasn't already been replaced)
						self.pending[tiddler.title] = resource(tiddler, true);
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
					if (store[tiddler.bag.name]) {
						delete store[tiddler.bag.name].tiddlers[tiddler.title];
					}
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
