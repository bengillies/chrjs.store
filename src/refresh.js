define(['utils'], function(utils) {

return function(ev) {
	var containers = {},
		replace = utils.replace(ev),
		sockets = typeof io !== 'undefined';

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

	// only support websockets with bags and recipes
	var _addSocket = function(sock, thing, store) {
		var getTiddler = function(uri) {
			var title = decodeURIComponent(uri.replace(/.*\//, ''));
			return new tiddlyweb.Tiddler(title, thing);
		};

		var subscribeRecipe = function(recipe) {
			$.each(recipe, function(i, bagFilterCombo) {
				sock.emit('subscribe', 'bag/' + bagFilterCombo[0]);
			});
			sock.on('tiddler', function(uri) {
				var tid = getTiddler(uri),
					bagName = decodeURIComponent(uri.split('/')[2]);
				tid.get(function(t) {
					// if it's an update for a tiddler clobbered by the recipe
					// bag stack, then ignore it
					if (t.bag.name === bagName) {
						replace(store, t);
					}
				}, function() {});
			});
		};

		if (thing instanceof tiddlyweb.Recipe) {
			if (thing.recipe.length === 0) {
				thing.get(function(recipe) {
					subscribeRecipe(recipe.recipe);
				}, function() {}); // fail silently
			} else {
				subscribeRecipe(thing.recipe);
			}
		} else if (thing instanceof tiddlyweb.Bag) {
			sock.emit('subscribe', 'bag/' + thing.name);
			sock.on('tiddler', function(uri) {
				var tid = getTiddler(uri);
				tid.get(function(t) {
					replace(store, t);
				}, function() {}); // if error, then ignore the notification
			});
		}
	};

	// feature detect websockets and only use if they exist
	var addSocket = (sockets) ? function(thing, store) {
			var sock = io.connect(window.location.protocol + '//' +
				window.location.hostname + ':8081');
			sock.on('connect', function() {
				_addSocket(sock, thing, store);
			});
		} : function() {};

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
			addSocket(thing, store);
		},
		each: function(callback) {
			$.each(containers, function(i, obj) {
				return callback(obj);
			});
		}
	};
};

});
