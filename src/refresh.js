define(['utils'], function(utils) {

return function(ev) {
	var containers = {};
	var replace = utils.replace(ev);

	var _removeDeleted = function(store, tiddlers) {
		var keys = $.map(tiddlers, function(tid) { return tid.bag.name + tid.title; });

		store.each(function(tiddler) {
			if (!~keys[(tiddler.bag && tiddler.bag.name) + tiddler.title]) {
				tiddler.get(function() {}, function() {
					store.remove(tiddler);
					ev.trigger('tiddler', tiddler.title, [tiddler, 'deleted']);
				});
			}
		});
	};

	var _refresh = function(obj, callback) {
		callback = callback || function() {};
		obj.tiddlers.get(function(res) {
			$.each(res, function(i, tiddler) {
				replace(obj.store, tiddler);
			});
			_removeDeleted(obj.store, res);
			callback(res);
		}, function(xhr, err, errMsg) {
			callback(null, new utils.chrjsError('RefreshError',
				'Error refreshing tiddlers: ' + errMsg), xhr);
		});
	};

	return {
		refresh: function(thing, callback) {
			if (typeof thing !== 'function') {
				_refresh(thing, callback);
			} else {
				this.each(function(obj) {
					_refresh(obj, thing);
				});
			}
		},
		set: function(store, thing) {
			containers[thing.route()] = {
				tiddlers: (thing.tiddlers) ? thing.tiddlers() : thing,
				store: store
			};
		},
		each: function(callback) {
			$.each(containers, function(i, obj) {
				return callback(obj);
			});
		}
	};
};

});
