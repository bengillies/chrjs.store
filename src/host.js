define(function() {

return function(container) {

	var defaultContainer, callbackQueue = [];

	// pullFrom = default container to refresh the store from
	// pushTo = default container to push new tiddlers to (unless otherwise specified)
	if ((container instanceof tiddlyweb.Recipe) ||
			(container instanceof tiddlyweb.Bag)) {
		defaultContainer = {
			pullFrom: container,
			pushTo: container
		};
	} else if (container) {
		defaultContainer = {
			pullFrom: container.pullFrom,
			pushTo: container.pushTo
		};
	}

	// Assume default host of /, and that a (list of) tiddler(s) is returned from / as well
	// XXX: This can probably be _vastly_ improved for non-TiddlySpace use-cases
	var determineContainerFromTiddler = function(callback) {
		$.ajax({
			url: '/?limit=1', // get a tiddler from whatever is default
			dataType: 'json',
			success: function(data) {
				var recipeName = (($.isArray(data)) ? data[0].recipe :
						data.recipe) || '',
					match = recipeName.match(/^(.+)_[^_]+$/),
					bagName;
				if (match && recipeName) {
					callback({
						pullFrom: new tiddlyweb.Recipe(recipeName, '/'),
						pushTo: new tiddlyweb.Bag(match[1] + '_public', '/')
					});
				} else if (recipeName) {
					callback({
						pullFrom: new tiddlyweb.Recipe(recipeName, '/'),
						pushTo: new tiddlyweb.Recipe(recipeName, '/')
					});
				} else {
					bagName = ($.isArray(data)) ? data[0].bag : data.bag;
					callback({
						pullFrom: new tiddlyweb.Bag(bagName, '/'),
						pushTo: new tiddlyweb.Bag(bagName, '/')
					});
				}
			},
			error: function(xhr, txtStatus, err) {
				callback(null, err, xhr);
			}
		});
	};

	// assume that /status returns a space attribute that can be used tpo figure out
	// default containers. Fallback to determineContainerFromTiddler if it doesn't
	var determineContainer = function(callback) {
		$.ajax({
			url: '/status', // expect a "space" attribute back from /status
			dataType: 'json',
			success: function(data) {
				var res = data.space;
				if (res) {
					callback({
						pullFrom: new tiddlyweb.Recipe(res.recipe, '/'),
						pushTo: new tiddlyweb.Bag(res.name + '_public', '/')
					});
				} else {
					determineContainerFromTiddler(callback);
				}
			},
			error: function(xhr, txtStatus, err) {
				determineContainerFromTiddler(callback);
			}
		});
	};

	// return default containers (callback is optional, but must be present if
	// defaultContainer hasn't been discovered yet.
	var getDefaultContainer = function(callback) {
		var returnContainer = function(container) {
			// queue up callbacks and call all of them once the one ajax call completes
			var fn;
			while (callbackQueue.length > 0) {
				fn = callbackQueue.shift();
				fn(container);
			}
			return container;
		};

		if (callback) {
			callbackQueue.push(callback);
		}

		if (defaultContainer) {
			// no ajax call necessary so return immediately
			return returnContainer(defaultContainer);
		} else if (callbackQueue.length === 0) {
			// only make one ajax call
			determineContainer(function(container) {
				defaultContainer = container;
				returnContainer(container);
			});
		}
	};

	// immediately try and figure out where we are
	getDefaultContainer();

	return {
		getDefault: getDefaultContainer
	};
};

});
