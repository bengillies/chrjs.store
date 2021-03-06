define(function() {

return function() {
	var binds = {
		recipe: { all: [] },
		bag: { all: [] },
		tiddler: { all: [] },
		filter: []
	};

	var result = {
		// takes thing to bind to (e.g. 'tiddler'), optional name (e.g. tiddler title), and callback that fires whenever object updates.
		// if name not present, then callbck fires whenever any object of that type updates.
		bind: function(type, name, callback) {
			if (type === 'filter') {
				binds.filter.push({ test: name, callback: callback });
			} else if (binds[type]) {
				if (name) {
					if (!binds[type][name + type]) {
						binds[type][name + type] = [];
					}
					binds[type][name + type].push(callback);
				} else {
					binds[type].all.push(callback);
				}
			}
		},

		// same input as bind, though name and callback both optional. If callback present, any function the same (i.e. ===) as callback
		// will be removed.
		unbind: function(type, name, callback) {
			var stripCallback = function(list) {
				if (callback) {
					$.each(list, function(i, func) {
						if (callback === func) {
							list.splice(i, 1);
						}
					});
					return list;
				} else {
					return [];
				}
			};
			if (type === 'filter') {
				$.each(binds.filter, function(i, obj) {
					if (obj.test === callback) {
						binds.filter.splice(i, 1);
					}
				});
			} else if ((binds[type]) && (name)) {
					binds[type][name + type] =
						stripCallback(binds[type][name + type]);
			} else {
				binds[type].all = stripCallback(binds[type].all);
			}
		},

		// fire an event manually. args is the object that gets passed into the event handlers
		trigger: function(type, name, args) {
			var message = ($.isArray(args)) ? args : [args],
				tiddler, self = this;
			if (binds[type]) {
				$.each(binds[type].all, function(i, func) {
					func.apply(self, message);
				});
				if (name && binds[type][name + type]) {
					$.each(binds[type][name + type], function(i, func) {
						func.apply(self, message);
					});
				}
			}

			// trigger any filters that have been bound
			if (type === 'tiddler') {
				tiddler = (args instanceof tiddlyweb.Tiddler) ? args : args[0];
				$.each(binds.filter, function(i, obj) {
					if (obj.test(tiddler)) {
						obj.callback.apply(self, message);
					}
				});
			}
		}
	};

	return result;
};

});
