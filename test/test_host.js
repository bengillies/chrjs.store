module('host', {
	setup: function() {
		host = require('host');
	}
});

test('Pass in Bag', function() {
	var c = host(new tiddlyweb.Bag('foo', '/'));
	strictEqual(c.getDefault().pullFrom.name, 'foo', 'pullFrom is foo');
	strictEqual(c.getDefault().pullFrom instanceof tiddlyweb.Bag, true,
		'pullFrom is a bag');

	strictEqual(c.getDefault().pushTo.name, 'foo', 'pushTo is foo');
	strictEqual(c.getDefault().pushTo instanceof tiddlyweb.Bag, true,
		'pullFrom is a bag');
});

test('Pass in Recipe', function() {
	var c = host(new tiddlyweb.Recipe('foo', '/'));
	strictEqual(c.getDefault().pullFrom.name, 'foo', 'pullFrom is foo');
	strictEqual(c.getDefault().pullFrom instanceof tiddlyweb.Recipe, true,
		'pullFrom is a recipe');

	strictEqual(c.getDefault().pushTo.name, 'foo', 'pushTo is foo');
	strictEqual(c.getDefault().pushTo instanceof tiddlyweb.Recipe, true,
		'pullFrom is a recipe');
});

test('Pass in object', function() {
	var c = host({
		pullFrom: new tiddlyweb.Recipe('foo', '/'),
		pushTo: new tiddlyweb.Bag('foo', '/')
	});
	strictEqual(c.getDefault().pullFrom.name, 'foo', 'pullFrom is foo');
	strictEqual(c.getDefault().pullFrom instanceof tiddlyweb.Recipe, true,
		'pullFrom is a recipe');

	strictEqual(c.getDefault().pushTo.name, 'foo', 'pushTo is foo');
	strictEqual(c.getDefault().pushTo instanceof tiddlyweb.Bag, true,
		'pullFrom is a bag');
});

test('Pass in callback', function() {
	var c = host(new tiddlyweb.Bag('foo', '/'));
	expect(4);
	c.getDefault(function(c) {
		strictEqual(c.pullFrom.name, 'foo', 'pullFrom is foo');
		strictEqual(c.pullFrom instanceof tiddlyweb.Bag, true, 'pullFrom is a bag');
		strictEqual(c.pushTo.name, 'foo', 'pushTo is foo');
		strictEqual(c.pushTo instanceof tiddlyweb.Bag, true, 'pullFrom is a bag');
	});
});

test('determine Container default', function() {
	var c = host();
	expect(4);
	c.getDefault(function(c) {
		strictEqual(c.pullFrom.name, 'foo_public', 'pullFrom is foo_public');
		strictEqual(c.pullFrom instanceof tiddlyweb.Recipe, true, 'pullFrom is a recipe');
		strictEqual(c.pushTo.name, 'foo_public', 'pushTo is foo_public');
		strictEqual(c.pushTo instanceof tiddlyweb.Bag, true, 'pullFrom is a bag');
	});
});

test('determine Container recipe', function() {
	var _ajax = $.ajax;
	$.ajax = function(options) {
		options.success.call(this, [{recipe: 'foo'}]);
	};

	var c = host();
	expect(4);

	c.getDefault(function(c) {
		strictEqual(c.pullFrom.name, 'foo', 'pullFrom is foo');
		strictEqual(c.pullFrom instanceof tiddlyweb.Recipe, true, 'pullFrom is a recipe');
		strictEqual(c.pushTo.name, 'foo', 'pushTo is foo');
		strictEqual(c.pushTo instanceof tiddlyweb.Recipe, true, 'pullFrom is a recipe');
	});

	$.ajax = _ajax;
});

test('determine Container bag', function() {
	var _ajax = $.ajax;
	$.ajax = function(options) {
		options.success.call(this, [{bag: 'foo'}]);
	};

	var c = host();
	expect(4);

	c.getDefault(function(c) {
		strictEqual(c.pullFrom.name, 'foo', 'pullFrom is foo');
		strictEqual(c.pullFrom instanceof tiddlyweb.Bag, true, 'pullFrom is a bag');
		strictEqual(c.pushTo.name, 'foo', 'pushTo is foo');
		strictEqual(c.pushTo instanceof tiddlyweb.Bag, true, 'pullFrom is a bag');
	});

	$.ajax = _ajax;
});

test('determine Container only runs once', function() {
	var _ajax = $.ajax,
		countAjax = 0,
		countCallback = 0;
	$.ajax = function(options) {
		countAjax++;
		window.setTimeout(function() {
			_ajax.call(this, options);
		}, 0);
	};

	var c = host();
	expect(4);

	c.getDefault(function(c) {
		countCallback++;
		equal(true, true, 'callback ran');
		if (countCallback === 3) {
			start();
		}
	});

	c.getDefault(function(c) {
		countCallback++;
		equal(true, true, 'callback ran');
		if (countCallback === 3) {
			start();
		}
	});

	c.getDefault(function(c) {
		countCallback++;
		equal(true, true, 'callback ran');
		if (countCallback === 3) {
			start();
		}
	});

	stop();

	strictEqual(countAjax, 1, 'only 1 ajax call was made');

	$.ajax = _ajax;
});
