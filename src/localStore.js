/*
 * Store tiddlers in a local object
 */

define(function() {
	return function() {
		var store = {},
			bagList = [];

		// returns a unique key to be used for getting/setting tiddlers directly
		var createKey = function(tiddler) {
			var bag = tiddler.bag;
			return encodeURIComponent(bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		};

		// returns a tiddler
		// if bag is not present, search through bags until we find a match
		var get = function(tiddler) {
			var match;
			if (tiddler.bag) {
				return store[createKey(tiddler)];
			} else {
				for (var i = 0, l = bagList.length; i < l; i++) {
					tiddler.bag = bagList[i];
					match = store[createKey(tiddler)];
					if (match) {
						tiddler.bag = undefined;
						return match;
					}
				}
			}
			return null;
		};

		// set a tiddler
		var set = function(tiddler) {
			if (!bagList[tiddler.bag.name]) {
				bagList[tiddler.bag.name] = tiddler.bag;
			}
			tiddler.lastSync = new Date();
			store[createKey(tiddler)] = tiddler;
		};

		// remove a tiddler
		var remove = function(tiddler) {
			var key = createKey(tiddler),
				removed = store[key];

			delete store[createKey(tiddler)];

			return removed;
		};

		// list all tiddlers
		var list = function() {
			var results = [];
			$.each(store, function(key, tiddler) {
				results.push(tiddler);
			});
			return results;
		}

		// list all bags
		var bags = function() {
			return bagList;
		};

		return {
			get: get,
			set: set,
			remove: remove,
			list: list,
			bags: bags
		};
	};
});
