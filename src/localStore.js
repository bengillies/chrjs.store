/*
 * Store tiddlers in a local object
 */

define(function() {
	return function(options) {
		var store = {},
			bagList = [];

		var addLastSync = (options.addLastSync !== undefined) ?
			options.addLastSync : true;

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
			var match = store[createKey(tiddler)];;
			if (match) {
				return makeCopy(match);
			} else {
				for (var i = 0, l = bagList.length; i < l; i++) {
					tiddler.bag = bagList[i];
					match = store[createKey(tiddler)];
					if (match) {
						tiddler.bag = undefined;
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
			delete store[createKey(new tiddlyweb.Tiddler(tiddler.title))];

			// add any previously unseen bags
			if (tiddler.bag && !~bags.indexOf(tiddler.bag.name)) {
				bagList.push(tiddler.bag);
			}

			tiddler.lastSync = (addLastSync) ? new Date() : null;
			store[createKey(tiddler)] = makeCopy(tiddler);
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
