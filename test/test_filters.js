module('filters', {
	setup: function() {
		ts = tiddlyweb.Store(null, false);
		$.each($.fixtures.tiddlers, function(i, tid) {
			ts.add(tid);
		});
		window.localStorage = undefined;
	},
	teardown: function() {
		ts = undefined;
	}
});

test('don\'t filter', function() {
	strictEqual(ts().length, 6, 'There should be 6 tiddlers in the store');
});

test('title filter', function() {
	var tids = ts('title', 'Foo');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].title, 'Foo');
	tids = ts().title('Foo');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].title, 'Foo');
});

test('tag filter', function() {
	var tids = ts('tags', 'dog');
	strictEqual(tids.length, 2);
	$.each(tids, function(i, tid) {
		strictEqual(!!~tid.tags.indexOf('dog'), true);
	});
	tids = ts().tag('dog');
	strictEqual(tids.length, 2);
	$.each(tids, function(i, tid) {
		strictEqual(!!~tid.tags.indexOf('dog'), true);
	});
});

test('field filter', function() {
	var tids = ts('cake', 'lie');
	strictEqual(tids.length, 4);
	$.each(tids, function(i, tid) {
		strictEqual(tid.fields.cake, 'lie');
	});
	tids = ts().attr('cake', 'lie');
	strictEqual(tids.length, 4);
	$.each(tids, function(i, tid) {
		strictEqual(tid.fields.cake, 'lie');
	});
});

test('text filter', function() {
	var tids = ts('text', 'meow');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].text, 'Meow meow');
	tids = ts().text('meow');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].text, 'Meow meow');
});

test('bag filter', function() {
	var tids = ts().bag('cats_public');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].bag.name, 'cats_public');
});

test('dirty filter', function() {
	strictEqual(ts().dirty().length, 6);
	ts('tag', 'cat').save(function(tid) {});
	strictEqual(ts().dirty().length, 3);
	var futureDate = new Date(1000000 + (+new Date()));
	strictEqual(ts().dirty(futureDate).length, 6);
});

test('space filter', function() {
	var callbackRan = false;
	ts.getDefaults(function() {
		var tids = ts().space('cats');
		strictEqual(tids.length, 1);
		strictEqual(tids[0].bag.name, 'cats_public');
		tids = ts().space();
		strictEqual(tids.length, 1, 'One tiddler found');
		strictEqual(tids[0].bag.name, 'foo_public', 'One tiddler from the foo space');
		tids = ts().space(true);
		strictEqual(tids.length, 1, 'There is one tiddler returned');
		strictEqual(tids[0].bag.name, 'foo_public', 'One tiddler from foo found');
		tids = ts().space(false);
		strictEqual(tids.length, 5, 'There should be 5 tiddlers found');
		tids.each(function(tid) {
			notStrictEqual(tid.bag.name, 'foo_public', 'None of them should be from foo');
		});
		callbackRan = true;
	});
	strictEqual(callbackRan, true);
});

test('recipe filter', function() {
	var tids = ts().recipe('foo');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].recipe.name, 'foo');
});

test('each filter', function() {
	var count = 0;
	ts().each(function(tid) {
		count++;
		strictEqual(tid instanceof tiddlyweb.Tiddler, true);
	});
	strictEqual(count, 6);
});

test('map filter', function() {
	var tids = ts();
	strictEqual(tids.length, 6);
	tids = tids.map(function(tid) {
		strictEqual(tid instanceof tiddlyweb.Tiddler, true, 'a');
		return tid.title;
	});
	strictEqual(tids.length, 6, 'c');
	tids = tids.map(function(tid) {
		strictEqual(typeof tid, 'string', 'b');
		return null;
	});
	strictEqual(tids.length, 0, 'd');
});

test('reduce filter', function() {
	var tids = ts(), count;
	count = tids.reduce(0, function(tid, acc) {
		strictEqual(tid instanceof tiddlyweb.Tiddler, true);
		return ++acc;
	});
	strictEqual(count, 6);
});

test('bind filter', function() {
	var bindRun = false;
	ts('tag', 'cat').bind(function(tid) {
		bindRun = true;
		strictEqual(tid.title, 'New Tiddler Tagged Cat');
	});
	ts.add(new tiddlyweb.Tiddler({
		title: 'New Tiddler Tagged Cat',
		tags: ['cat']
	}));
	strictEqual(bindRun, true);

	bindRun = false;
	ts.add(new tiddlyweb.Tiddler({
		title: 'This tiddler shouldn\'t be run in bind',
		tags: ['dog']
	}));
	strictEqual(bindRun, false);
});

test('save filter', function() {
	var saved = false;
	ts('title', 'Foo').save(function(tid) {
		strictEqual(tid.fields._hash, '28f9837d76bce87ba79ffe28409');
		saved = true;
	});
	strictEqual(saved, true);
});

test('add filter', function() {
	var tids = ts();
	strictEqual(tids.length, 6);
	tids = tids.add(new tiddlyweb.Tiddler({title: 'foobarbaz'}));
	strictEqual(tids.length, 7);
	strictEqual(ts.get('foobarbaz') instanceof tiddlyweb.Tiddler, true);
});

module('filter syntax', {
	setup: function() {
		ts = tiddlyweb.Store(null, false);
		$.each($.fixtures.tiddlers, function(i, tid) {
			ts.add(tid);
		});
		window.localStorage = undefined;
	},
	teardown: function() {
		ts = undefined;
	}
});

test('tag', function() {
	var tids = ts().find('#cat');
	strictEqual(tids.length, 3);
	tids.each(function(tid) {
		strictEqual(!!~tid.tags.indexOf('cat'), true);
	});
});

test('root find', function() {
	var tids = ts('#cat');
	strictEqual(tids.length, 3);
	tids.each(function(tid) {
		strictEqual(!!~tid.tags.indexOf('cat'), true);
	});
});

test('title', function() {
	var tids = ts('[[Foo]]');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].title, 'Foo');
});

test('modifier', function() {
	var tids = ts('+bengillies');
	strictEqual(tids.length, 3);
	tids.each(function(tid) {
		strictEqual(tid.modifier, 'bengillies');
	});
});

test('text', function() {
	var tids = ts('"a dog, woof"');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].text, 'Woof woof, I\'m a dog, woof woof');
});

test('field', function() {
	var tids = ts('[cake=lie]');
	strictEqual(tids.length, 4);
	tids.each(function(tid) {
		strictEqual(tid.fields.cake, 'lie');
	});
});

test('space', function() {
	var tids = ts('@foo');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].bag.name, 'foo_public');
});

test('not', function() {
	var tids = ts('!#cat');
	strictEqual(tids.length, 3);
	tids.each(function(tid) {
		strictEqual(!!~tid.tags.indexOf('cat'), false);
	});

	tids = ts('[cake!=lie]');
	strictEqual(tids.length, 2);
	tids.each(function(tid) {
		strictEqual(typeof tid.fields, 'undefined');
	});
});

test('and', function() {
	var tids = ts('![[Baz]] #dog "was \'ere" #cat +bengillies !@bar [cake=lie]');
	strictEqual(tids.length, 1);
	strictEqual(tids[0].title, 'Foo');
});

test('or', function() {
	var tids = ts('#cat [[Foo]], "Bar w" [type=text/x-tiddler]'),
		matchingTiddlers = ['Foo', 'Bar'];
	strictEqual(tids.length, 2);
	tids.each(function(tid) {
		var isIn = matchingTiddlers.indexOf(tid.title);
		notStrictEqual(isIn, -1);
		matchingTiddlers.splice(isIn, 1);
	});
});

test('brackets', function() {
	var tids = ts('[cake=lie] (#dog, #introduction) +bengillies'),
		matchingTiddlers = ['Foo', 'HelloThere', 'bunnywunny'];
	strictEqual(tids.length, 3);
	tids.each(function(tid) {
		var isIn = matchingTiddlers.indexOf(tid.title);
		notStrictEqual(isIn, -1);
		matchingTiddlers.splice(isIn, 1);
	});
});

test('empty tiddlers don\'t break', function() {
	var tid = new tiddlyweb.Tiddler('a'),
		noError = function(block, message) {
			try {
				block();
			} catch(e) {
				equal(true, false, message);
			}
		};

	ts.add(tid);
	noError(function() { ts('#tag'); }, 'undefined tags in filter syntax');
	noError(function() { ts('@space'); }, 'undefined space in filter syntax');
	noError(function() { ts('+modifier'); }, 'undefined modifier in filter syntax');
	noError(function() { ts('[field=value]'); }, 'undefined fields in filter syntax');
	noError(function() { ts('"text here"'); }, 'undefined text in filter syntax');

	noError(function() { ts().tag('tag'); }, 'undefined tags');
	noError(function() { ts().space(); }, 'undefined space');
	noError(function() { ts().bag('foo'); }, 'undefined bag');
	noError(function() { ts().recipe('foo'); }, 'undefined recipe');
	noError(function() { ts().text('text'); }, 'undefined text');
	noError(function() { ts().attr('field', 'value'); }, 'undefined fields');
	noError(function() { ts().not('field', 'value'); }, 'undefined not-fields');
});
