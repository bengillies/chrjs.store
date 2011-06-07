module('chrjs.store', {
	setup: function() {
		ts = tiddlyweb.Store();
		var t = new tiddlyweb.Tiddler('foo');
		t.text = 'foo bar';
		t.tags = ['foo', 'bar'];
		t.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.addTiddler(t);
		var s = new tiddlyweb.Tiddler('HelloThere');
		s.text = 'Hello World, from the Test Suite';
		s.tags = ['tag1', 'tag2'];
		s.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.addTiddler(s);
		window.localStorage = undefined;
	},
	teardown: function() {
		ts = undefined;
	}
});

test('Loop Tiddlers', function() {
	var count = 0;
	ts.each(function(tiddler) {
		count++;
	});
	strictEqual(count, 2);
});
