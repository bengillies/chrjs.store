module('tree-filters', {
	setup: function() {
		ts = tiddlyweb.Store(null, false);
		$.each($.fixtures.tiddlers, function(i, tid) {
			ts.add(tid);
		});
		window.localStorage = undefined;
		$.extend(ts.fn, require('tree-filters'));
	},
	teardown: function() {
		ts = undefined;
	}
});

test('parents', function() {
	ts.add(new tiddlyweb.Tiddler({
		title: 'cat',
		bag: new tiddlyweb.Bag('foo_public', '/')
	})).add(new tiddlyweb.Tiddler({
		title: 'dog',
		tags: ['parentTag'],
		bag: new tiddlyweb.Tiddler('foo_public', '/')
	}));

	var tids = ts().parents();
	strictEqual(tids.length, 2, 'There are 2 parents');
	strictEqual(tids[0].title, 'cat', 'One parent is cat');
	strictEqual(tids[0] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');
	strictEqual(tids[1].title, 'dog', 'One parent is dog');
	strictEqual(tids[1] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');

	var filteredTids = ts().parents('#parentTag');
	strictEqual(filteredTids.length, 1, 'There is now only 1 tiddler');
	strictEqual(filteredTids[0].title, 'dog', 'One parent is dog');
	strictEqual(filteredTids[0] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');
});

test('children', function() {
	ts.add(new tiddlyweb.Tiddler({
		title: 'kid1',
		tags: ['Foo'],
		bag: new tiddlyweb.Bag('foo_public', '/')
	})).add(new tiddlyweb.Tiddler({
		title: 'kid2',
		tags: ['Foo', 'childTag'],
		bag: new tiddlyweb.Tiddler('foo_public', '/')
	}));

	var tids = ts().children();
	strictEqual(tids.length, 2, 'There are 2 children');
	strictEqual(tids[0].title, 'kid1', 'One children is kid1');
	strictEqual(tids[0] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');
	strictEqual(tids[1].title, 'kid2', 'One children is kid2');
	strictEqual(tids[1] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');

	var filteredTids = ts().children('#childTag');
	strictEqual(filteredTids.length, 1, 'There is now only 1 tiddler');
	strictEqual(filteredTids[0].title, 'kid2', 'One child is kid2');
	strictEqual(filteredTids[0] instanceof tiddlyweb.Tiddler, true, 'It is a tiddler');
});

test('hasParent', function() {
	ts.add(new tiddlyweb.Tiddler({
		title: 'cat',
		bag: new tiddlyweb.Bag('foo_public', '/')
	})).add(new tiddlyweb.Tiddler({
		title: 'dog',
		tags: ['parentTag'],
		bag: new tiddlyweb.Bag('foo_public', '/')
	}));

	var tids = ts().hasParent().sort('title').reduce('', function(tid, acc) {
		return acc + tid.title;
	});
	strictEqual(tids, 'BarFluffyFooRover', 'hasParent unfiltered returns original tiddlers');

	var filteredTids = ts().hasParent('#parentTag').sort('title').reduce('',
		function(tid, acc) {
			return acc + tid.title;
		});
	strictEqual(filteredTids, 'FooRover',
		'hasParent filtered returns only tiddlers tagged with the dog tiddler');
});

test('hasChildren', function() {
	ts.add(new tiddlyweb.Tiddler({
		title: 'kid1',
		tags: ['Foo', 'Bar', 'HelloThere'],
		bag: new tiddlyweb.Bag('foo_public', '/')
	})).add(new tiddlyweb.Tiddler({
		title: 'kid2',
		tags: ['Foo', 'childTag'],
		bag: new tiddlyweb.Tiddler('foo_public', '/')
	}));

	var tids = ts().hasChild().sort('title').reduce('', function(tid, acc) {
		return acc + tid.title;
	});
	strictEqual(tids, 'BarFooHelloThere', 'hasChild returns original tiddlers');

	var filteredTids = ts().hasChild('#childTag').sort('title').reduce('',
		function(tid, acc) {
			return acc + tid.title;
		});;
	strictEqual(filteredTids, 'Foo',
		'hasChild filtered returns only tiddlers where child is tagged childTag');
});

test('bind to parents/children', function() {
	ts.add(new tiddlyweb.Tiddler({
		title: 'kid1',
		tags: ['Foo', 'Bar', 'HelloThere'],
		bag: new tiddlyweb.Bag('foo_public', '/')
	})).add(new tiddlyweb.Tiddler({
		title: 'dog',
		tags: ['parentTag'],
		bag: new tiddlyweb.Bag('foo_public', '/')
	}));

	expect(2);

	ts().title('Rover').parents('@foo').bind(function(tid) {
		strictEqual(tid.title, 'dog', 'Dog has been updated');
	});
	var tid = ts.get('dog');
	tid.text = 'Updated dog tiddler';
	ts.add(tid);
	tid = ts.get('Foo');
	tid.text = 'This shouldn\'t fire the bind function';
	ts.add(tid);

	ts().title('HelloThere').children('@foo').bind(function(tid) {
		strictEqual(tid.title, 'kid1', 'kid1 has been updated');
	});
	tid = ts.get('kid1');
	tid.text = 'Updated kid1 tiddler';
	ts.add(tid);
	tid = ts.get('Foo');
	tid.text = 'This shouldn\'t fire the bind function';
	ts.add(tid);
});
