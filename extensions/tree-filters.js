/*
 * Extra filters for treating tiddlers tagged with the titles of other tiddlers
 * as a tree/graph. For example:
 *	tid1 = {
 *		title: 'Foo',
 *		tags: ['Bar']
 *	}
 *
 *	tid2 = {
 *		title: 'Bar',
 *	}
 *
 * In this case, tid1 is the child of tid2, tid2 is the parent of tid1.
 *
 * To use this, require() it, and extend the fn object of your store with the
 * result. I.e.:
 *
 *	var store = tiddlyweb.Store();
 *	var treeFilters = require('tree-filters');
 *	$.extend(store.fn, treeFilters);
 */

define('tree-filters', ['filter-syntax'], function(parser) {

	// return parents of a tiddler
	var _parents = function(store, list) {
		var parentList = store.Collection(),
			usedTags = [];

		list.each(function(tiddler) {
			$.each(tiddler.tags || [], function(i, tag) {
				if (!~usedTags.indexOf(tag)) {
					usedTags.push(tag);
					var parent = store.get(tag);
					if (parent) {
						parentList.push(parent);
					}
				}
			});
		});

		return parentList;
	};

	// return the children of a tiddler
	var _children = function(store, list) {
		var tagList = list.map(function(tiddler) {
				return tiddler.title;
			}),
			childrenList = store.Collection(store());

		return childrenList.map(function(tiddler) {
			var result;
			$.each(tiddler.tags || [], function(i, tag) {
				if (~tagList.indexOf(tag)) {
					result = tiddler;
					return false;
				}
			});
			return result;
		});
	};

	// return tiddlers that are tagged by the the tiddlers in the list and match filter
	// i.e. the tiddlers in the list have a tag that equals the parent's tiddler title
	return {
		parents: function(filter) {
			var parentList = _parents(this.store, this),
				oldAST = this.ast, // we need this to check the children of the new parents
				self = this;
			parentList = (filter) ?  parentList.find(filter) : parentList;
			parentList.ast.value.push({
				type: 'function',
				value: (function() {
					var tester = parser.createTester(oldAST);
					return function(tiddler) {
						var children = _children(self.store,
								self.store.Collection([tiddler])),
							match = false;

						children.each(function(tid) {
							if (tester(tid)) {
								match = true;
							}
						});

						return match;
					};
				}())
			});

			return parentList;
		},
		// return tiddlers that have tags that equal the title of a tiddler in the list and pass the filter
		children: function(filter) {
			var results = _children(this.store, this),
				oldAST = this.ast,
				self = this;

			results = (filter) ? results.find(filter) : results;
			results.ast.value.push({
				type: 'function',
				value: (function() {
					var tester = parser.createTester(oldAST);
					return function(tiddler) {
						var parents = _parents(self.store,
								self.store.Collection([tiddler])),
							match = false;

						parents.each(function(tid) {
							if (tester(tid)) {
								match = true;
							}
						});

						return match;
					};
				}())
			});

			return results;
		},
		// return tiddlers that have a parent that matches the filter
		hasParent: function(filter) {
			var allParents = this.parents(filter).map(function(tiddler) {
				return tiddler.title;
			});

			return this.map(function(tiddler) {
				var result;
				$.each(tiddler.tags || [], function(i, tag) {
					if (~allParents.indexOf(tag)) {
						result = tiddler;
						return false;
					}
				});
				return result;
			});
		},
		// return tiddlers that have a child that matches the filter
		hasChild: function(filter) {
			var allChildren = this.children(filter);

			// create a list of tiddler titles based on what children are tagged with
			// use jQuery.map instead of this.map as it flattens as well
			var tagList = $.map(allChildren, function(tiddler) {
				return tiddler.tags;
			});

			return this.map(function(tiddler) {
				if (~tagList.indexOf(tiddler.title)) {
					return tiddler;
				}
			});
		}
	};
});
