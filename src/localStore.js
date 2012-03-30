/*
 * Store tiddlers in a local object
 */

define(['cache'], function(cache) {
	return function(options) {
		var store = {},
			bagList = [];

		var addLastSync = (options.addLastSync !== undefined) ?
			options.addLastSync : true;

		var useCache = options.useCache;

		// returns a unique key to be used for getting/setting tiddlers directly
		var createKey = function(tiddler) {
			var bag = tiddler.bag || '';
			return encodeURIComponent(bag.name) + '/' +
				encodeURIComponent(tiddler.title);
		};

		// make a deep copy of a tiddler
		var makeCopy = function(tiddler) {
			return $.extend(true, new tiddlyweb.Tiddler(), tiddler);
		};

		// returns a tiddler
		// if bag is not present, search through bags until we find a match
		var get = function(tiddler) {
			var match = store[createKey(tiddler)],
				tidTester, i, l;
			if (match) {
				return makeCopy(match);
			} else if (!tiddler.bag) {
				tidTester = $.extend(new tiddlyweb.Tiddler(), tiddler);
				for (i = 0, l = bagList.length; i < l; i++) {
					tidTester.bag = bagList[i];
					match = store[createKey(tidTester)];
					if (match) {
						return makeCopy(match);
					}
				}
			}
			return null;
		};

		// set a tiddler
		var set = function(tiddler) {
			var bags = $.map(bagList, function(i, bag) {
				return bag.name;
			});

			// remove any bagless duplication
			remove(new tiddlyweb.Tiddler(tiddler.title));

			// add any previously unseen bags
			if (tiddler.bag && !~bags.indexOf(tiddler.bag.name)) {
				bagList.push(tiddler.bag);
			}

			tiddler.lastSync = (addLastSync) ? new Date() : null;
			var key = createKey(tiddler);
			store[key] = makeCopy(tiddler);

			if (useCache) {
				cache.set(key, tiddler);
			}
		};

		// remove a tiddler
		var remove = function(tiddler) {
			var key = createKey(tiddler),
				removed = store[key];

			delete store[createKey(tiddler)];
			if (useCache) {
				cache.remove(key);
			}

			return removed;
		};

		// loop over all tiddlers
		// return false to break
		var each = function(callback) {
			var key, tiddler;
			for (key in store) {
				if (store.hasOwnProperty(key)) {
					tiddler = makeCopy(store[key]);
					if (callback(tiddler, tiddler.title) === false) {
						return false;
					}
				}
			}
			return true;
		};

		// list all bags
		var bags = function() {
			return bagList;
		};

		// test whether the store is empty
		var isEmpty = function() {
			return $.isEmptyObject(store);
		};

		return {
			get: get,
			set: set,
			remove: remove,
			each: each,
			bags: bags,
			isEmpty: isEmpty
		};
	};
});
