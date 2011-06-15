dist: distclean
	mkdir dist
	cp chrjs-store.js dist/chrjs-store-`cat VERSION`.js
	uglifyjs -o dist/chrjs-store-`cat VERSION`.min.js chrjs-store.js

.PHONY: clean testclean distclean remotes test dist

clean: testclean distclean

testclean:
	rm -r test/lib || true

distclean:
	rm -r dist || true

remotes: testclean
	mkdir test/lib
	curl -o test/lib/qunit.js \
		https://raw.github.com/jquery/qunit/master/qunit/qunit.js
	curl -o test/lib/qunit.css \
		https://raw.github.com/jquery/qunit/master/qunit/qunit.css
	curl -o test/lib/jquery.js \
		http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.js
	curl -o test/lib/jquery-json.js \
		http://jquery-json.googlecode.com/files/jquery.json-2.2.js
	curl -o test/lib/chrjs.js \
		https://raw.github.com/tiddlyweb/chrjs/master/main.js

test:
	phantomjs test/testrunner.js file://`pwd`/test/index.html
