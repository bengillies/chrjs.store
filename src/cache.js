define(function() {

var isLocalStorage = (function() {
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch(e) {
			return false;
		}
	}());

return {
	isCaching: isLocalStorage,
	set: function(key, tiddler) {
		if (isLocalStorage) {
			window.localStorage.setItem(key, JSON.stringify(tiddler.baseData()));
		}
	},
	get: function(key, tiddler) {
		var result, tidJSON;
		if (isLocalStorage) {
			tidJSON = window.localStorage[key];
			result = new tiddlyweb.Tiddler(tiddler.title);
			result = result.parse(JSON.parse(tidJSON));
			result.bag = tiddler.bag;
			return result;
		}
		return null;
	},
	remove: function(key) {
		if (isLocalStorage) {
			window.localStorage.removeItem(key);
		}
	},
	list: function() {
		var tiddlers = [], i, l;
		if (isLocalStorage) {
			for (i = 0, l = window.localStorage.length; i < l; i++) {
				try {
					var key = window.localStorage.key(i), names, bagName, name,
						tiddlerJSON, tiddler;
					names = key.split('/');
					if (names.length !== 2) {
						throw "BadKey";
					}
					bagName = decodeURIComponent(names[0]);
					name = decodeURIComponent(names[1]);
					tiddlerJSON = JSON.parse(window.localStorage[key]);
					tiddler = new tiddlyweb.Tiddler(name);
					tiddler = tiddler.parse(tiddlerJSON);
					if (bagName) {
						tiddler.bag = new tiddlyweb.Bag(bagName, '/');
					}
					tiddlers.push(tiddler);
				} catch(e) {
					// not a chrjs-store cached tiddler
				}
			};
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
