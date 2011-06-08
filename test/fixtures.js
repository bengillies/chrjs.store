/*
 * Mock some required objects (notably XHRs)
 */


var addRequiredFields = function(tiddler) {
	if (!tiddler.fields) {
		tiddler.fields = {};
	}
	tiddler.fields._hash = '28f9837d76bce87ba79ffe28409';
	tiddler.revision = Math.floor(Math.random() *10000);
	tiddler.permissions = ['read', 'write', 'delete'];
	tiddler.modifier = 'foobar';
	tiddler.creator = 'foobar';
	return tiddler;
};

$.extend(tiddlyweb.Resource.prototype, {
	get: function(callback, errback, filters) {
		var tiddler;
		if (!this.bag && !this.recipe) {
			errback.apply(this, [{}, {}, 'Error']);
		 } else if (this.text) {
			tiddler = addRequiredFields(this);
			callback.apply(this, [tiddler]);
		} else {
			this.text = 'Hello World';
			tiddler = addRequiredFields(this);
			callback.apply(this, [tiddler]);
		}
	},
	put: function(callback, errback, filters) {
		var tiddler;
		if (!this.bag && !this.recipe) {
			errback.apply(this, [{}, {}, 'Error']);
		} else {
			tiddler = addRequiredFields(this);
			callback.apply(this, [tiddler]);
		}
	},
	'delete': function(callback, errback, filters) {
		callback.apply(this, [this]);
	}
});

var newTiddlers = function() {
	return {
		get: function(callback, errback, filters) {
			var tiddlers = [], newTiddler, i;
			for (i=0; i < 5; i++) {
				newTiddler = new tiddlyweb.Tiddler('FooBar_' +
					Math.floor(Math.random() * 10000));
				newTiddler.bag = new tiddlyweb.Bag('foo_public', '/');
				newTiddler.text = 'Hello World, from foo.';
				newTiddler = addRequiredFields(newTiddler);
				tiddlers.push(newTiddler);
			}
			callback.apply(this, [tiddlers]);
		}
	};
};

tiddlyweb.Bag.prototype.tiddlers = newTiddlers;
tiddlyweb.Recipe.prototype.tiddlers = newTiddlers;

var _oldAjax = $.ajax;
$.ajax = function(options) {
	if (options && options.url === '/?limit=1') {
		options.success.apply(this, [[{recipe: 'foo_public'}]]);
	} else {
		_oldAjax.apply(this, arguments);
	}
};
