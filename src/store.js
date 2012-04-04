define(['collection', 'event', 'cache', 'localStore', 'host', 'refresh', 'utils'],
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

	var defaults = host(defaultContainers),
		containers = refresh(ev);
	$.extend(self, {
		recipe: null,
		getDefaults: function(callback) {
			// callback is optional and either gets passed or returns an object with:
			// pullFrom: default location to refresh the store from
			// pushTo: default location to save to
			var res = defaults.getDefault(function(defaults) {
				self.recipe = defaults.pullFrom;
				containers.set(store, defaults.pullFrom);
				if (callback) {
					callback(defaults);
				}
			});

			return (callback) ? self :  res;
		}
	});

	$.extend(self, {
		refresh: function(callback) {
			self.getDefaults(function() {
				containers.refresh(function(tiddlers) {
					if (tiddlers) {
						callback.call(self, collection(self, tiddlers));
					} else {
						callback.apply(self, arguments);
					}
				});
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
		res.store = store.get(tid);
		res.title = tid.title;
		res.rawTiddler = (!isTitleOnly) ? o : undefined;

		res.tiddler = res.modified || res.store || ((!isTitleOnly) ? o : null);

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
				tid.get(success, error, (render) ? 'render=1' : '');
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
			callback = cllbck || tiddler || function() {},
			tiddler = args.rawTiddler || args.modified;

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

	// remove a tiddler, locally from modified.
	self.remove = function(tiddler) {
		var tid = getTid(tiddler);

		if (tid.modified) {
			modified.remove(tid.modified);
			self.trigger('tiddler', tid.modified.title,
				[tid.modified, 'deleted']);
			return tid.modified;
		}

		return null;
	};

	// delete a tiddler from the server, and store, and modified (if it exists)
	self.destroy = function(tiddler, callback) {
		var tid = getTid(tiddler),
			_remove = function(tiddler) {
				store.remove(tiddler);
				if (tid.modified) {
					self.remove(tid.modified);
				}
				self.trigger('tiddler', tiddler.title, [tiddler, 'deleted']);
				callback(tiddler);
			};

		if (tid.store && (tid.store.bag || tid.store.recipe)) {
				tid.store['delete'](_remove, function(xhr, err, errMsg) {
					callback(null, new chrjsError('DeleteError',
							'Error deleting ' + tid.tiddler.title + ': '
							+ errMsg), xhr);
				});
		} else if (tid.modified) {
			_remove(tid.modified);
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
		self.getDefaults(function(c) {
			containers.set(store, c.pullFrom);
			self.refresh(tiddlerCallback);
		});
	}

	return self;
};

});
