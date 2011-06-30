dist: lib/requirejs
	cd src && ../lib/requirejs/build/build.sh name=store.js \
		out=../chrjs-store-`cat VERSION`.js baseUrl=. optimize=none
	cd src && ../lib/requirejs/build/build.sh name=store.js \
		out=../chrjs-store-latest.js baseUrl=. optimize=none
	cd src && ../lib/requirejs/build/build.sh name=store.js \
		out=../chrjs-store-`cat VERSION`.js baseUrl=.

#../requirejs/build/build.sh name=main.js out=foo.js baseUrl=. optimize=none

lib/requirejs:
	curl -o lib/requirejs.zip \
		http://requirejs.org/docs/release/0.24.0/requirejs-0.24.0.zip
	cd lib && unzip requirejs.zip && mv requirejs-0.24.0 requirejs
	rm lib/requirejs.zip

.PHONY: clean testclean distclean remotes test dist dev

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
	curl -o test/lib/require.js \
		http://requirejs.org/docs/release/0.24.0/minified/require.js

dev: lib/requirejs
	cd src && ../lib/requirejs/build/build.sh name=store.js \
		out=../chrjs-store.js baseUrl=. optimize=none

test: dev
	phantomjs test/testrunner.js file://`pwd`/test/index.html
