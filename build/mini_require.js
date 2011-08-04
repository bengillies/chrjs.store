/* Taken and modified from ACE IDE to provide a lightweight RequireJS that
 * loads dependencies immediately, instead of inside a setTimeout (as RequireJS
 * does). See:
 * (https://github.com/mozilla/ace/blob/master/build_support/mini_require.js)
 * for the original version.
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Define a module along with a payload
 * @param module a name for the payload
 * @param payload a function to call with (require, exports, module) params
 */

(function() {

var _define = window.define;
window.define = function(module, deps, payload) {
    if (typeof define.original === 'function') {
        define.original.apply(this, arguments);
    }

    if (typeof module !== 'string') {
        return;
    }

    if (arguments.length === 2) {
        payload = deps;
    }

    if (!define.modules) {
        define.modules = {
            require: { payload: window.require, deps: [] },
            define: { payload: window.define, deps: [] },
            exports: { payload: {}, deps: [] },
            module: { payload: {}, deps: [] }
        };
    }

    define.modules[module] = {
        payload: payload,
        deps: deps
    };
};
define.original = _define;
define.modules = (_define && _define.modules) ? _define.modules : {};

/**
 * Get at functionality define()ed using the function above
 */
var _require = window.require;
window.require = function(module, callback) {
    var params, dep, payload, i, l;

    if (Object.prototype.toString.call(module) === "[object Array]") {
        params = [];
        for (i = 0, l = module.length; i < l; ++i) {
            dep = lookup(module[i]);
            if (dep) {
                params.push(dep);
            } else {
                require.original.apply(this, arguments);
                return null;
            }
        }
        if (callback) {
            callback.apply(null, params);
        }
    } else if (typeof module === 'string') {
        payload = lookup(module);

        if (!payload) {
            return require.original.apply(this, arguments);
        }

        if (callback) {
            callback();
        }

        return payload;
    }
};
require.original = _require;

/**
 * Internal function to lookup moduleNames and resolve them by calling the
 * definition function if needed.
 */
var lookup = function(moduleName) {
    var mod = define.modules[moduleName],
        module = mod ? mod.payload : null,
        deps = mod ? mod.deps : null;
    if (!module) {
        return null;
    }

    if (typeof module === 'function') {
        var exports = {}, i, args = [], result;
        for (i = 0; i < deps.length; i++) {
            args.push(lookup(deps[i]));
        }
        if (args.length === 0) {
            args = [require, exports, { id: moduleName, uri: '' }];
        }
        result = module.apply(this, args);
        return result || exports;
    }

    return module;
};

}());
