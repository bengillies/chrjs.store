define(['filter', 'event', 'cache', 'localStore', 'host'],
	function(filter, events, cache, localStore, host) {

return function(tiddlerCallback, getCached, defaultContainers) {
	if (getCached === undefined) {
		getCached = true;
	}

	var self,
		// private
		// setup the bind/unbind module
		ev = events(),
		// set up the default locations to get/put stuff to/from
		defaults = host(defaultContainers),
		// set up the local store objects
		store = localStore({ addLastSync: true }),
		modified = localStore({ addLastSync: false, useCache: true }),
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
		// compare 2 objects (usually tiddlers) and return true if they are the same
		// note that we only care about certain properties (e.g. we don't compare functions)
		isEqual = function(tid1, tid2) {
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
		},
		replace;
	// add/replace the thing in the store object with the thing passed in.
	// different to add, which only adds to pending
	// storeObj is the store in which we want to replace the tiddler
	replace = function(storeObj, tiddler) {
		var oldTid = storeObj.get(tiddler), syncedDiff, unsyncedDiff;

		syncedDiff = function() {
			return (oldTid && oldTid.lastSync &&
				oldTid.revision !== tiddler.revision);
		};
		unsyncedDiff = function() {
			return (oldTid && !oldTid.lastSync && !isEqual(tiddler, oldTid));
		};

		storeObj.set(tiddler);
		// check whether the tiddler is new/updated.
		// it _is_ if it a) has a bag and no old tiddler to replace,
		// b) has a bag, an old tiddler to replace, they are both synced, and the revision numbers are different
		// c) has a bag, and old tiddler to replace, they are not synced, and they are different
		if (tiddler.bag) {
			if (!oldTid || syncedDiff() || unsyncedDiff()) {
				self.trigger('tiddler', tiddler.title, tiddler);
			}
		}
		return true;
	};

	// create an error object
	var chrjsError = function(name, message) {
		this.name = name;
		this.message = message;
	};
	chrjsError.prototype = new Error();
	chrjsError.prototype.constructor = chrjsError;

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
	}

	// public variables
	var _constructor = function(name, match) {
		var allTiddlers = self.Collection();

		self.each(function(tiddler) {
			allTiddlers.push(tiddler);
		});

		return allTiddlers.find(name, match);
	};
	// This is the constructor function. The API gets attached to this.
	// NB: it's one line so that it doesn't take up too much space when
	// logged to the console in Chrome.
	self = function() { return _constructor.apply(this, arguments); };

	self.recipe = null;

	// public functions

	// add the filter constructor in case people want to make collections manually
	self.Collection = function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(self);
		return filter.apply(null, args);
	};
	// let filter be extensible
	self.fn = filter.fn;

	// takes in a callback. calls callback with an object consisting of:
	// pullFrom: default location to refresh the store from
	// pushTo: default location to save to
	self.getDefaults = function(callback) {
		var res = defaults.getDefault(function(containers) {
			self.recipe = containers.pullFrom;
			if (callback) {
				callback(containers);
			}
		});

		return (callback) ? res : self;
	};

	// add the eventing system
	$.each(ev, function(key, func) {
		self[key] = function() {
			func.apply(self, arguments);

			return self;
		};
	});

	// refresh tiddlers contained in the recipe.
	self.refresh = function(callback) {
		var getTiddlersSkinny = function(container) {
			container.tiddlers().get(function(result) {
				var tiddlers = self.Collection(result).each(function(tiddler) {
					replace(store, tiddler);
				});
				removeDeleted(container, tiddlers);
				if (callback) {
					callback.call(self, tiddlers);
				}
			}, function(xhr, err, errMsg) {
				callback(null, new chrjsError('RetrieveTiddlersError',
					'Error getting tiddlers: ' + errMsg), xhr);
			});
		};

		self.getDefaults(function(containers) {
			getTiddlersSkinny(containers.pullFrom);
		});

		return self;
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
		var continueLoop = true;
		modified.each(function(tiddler) {
			continueLoop = callback(tiddler, tiddler.title);
			return continueLoop;
		});

		if (continueLoop || typeof continueLoop === 'undefined') {
			store.each(function(tiddler) {
				return callback(tiddler, tiddler.title);
			});
		}

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

		var saveTiddler = function(tiddler, callback) {
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

		if (!options.tiddler) {
			return self;
		} else {
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

	// search for some tiddlers and add the results to the store.
	// callback fires when the search returns.
	// query is a string appended to the url as /search?q=<query>
	self.search = function(query, callback) {
		self.getDefaults(function(c) {
			var searchObj = new tiddlyweb.Search(query, c.pullFrom.host);
			searchObj.get(function(tiddlers) {
				$.each(tiddlers, function(i, tiddler) {
					store.set(tiddler);
				});

				callback(filter(self, tiddlers));
			}, function(xhr, err, errMsg) {
				callback(null, {
					name: 'SearchError',
					message: 'Error retrieving tiddlers from search: ' + errMsg
				}, xhr);
			});
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
		cache.each(function(tiddler) {
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
