module('chrjs.store', {
	setup: function() {
		ts = tiddlyweb.Store(null, false); // don't load from localStorage
		var t = new tiddlyweb.Tiddler('foo');
		t.text = 'foo bar';
		t.tags = ['foo', 'bar'];
		t.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.add(t);
		var s = new tiddlyweb.Tiddler('HelloThere');
		s.text = 'Hello World, from the Test Suite';
		s.tags = ['tag1', 'tag2'];
		s.bag = new tiddlyweb.Bag('foo_public', '/');
		ts.add(s);
		window.localStorage = undefined;
	},
	teardown: function() {
		ts = undefined;
	}
});

test('remove tiddler', function() {
	var tiddlers = ts();
	strictEqual(tiddlers.length, 2, "There should be 2 tiddlers in the store")
	ts.remove('foo');
	tiddlers = ts();
	strictEqual(tiddlers.length, 1, "when foo is removed there should only be one.");
	strictEqual(tiddlers[0].title, "HelloThere", "make sure HelloThere is the remaining tiddler");
});

test('Count Tiddlers', function() {
	var count = 0;
	ts.each(function(tiddler) {
		count++;
	});
	strictEqual(count, 2);
});

test('Add Tiddlers', function() {
	var tid = new tiddlyweb.Tiddler('Bar');
	tid.text = 'A New Tiddler';
	var addedTid = ts.add(tid).get('Bar');
	strictEqual(addedTid.title, 'Bar');
	strictEqual(addedTid.text, 'A New Tiddler');
	equal(addedTid.lastSync, undefined);
	strictEqual(addedTid.bag.name, 'foo_public');

	var tid2 = new tiddlyweb.Tiddler('Baz');
	tid2.text = 'foo';
	tid2.bag = new tiddlyweb.Bag('a-bag', '/');
	var addedTid2 = ts.add(tid2).get('Baz');
	strictEqual(addedTid2.bag.name, 'a-bag', 'The bag should not change');
});

test('Save Tiddlers', function() {
	var count = 0;
	ts.each(function(tiddler) {
		equal(tiddler.lastSync, undefined);
		count++;
	});
	ts.save(function(tiddler) {
		notEqual(tiddler.lastSync, undefined);
		count--;
	});
	strictEqual(count, 0);
});

test('Retrieve tiddler (from cache)', function() {
	ts.get('HelloThere', function(tiddler) {
		strictEqual(tiddler.text, 'Hello World, from the Test Suite', 'test correct text is on tiddler');
	});
});

test('Retrieve tiddler (from server)', function() {
	// this tiddler is not in the local store
	var tid = new tiddlyweb.Tiddler("TidOnServer");
	tid.bag = new tiddlyweb.Bag("foo", "/")
	ts.get(tid, function(tiddler) {
		strictEqual(tiddler.title, 'TidOnServer', 'check a tiddler object has been found with correct title');
		strictEqual(tiddler.text, 'Hello World', 'check the text was found as it was on the "server"');
	});
});

test('Retrieve tiddler from server, save locally, get locally', function() {
	var tid = new tiddlyweb.Tiddler("TidOnServer");
	tid.bag = new tiddlyweb.Bag("foo", "/")
	ts.get(tid, function(tiddler) {
		strictEqual(tiddler.text, 'Hello World', 'check the text was found as it was on the "server"');
		tiddler.text = "bar";
		ts.add(tiddler);
		var newtid = new tiddlyweb.Tiddler("TidOnServer");
		newtid.bag = new tiddlyweb.Bag("foo", "/")
		ts.get(newtid, function(tid2) {
			strictEqual(tid2.text, 'bar', 'make sure we get the local version as this tiddler exists in localStorage');
		})
	});
});

test('get space', function() {
	ts.getSpace(function(space) {
		strictEqual(space.name, 'foo');
		strictEqual(space.type, 'public');
	});
});

test('bind, unbind', function() {
	var tid = new tiddlyweb.Tiddler('Notify Me'),
		removed = false,
		called = 0,
		bindFunc = function(tiddler, deleted) {
			strictEqual(tiddler.title, 'Notify Me', 'We should get notified when adding');
			if (removed) {
				strictEqual(deleted, 'deleted', 'We should still be notified, but it should say deleted');
			}
			called++;
		};

	ts.bind('tiddler', null, function(tiddler) {
		strictEqual(tiddler.title, 'Notify Me', 'bind to all tiddlers');
		called++;
	}).bind('tiddler', 'Notify Me', bindFunc);

	ts.add(tid);
	strictEqual(called, 2, 'we should have been notified twice');
	console.log('after ' + called);
	ts.remove(tid);
	strictEqual(called, 4, 'check delete notifications');
	ts.unbind('tiddler', 'Notify Me', bindFunc);
	ts.add(tid);
	strictEqual(called, 5, 'make sure unbind worked');
});


module('empty chrjs.store', {
	setup: function() {
		ts = tiddlyweb.Store(null, false); // don't load from localStorage
		localStorage.clear();
	},
	teardown: function() {
		ts = undefined;
		localStorage.clear();
	}
});

test('dirty', function() {
	strictEqual(ts().dirty().length, 0, "At the start no tiddlers should be dirty.");
	ts.retrieveCached();
	strictEqual(ts().dirty().length, 0, "No tiddlers in local storage so should remain at 0.");
	var tid = new tiddlyweb.Tiddler("TidOnServer");
	tid.bag = new tiddlyweb.Bag("foo", "/")

	// get the tiddler from the server (it should exist on the server)
	ts.get(tid, function(t) {
		tid = t;
	});
	strictEqual(ts().dirty().length, 0, "This tiddler has not been added to the store so we should still be at 0.");
	// change the text of the tiddler;
	tid.text = "bar";

	// add the tiddler back to the store
	ts.add(tid);
	strictEqual(ts().dirty().length, 1, "Adding a single tiddler should put one tiddler in the store.");
	ts.add(tid);
	strictEqual(ts().dirty().length, 1, "Adding same tiddler should keep one tiddler in the store.");
});
