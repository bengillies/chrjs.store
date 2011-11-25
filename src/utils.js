define(function() {
	// compare 2 objects (usually tiddlers) and return true if they are the same
	// note that we only care about certain properties (e.g. we don't compare functions)
	var isEqual = function(tid1, tid2) {
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
	};

	var chrjsError = function(name, message) {
		this.name = name;
		this.message = message;
	};
	chrjsError.prototype = new Error();
	chrjsError.prototype.constructor = chrjsError;

	// add/replace the thing in the store with the thing passed in
	// and trigger an event if it's new
	var replace = function(ev) {
		return function(store, tiddler) {
			var oldTid = store.get(tiddler), syncedDiff, unsyncedDiff;

			syncedDiff = function() {
				return (oldTid && oldTid.lastSync &&
					oldTid.revision !== tiddler.revision);
			};
			unsyncedDiff = function() {
				return (oldTid && !oldTid.lastSync && !isEqual(tiddler, oldTid));
			};

			store.set(tiddler);
			// check whether the tiddler is new/updated.
			// it _is_ if it
			// a) has a bag and no old tiddler to replace,
			// b) has a bag, an old tiddler to replace, they are both synced, and the revision numbers are different
			// c) has a bag, and old tiddler to replace, they are not synced, and they are different
			if (tiddler.bag) {
				if (!oldTid || syncedDiff() || unsyncedDiff()) {
					ev.trigger('tiddler', tiddler.title, tiddler);
				}
			}
			return true;
		};
	};

	return {
		isEqual: isEqual,
		chrjsError: chrjsError,
		replace: replace
	};
});
