# arg is file to write to
build = cd src && ../lib/requirejs/build/build.sh name=main.js \
	out=$(1) baseUrl=. optimize=none && cd ..

# arg1 is version number arg2 is str to append to filename after version
apply_copyright = sed 's/\#{VERSION}/$(1)/g' COPYRIGHT > \
	dist/chrjs-store-$(1)$(2).js && \
	cat chrjs-store.js >> dist/chrjs-store-$(1)$(2).js

dist: lib/requirejs dev
	$(call apply_copyright,$(shell cat VERSION))
	uglifyjs -o dist/chrjs-store-`cat VERSION`.min.js \
		dist/chrjs-store-`cat VERSION`.js
	cp dist/chrjs-store-`cat VERSION`.js dist/chrjs-store-latest.js

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
	 $(call build,../chrjs-store.js)

test: dev
	phantomjs test/testrunner.js file://`pwd`/test/index.html
