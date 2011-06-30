define(function() {

var isLocalStorage = (function() {
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch(e) {
			return false;
		}
	}()),
	// construct an ID for use in localStorage
	getStorageID = function(tiddler) {
		return encodeURIComponent(tiddler.bag.name) + '/' +
			encodeURIComponent(tiddler.title);
	};

return {
	isCaching: isLocalStorage,
	set: function(tiddler) {
		var key = getStorageID(tiddler);
		if (isLocalStorage) {
			window.localStorage.setItem(key, tiddler.toJSON());
		}
	},
	get: function(tiddler) {
		var key = getStorageID(tiddler), result, tidJSON;
		if (isLocalStorage) {
			result = window.localStorage[key];
			tidJSON = $.parseJSON(result);
			result = new tiddlyweb.Tiddler(tiddler.title);
			result.bag = tiddler.bag;
			$.extend(result, tidJSON);
			return result;
		}
		return null;
	},
	remove: function(tiddler) {
		var key = getStorageID(tiddler);
		if (isLocalStorage) {
			window.localStorage.removeItem(key);
		}
	},
	list: function() {
		var tiddlers = [];
		if (isLocalStorage) {
			$.each(window.localStorage, function(i) {
				try {
					var key = window.localStorage.key(i),
						names = key.split('/'),
						bagName = decodeURIComponent(names[0]),
						name = decodeURIComponent(names[1]),
						tiddlerJSON = $.parseJSON(window.localStorage[key]),
						tiddler = new tiddlyweb.Tiddler(name);
					tiddler.bag = new tiddlyweb.Bag(bagName, '/');
					$.extend(tiddler, tiddlerJSON);
					tiddlers.push(tiddler);
				} catch(e) {
					// not a chrjs-store cached tiddler
				}
			});
		}
		return tiddlers;
	},
	clear: function() {
		if (isLocalStorage) {
			window.localStorage.clear();
		}
	}
};

});
