import { print } from 'graphql';
import { action, observable } from 'mobx';
import { GraphQLClient } from 'graphql-request';
import { resolveIdentifier, types, getEnv, recordPatches, getParent, getType, applySnapshot, addDisposer, onSnapshot } from 'mobx-state-tree';

function mergeHelper(store, data) {
  function merge(data) {
    if (!data || typeof data !== "object") { return data; }
    if (Array.isArray(data)) { return data.map(merge); }
    var __typename = data.__typename;
    var id = data.id; // convert values deeply first to MST objects as much as possible

    var snapshot = {};

    for (var key in data) {
      snapshot[key] = merge(data[key]);
    } // GQL object


    if (__typename && store.isKnownType(__typename)) {
      // GQL object with known type, instantiate or recycle MST object
      var typeDef = store.getTypeDef(__typename); // Try to reuse instance, even if it is not a root type

      var instance = id !== undefined && resolveIdentifier(typeDef, store, id);

      if (instance) {
        // update existing object
        Object.assign(instance, snapshot);
      } else {
        // create a new one
        instance = typeDef.create(snapshot);

        if (store.isRootType(__typename)) {
          // register in the store if a root
          //store[typenameToCollectionName(__typename)].set(id, instance)
          store[store.getCollectionName(__typename)].set(id, instance);
        }

        instance.__setStore(store);
      }

      return instance;
    } else {
      // GQL object with unknown type, return verbatim
      return snapshot;
    }
  }

  return merge(data);
}

function getFirstValue(data) {
  var keys = Object.keys(data);
  if (keys.length !== 1) { throw new Error(("Expected exactly one response key, got: " + (keys.join(", ")))); }
  return data[keys[0]];
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

var fastJsonStableStringify = function (data, opts) {
    if (!opts) opts = {};
    if (typeof opts === 'function') opts = { cmp: opts };
    var cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;

    var cmp = opts.cmp && (function (f) {
        return function (node) {
            return function (a, b) {
                var aobj = { key: a, value: node[a] };
                var bobj = { key: b, value: node[b] };
                return f(aobj, bobj);
            };
        };
    })(opts.cmp);

    var seen = [];
    return (function stringify (node) {
        if (node && node.toJSON && typeof node.toJSON === 'function') {
            node = node.toJSON();
        }

        if (node === undefined) return;
        if (typeof node == 'number') return isFinite(node) ? '' + node : 'null';
        if (typeof node !== 'object') return JSON.stringify(node);

        var i, out;
        if (Array.isArray(node)) {
            out = '[';
            for (i = 0; i < node.length; i++) {
                if (i) out += ',';
                out += stringify(node[i]) || 'null';
            }
            return out + ']';
        }

        if (node === null) return 'null';

        if (seen.indexOf(node) !== -1) {
            if (cycles) return JSON.stringify('__cycle__');
            throw new TypeError('Converting circular structure to JSON');
        }

        var seenIndex = seen.push(node) - 1;
        var keys = Object.keys(node).sort(cmp && cmp(node));
        out = '';
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = stringify(node[key]);

            if (!value) continue;
            if (out) out += ',';
            out += JSON.stringify(key) + ':' + value;
        }
        seen.splice(seenIndex, 1);
        return '{' + out + '}';
    })(data);
};

var isServer = typeof window === "undefined";
var Query = function Query(store, query, variables, options) {
  var this$1 = this;
  if ( options === void 0 ) options = {};

  this.store = store;
  this.variables = variables;
  this.options = options;
  this.loading = false;
  this.data = undefined;
  this.error = undefined;

  this.refetch = function () {
    return Promise.resolve().then(action(function () {
      if (!this$1.loading) {
        this$1.fetchResults();
      }

      return this$1.promise;
    }));
  };

  this.query = typeof query === "string" ? query : print(query);
  this.queryKey = this.query + fastJsonStableStringify(variables);
  var fetchPolicy = options.fetchPolicy || "cache-and-network";

  if (this.store.ssr && !this.options.noSsr && (isServer || !store.__afterInit)) {
    fetchPolicy = "cache-first";
  }

  this.fetchPolicy = fetchPolicy;

  if (this.store.ssr && this.options.noSsr && isServer) {
    this.promise = Promise.resolve();
    return;
  }

  var inCache = this.store.__queryCache.has(this.queryKey);

  switch (this.fetchPolicy) {
    case "no-cache":
    case "network-only":
      this.fetchResults();
      break;

    case "cache-only":
      if (!inCache) {
        this.error = new Error(("No results for query " + (this.query) + " found in cache, and policy is cache-only"));
        this.promise = Promise.reject(this.error);
      } else {
        this.useCachedResults();
      }

      break;

    case "cache-and-network":
      if (inCache) {
        this.useCachedResults();
        this.refetch(); // refetch async, so that callers chaining to the initial promise should resovle immediately!
      } else {
        this.fetchResults();
      }

      break;

    case "cache-first":
      if (inCache) {
        this.useCachedResults();
      } else {
        this.fetchResults();
      }

      break;
  }
};

Query.prototype.fetchResults = function fetchResults () {
    var this$1 = this;

  this.loading = true;
  var promise;

  var existingPromise = this.store.__promises.get(this.queryKey);

  if (existingPromise) {
    promise = existingPromise;
  } else {
    promise = this.store.rawRequest(this.query, this.variables);

    this.store.__pushPromise(promise, this.queryKey);
  }

  promise = promise.then(function (data) {
    // cache query and response
    if (this$1.fetchPolicy !== "no-cache") {
      this$1.store.__cacheResponse(this$1.queryKey, this$1.store.deflate(data));
    }

    return this$1.store.merge(data);
  });
  this.promise = promise;
  promise.then(action(function (data) {
    this$1.loading = false;
    this$1.data = data;
  }), action(function (error) {
    this$1.loading = false;
    this$1.error = error;
  }));
};

Query.prototype.useCachedResults = function useCachedResults () {
  this.data = this.store.merge(this.store.__queryCache.get(this.queryKey));
  this.promise = Promise.resolve(this.data);
};

Query.prototype.case = function case$1 (handlers) {
  return this.loading && !this.data ? handlers.loading() : this.error ? handlers.error(this.error) : handlers.data(this.data);
};

Query.prototype.currentPromise = function currentPromise () {
  return this.promise;
};

Query.prototype.then = function then (onfulfilled, onrejected) {
    var this$1 = this;

  return this.promise.then(function (d) {
    this$1.store.__runInStoreContext(function () { return onfulfilled(d); });
  }, function (e) {
    this$1.store.__runInStoreContext(function () { return onrejected(e); });
  });
};

__decorate([observable], Query.prototype, "loading", void 0);

__decorate([observable.ref], Query.prototype, "data", void 0);

__decorate([observable], Query.prototype, "error", void 0);

function deflateHelper(store, data) {
  function deflate(data) {
    if (!data || typeof data !== "object") { return data; }
    if (Array.isArray(data)) { return data.map(deflate); }
    var __typename = data.__typename;
    var id = data.id;

    if (__typename && store.isRootType(__typename)) {
      // GQL object with root type, keep only __typename & id
      return {
        __typename: __typename,
        id: id
      };
    } else {
      // GQL object with non-root type, return object with all props deflated
      var snapshot = {};

      for (var key in data) {
        snapshot[key] = deflate(data[key]);
      }

      return snapshot;
    }
  }

  return deflate(data);
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var pluralize = createCommonjsModule(function (module, exports) {
/* global define */

(function (root, pluralize) {
  /* istanbul ignore else */
  if (typeof commonjsRequire === 'function' && 'object' === 'object' && 'object' === 'object') {
    // Node.
    module.exports = pluralize();
  } else {
    // Browser global.
    root.pluralize = pluralize();
  }
})(commonjsGlobal, function () {
  // Rule storage - pluralize and singularize need to be run sequentially,
  // while other rules can be optimized using an object for instant lookups.
  var pluralRules = [];
  var singularRules = [];
  var uncountables = {};
  var irregularPlurals = {};
  var irregularSingles = {};

  /**
   * Sanitize a pluralization rule to a usable regular expression.
   *
   * @param  {(RegExp|string)} rule
   * @return {RegExp}
   */
  function sanitizeRule (rule) {
    if (typeof rule === 'string') {
      return new RegExp('^' + rule + '$', 'i');
    }

    return rule;
  }

  /**
   * Pass in a word token to produce a function that can replicate the case on
   * another word.
   *
   * @param  {string}   word
   * @param  {string}   token
   * @return {Function}
   */
  function restoreCase (word, token) {
    // Tokens are an exact match.
    if (word === token) return token;

    // Lower cased words. E.g. "hello".
    if (word === word.toLowerCase()) return token.toLowerCase();

    // Upper cased words. E.g. "WHISKY".
    if (word === word.toUpperCase()) return token.toUpperCase();

    // Title cased words. E.g. "Title".
    if (word[0] === word[0].toUpperCase()) {
      return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase();
    }

    // Lower cased words. E.g. "test".
    return token.toLowerCase();
  }

  /**
   * Interpolate a regexp string.
   *
   * @param  {string} str
   * @param  {Array}  args
   * @return {string}
   */
  function interpolate (str, args) {
    return str.replace(/\$(\d{1,2})/g, function (match, index) {
      return args[index] || '';
    });
  }

  /**
   * Replace a word using a rule.
   *
   * @param  {string} word
   * @param  {Array}  rule
   * @return {string}
   */
  function replace (word, rule) {
    return word.replace(rule[0], function (match, index) {
      var result = interpolate(rule[1], arguments);

      if (match === '') {
        return restoreCase(word[index - 1], result);
      }

      return restoreCase(match, result);
    });
  }

  /**
   * Sanitize a word by passing in the word and sanitization rules.
   *
   * @param  {string}   token
   * @param  {string}   word
   * @param  {Array}    rules
   * @return {string}
   */
  function sanitizeWord (token, word, rules) {
    // Empty string or doesn't need fixing.
    if (!token.length || uncountables.hasOwnProperty(token)) {
      return word;
    }

    var len = rules.length;

    // Iterate over the sanitization rules and use the first one to match.
    while (len--) {
      var rule = rules[len];

      if (rule[0].test(word)) return replace(word, rule);
    }

    return word;
  }

  /**
   * Replace a word with the updated word.
   *
   * @param  {Object}   replaceMap
   * @param  {Object}   keepMap
   * @param  {Array}    rules
   * @return {Function}
   */
  function replaceWord (replaceMap, keepMap, rules) {
    return function (word) {
      // Get the correct token and case restoration functions.
      var token = word.toLowerCase();

      // Check against the keep object map.
      if (keepMap.hasOwnProperty(token)) {
        return restoreCase(word, token);
      }

      // Check against the replacement map for a direct word replacement.
      if (replaceMap.hasOwnProperty(token)) {
        return restoreCase(word, replaceMap[token]);
      }

      // Run all the rules against the word.
      return sanitizeWord(token, word, rules);
    };
  }

  /**
   * Check if a word is part of the map.
   */
  function checkWord (replaceMap, keepMap, rules, bool) {
    return function (word) {
      var token = word.toLowerCase();

      if (keepMap.hasOwnProperty(token)) return true;
      if (replaceMap.hasOwnProperty(token)) return false;

      return sanitizeWord(token, token, rules) === token;
    };
  }

  /**
   * Pluralize or singularize a word based on the passed in count.
   *
   * @param  {string}  word      The word to pluralize
   * @param  {number}  count     How many of the word exist
   * @param  {boolean} inclusive Whether to prefix with the number (e.g. 3 ducks)
   * @return {string}
   */
  function pluralize (word, count, inclusive) {
    var pluralized = count === 1
      ? pluralize.singular(word) : pluralize.plural(word);

    return (inclusive ? count + ' ' : '') + pluralized;
  }

  /**
   * Pluralize a word.
   *
   * @type {Function}
   */
  pluralize.plural = replaceWord(
    irregularSingles, irregularPlurals, pluralRules
  );

  /**
   * Check if a word is plural.
   *
   * @type {Function}
   */
  pluralize.isPlural = checkWord(
    irregularSingles, irregularPlurals, pluralRules
  );

  /**
   * Singularize a word.
   *
   * @type {Function}
   */
  pluralize.singular = replaceWord(
    irregularPlurals, irregularSingles, singularRules
  );

  /**
   * Check if a word is singular.
   *
   * @type {Function}
   */
  pluralize.isSingular = checkWord(
    irregularPlurals, irregularSingles, singularRules
  );

  /**
   * Add a pluralization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addPluralRule = function (rule, replacement) {
    pluralRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add a singularization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addSingularRule = function (rule, replacement) {
    singularRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add an uncountable word rule.
   *
   * @param {(string|RegExp)} word
   */
  pluralize.addUncountableRule = function (word) {
    if (typeof word === 'string') {
      uncountables[word.toLowerCase()] = true;
      return;
    }

    // Set singular and plural references for the word.
    pluralize.addPluralRule(word, '$0');
    pluralize.addSingularRule(word, '$0');
  };

  /**
   * Add an irregular word definition.
   *
   * @param {string} single
   * @param {string} plural
   */
  pluralize.addIrregularRule = function (single, plural) {
    plural = plural.toLowerCase();
    single = single.toLowerCase();

    irregularSingles[single] = plural;
    irregularPlurals[plural] = single;
  };

  /**
   * Irregular rules.
   */
  [
    // Pronouns.
    ['I', 'we'],
    ['me', 'us'],
    ['he', 'they'],
    ['she', 'they'],
    ['them', 'them'],
    ['myself', 'ourselves'],
    ['yourself', 'yourselves'],
    ['itself', 'themselves'],
    ['herself', 'themselves'],
    ['himself', 'themselves'],
    ['themself', 'themselves'],
    ['is', 'are'],
    ['was', 'were'],
    ['has', 'have'],
    ['this', 'these'],
    ['that', 'those'],
    // Words ending in with a consonant and `o`.
    ['echo', 'echoes'],
    ['dingo', 'dingoes'],
    ['volcano', 'volcanoes'],
    ['tornado', 'tornadoes'],
    ['torpedo', 'torpedoes'],
    // Ends with `us`.
    ['genus', 'genera'],
    ['viscus', 'viscera'],
    // Ends with `ma`.
    ['stigma', 'stigmata'],
    ['stoma', 'stomata'],
    ['dogma', 'dogmata'],
    ['lemma', 'lemmata'],
    ['schema', 'schemata'],
    ['anathema', 'anathemata'],
    // Other irregular rules.
    ['ox', 'oxen'],
    ['axe', 'axes'],
    ['die', 'dice'],
    ['yes', 'yeses'],
    ['foot', 'feet'],
    ['eave', 'eaves'],
    ['goose', 'geese'],
    ['tooth', 'teeth'],
    ['quiz', 'quizzes'],
    ['human', 'humans'],
    ['proof', 'proofs'],
    ['carve', 'carves'],
    ['valve', 'valves'],
    ['looey', 'looies'],
    ['thief', 'thieves'],
    ['groove', 'grooves'],
    ['pickaxe', 'pickaxes'],
    ['passerby', 'passersby']
  ].forEach(function (rule) {
    return pluralize.addIrregularRule(rule[0], rule[1]);
  });

  /**
   * Pluralization rules.
   */
  [
    [/s?$/i, 's'],
    [/[^\u0000-\u007F]$/i, '$0'],
    [/([^aeiou]ese)$/i, '$1'],
    [/(ax|test)is$/i, '$1es'],
    [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, '$1es'],
    [/(e[mn]u)s?$/i, '$1s'],
    [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, '$1'],
    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
    [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
    [/(seraph|cherub)(?:im)?$/i, '$1im'],
    [/(her|at|gr)o$/i, '$1oes'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
    [/sis$/i, 'ses'],
    [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
    [/([^aeiouy]|qu)y$/i, '$1ies'],
    [/([^ch][ieo][ln])ey$/i, '$1ies'],
    [/(x|ch|ss|sh|zz)$/i, '$1es'],
    [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
    [/\b((?:tit)?m|l)(?:ice|ouse)$/i, '$1ice'],
    [/(pe)(?:rson|ople)$/i, '$1ople'],
    [/(child)(?:ren)?$/i, '$1ren'],
    [/eaux$/i, '$0'],
    [/m[ae]n$/i, 'men'],
    ['thou', 'you']
  ].forEach(function (rule) {
    return pluralize.addPluralRule(rule[0], rule[1]);
  });

  /**
   * Singularization rules.
   */
  [
    [/s$/i, ''],
    [/(ss)$/i, '$1'],
    [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
    [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
    [/ies$/i, 'y'],
    [/\b([pl]|zomb|(?:neck|cross)?t|coll|faer|food|gen|goon|group|lass|talk|goal|cut)ies$/i, '$1ie'],
    [/\b(mon|smil)ies$/i, '$1ey'],
    [/\b((?:tit)?m|l)ice$/i, '$1ouse'],
    [/(seraph|cherub)im$/i, '$1'],
    [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i, '$1'],
    [/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i, '$1sis'],
    [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
    [/(test)(?:is|es)$/i, '$1is'],
    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
    [/(alumn|alg|vertebr)ae$/i, '$1a'],
    [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
    [/(matr|append)ices$/i, '$1ix'],
    [/(pe)(rson|ople)$/i, '$1rson'],
    [/(child)ren$/i, '$1'],
    [/(eau)x?$/i, '$1'],
    [/men$/i, 'man']
  ].forEach(function (rule) {
    return pluralize.addSingularRule(rule[0], rule[1]);
  });

  /**
   * Uncountable rules.
   */
  [
    // Singular words with no plurals.
    'adulthood',
    'advice',
    'agenda',
    'aid',
    'aircraft',
    'alcohol',
    'ammo',
    'analytics',
    'anime',
    'athletics',
    'audio',
    'bison',
    'blood',
    'bream',
    'buffalo',
    'butter',
    'carp',
    'cash',
    'chassis',
    'chess',
    'clothing',
    'cod',
    'commerce',
    'cooperation',
    'corps',
    'debris',
    'diabetes',
    'digestion',
    'elk',
    'energy',
    'equipment',
    'excretion',
    'expertise',
    'firmware',
    'flounder',
    'fun',
    'gallows',
    'garbage',
    'graffiti',
    'hardware',
    'headquarters',
    'health',
    'herpes',
    'highjinks',
    'homework',
    'housework',
    'information',
    'jeans',
    'justice',
    'kudos',
    'labour',
    'literature',
    'machinery',
    'mackerel',
    'mail',
    'media',
    'mews',
    'moose',
    'music',
    'mud',
    'manga',
    'news',
    'only',
    'personnel',
    'pike',
    'plankton',
    'pliers',
    'police',
    'pollution',
    'premises',
    'rain',
    'research',
    'rice',
    'salmon',
    'scissors',
    'series',
    'sewage',
    'shambles',
    'shrimp',
    'software',
    'species',
    'staff',
    'swine',
    'tennis',
    'traffic',
    'transportation',
    'trout',
    'tuna',
    'wealth',
    'welfare',
    'whiting',
    'wildebeest',
    'wildlife',
    'you',
    /pok[eé]mon$/i,
    // Regexes.
    /[^aeiou]ese$/i, // "chinese", "japanese"
    /deer$/i, // "deer", "reindeer"
    /fish$/i, // "fish", "blowfish", "angelfish"
    /measles$/i,
    /o[iu]s$/i, // "carnivorous"
    /pox$/i, // "chickpox", "smallpox"
    /sheep$/i
  ].forEach(pluralize.addUncountableRule);

  return pluralize;
});
});

const preserveCamelCase = string => {
	let isLastCharLower = false;
	let isLastCharUpper = false;
	let isLastLastCharUpper = false;

	for (let i = 0; i < string.length; i++) {
		const character = string[i];

		if (isLastCharLower && /[a-zA-Z]/.test(character) && character.toUpperCase() === character) {
			string = string.slice(0, i) + '-' + string.slice(i);
			isLastCharLower = false;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = true;
			i++;
		} else if (isLastCharUpper && isLastLastCharUpper && /[a-zA-Z]/.test(character) && character.toLowerCase() === character) {
			string = string.slice(0, i - 1) + '-' + string.slice(i - 1);
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = false;
			isLastCharLower = true;
		} else {
			isLastCharLower = character.toLowerCase() === character && character.toUpperCase() !== character;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = character.toUpperCase() === character && character.toLowerCase() !== character;
		}
	}

	return string;
};

const camelCase = (input, options) => {
	if (!(typeof input === 'string' || Array.isArray(input))) {
		throw new TypeError('Expected the input to be `string | string[]`');
	}

	options = Object.assign({
		pascalCase: false
	}, options);

	const postProcess = x => options.pascalCase ? x.charAt(0).toUpperCase() + x.slice(1) : x;

	if (Array.isArray(input)) {
		input = input.map(x => x.trim())
			.filter(x => x.length)
			.join('-');
	} else {
		input = input.trim();
	}

	if (input.length === 0) {
		return '';
	}

	if (input.length === 1) {
		return options.pascalCase ? input.toUpperCase() : input.toLowerCase();
	}

	const hasUpperCase = input !== input.toLowerCase();

	if (hasUpperCase) {
		input = preserveCamelCase(input);
	}

	input = input
		.replace(/^[_.\- ]+/, '')
		.toLowerCase()
		.replace(/[_.\- ]+(\w|$)/g, (_, p1) => p1.toUpperCase())
		.replace(/\d+(\w|$)/g, m => m.toUpperCase());

	return postProcess(input);
};

var camelcase = camelCase;
// TODO: Remove this for the next major release
var default_1 = camelCase;
camelcase.default = default_1;

var MSTGQLStore = types.model("MSTGQLStore", {
  __queryCache: types.optional(types.map(types.frozen()), {})
}).volatile(function (self) {
  var ref = getEnv(self);
  var ssr = ref.ssr; if ( ssr === void 0 ) ssr = false;
  return {
    ssr: ssr,
    __promises: new Map(),
    __afterInit: false
  };
}).actions(function (self) {
  Promise.resolve().then(function () { return self.__onAfterInit(); });
  var ref = getEnv(self);
  var gqlHttpClient = ref.gqlHttpClient;
  var gqlWsClient = ref.gqlWsClient;
  if (!gqlHttpClient && !gqlWsClient) { throw new Error("Either gqlHttpClient or gqlWsClient (or both) should provided in the MSTGQLStore environment"); }

  function merge(data) {
    return mergeHelper(self, data);
  }

  function deflate(data) {
    return deflateHelper(self, data);
  }

  function rawRequest(query, variables) {
    if (gqlHttpClient) { return gqlHttpClient.request(query, variables); }else {
      return new Promise(function (resolve, reject) {
        gqlWsClient.request({
          query: query,
          variables: variables
        }).subscribe({
          next: function next(data) {
            resolve(data.data);
          },

          error: reject
        });
      });
    }
  }

  function query(query, variables, options) {
    if ( options === void 0 ) options = {};

    return new Query(self, query, variables, options);
  }

  function mutate(mutation, variables, optimisticUpdate, checkError) {
    if (optimisticUpdate) {
      var recorder = recordPatches(self);
      optimisticUpdate();
      recorder.stop();
      var q = query(mutation, variables, {
        fetchPolicy: "network-only"
      });
      q.currentPromise().then(function (result) {
        if (checkError && checkError(result)) { recorder.undo(); }
        return result;
      }).catch(function () {
        recorder.undo();
      });
      return q;
    } else {
      return query(mutation, variables, {
        fetchPolicy: "network-only"
      });
    }
  } // N.b: the T is ignored, but it does simplify code generation


  function subscribe(query, variables, onData) {
    if (!gqlWsClient) { throw new Error("No WS client available"); }
    var sub = gqlWsClient.request({
      query: query,
      variables: variables
    }).subscribe({
      next: function next(data) {
        if (data.errors) { throw new Error(JSON.stringify(data.errors)); }

        self.__runInStoreContext(function () {
          var res = self.merge(getFirstValue(data.data));
          if (onData) { onData(res); }
          return res;
        });
      }

    });
    return function () { return sub.unsubscribe(); };
  } // exposed actions


  return {
    merge: merge,
    deflate: deflate,
    mutate: mutate,
    query: query,
    subscribe: subscribe,
    rawRequest: rawRequest,

    __pushPromise: function __pushPromise(promise, queryKey) {
      self.__promises.set(queryKey, promise);

      var onSettled = function () { return self.__promises.delete(queryKey); };

      promise.then(onSettled, onSettled);
    },

    __runInStoreContext: function __runInStoreContext(fn) {
      return fn();
    },

    __cacheResponse: function __cacheResponse(key, response) {
      self.__queryCache.set(key, response);
    },

    __onAfterInit: function __onAfterInit() {
      self.__afterInit = true;
    }

  };
});
function configureStoreMixin(knownTypes, rootTypes, namingConvention) {
  var kt = new Map();
  var rt = new Set(rootTypes);
  return function () { return ({
    actions: {
      afterCreate: function afterCreate() {
        // initialized lazily, so that there are no circular dep issues
        knownTypes.forEach(function (ref) {
          var key = ref[0];
          var typeFn = ref[1];

          var type = typeFn();
          if (!type) { throw new Error(("The type provided for '" + key + "' is empty. Probably this is a module loading issue")); }
          kt.set(key, type);
        });
      }

    },
    views: {
      isKnownType: function isKnownType(typename) {
        return kt.has(typename);
      },

      isRootType: function isRootType(typename) {
        return rt.has(typename);
      },

      getTypeDef: function getTypeDef(typename) {
        return kt.get(typename);
      },

      getCollectionName: function getCollectionName(typename) {
        if (namingConvention == "js") {
          // Pluralize only last word (pluralize may fail with words that are
          // not valid English words as is the case with LongCamelCaseTypeNames)
          var newName = camelcase(typename);
          var parts = newName.split(/(?=[A-Z])/);
          parts[parts.length - 1] = pluralize(parts[parts.length - 1]);
          return parts.join("");
        }

        return typename.toLowerCase() + "s";
      }

    }
  }); };
}

/*
 For detached objects (objects that are not part of the Roots, or one of their children, for example: query results),
 we cannot use the default resolution mechanism, since they are not part of the store. So, first fetch the store and resolve from there
*/

function MSTGQLRef(targetType) {
  return types.reference(targetType, {
    get: function get(id, parent) {
      var node = resolveIdentifier(targetType, parent.store || getParent(parent).store, id);

      if (!node) {
        throw new Error(("Failed to resolve reference " + id + " to " + (targetType.name)));
      }

      return node;
    },

    set: function set(value) {
      return value.id;
    }

  });
}
var MSTGQLObject = types.model("MSTGQLObject").extend(function (self) {
  var store;

  function getStore() {
    return store || (store = getParent(self, 2));
  }

  return {
    actions: {
      __setStore: function __setStore(s) {
        store = s;
      }

    },
    views: {
      __getStore: function __getStore() {
        return getStore();
      },

      hasLoaded: function hasLoaded(key) {
        return typeof self[key] !== "undefined";
      }

    }
  };
});

function createHttpClient(url, options) {
  if ( options === void 0 ) options = {};

  return new GraphQLClient(url, options);
}

var QueryBuilder = function QueryBuilder() {
  this.__query = "";

  this.__attr("__typename");

  if (typeof this.id === "function") { this.id(); }
};

QueryBuilder.prototype.__attr = function __attr (attr) {
  return this._(attr);
}; // raw is exposed, to be able to add free form gql in the middle


QueryBuilder.prototype._ = function _ (str) {
  this.__query += str + "\n"; // TODO: restore depth / formatting by passing base depth to constructor: ${"".padStart(this.__qb.stack.length * 2)}

  return this;
};

QueryBuilder.prototype.__child = function __child (childName, childType, builder) {
  this._((childName + " {\n"));

  this.__buildChild(childType, builder);

  this._("}");

  return this;
}; // used for interfaces and unions


QueryBuilder.prototype.__inlineFragment = function __inlineFragment (childName, childType, builder) {
  this._(("... on " + childName + " {\n"));

  this.__buildChild(childType, builder);

  this._("}");

  return this;
};

QueryBuilder.prototype.__buildChild = function __buildChild (childType, builder) {
  // already instantiated child builder
  if (builder instanceof QueryBuilder) {
    this._(builder.toString());
  } else {
    var childBuilder = new childType();
    if (typeof builder === "string") { childBuilder._(builder); }else if (typeof builder === "function") { builder(childBuilder); } // undefined is ok as well, no fields at all

    this._(childBuilder.toString());
  }
};

QueryBuilder.prototype.toString = function toString () {
  return this.__query;
};

function localStorageMixin(options) {
  if ( options === void 0 ) options = {};

  var storage = options.storage || window.localStorage;
  var throttleInterval = options.throttle || 5000;
  var storageKey = options.storageKey || "mst-gql-rootstore";
  return function (self) { return ({
    actions: {
      afterCreate: function () {
        try {
          return Promise.resolve(storage.getItem(storageKey)).then(function (data) {
            if (data) {
              var json = JSON.parse(data);
              var selfType = getType(self);

              if (!selfType.is(json)) {
                console.warn(("Data in local storage does not conform the data shape specified by " + (selfType.name) + ", ignoring the stored data"));
                return;
              }

              applySnapshot(self, json);
            }

            addDisposer(self, onSnapshot(self, throttle(function (data) {
              storage.setItem(storageKey, JSON.stringify(data));
            }, throttleInterval)));
          });
        } catch (e) {
          return Promise.reject(e);
        }
      }
    }
  }); };
}

function throttle(fn, delay) {
  var lastCall = 0;
  var scheduled = false;
  return function () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    // already scheduled
    if (scheduled) { return; }
    var now = +new Date();

    if (now - lastCall < delay) {
      if (!scheduled) {
        // within throttle period, but no next tick scheduled, schedule now
        scheduled = true;
        setTimeout(function () {
          // run and reset
          lastCall = +new Date();
          scheduled = false;
          fn.apply(null, args);
        }, delay - (now - lastCall) + 10); // fire at the end of the current delay period
      }
    } else {
      // outside throttle period, can execute immediately
      lastCall = now;
      fn.apply(null, args);
    }
  };
}

// A type of promise-like that resolves synchronously and supports only one observer
const _Pact = /*#__PURE__*/(function() {
	function _Pact() {}
	_Pact.prototype.then = function(onFulfilled, onRejected) {
		const result = new _Pact();
		const state = this.s;
		if (state) {
			const callback = state & 1 ? onFulfilled : onRejected;
			if (callback) {
				try {
					_settle(result, 1, callback(this.v));
				} catch (e) {
					_settle(result, 2, e);
				}
				return result;
			} else {
				return this;
			}
		}
		this.o = function(_this) {
			try {
				const value = _this.v;
				if (_this.s & 1) {
					_settle(result, 1, onFulfilled ? onFulfilled(value) : value);
				} else if (onRejected) {
					_settle(result, 1, onRejected(value));
				} else {
					_settle(result, 2, value);
				}
			} catch (e) {
				_settle(result, 2, e);
			}
		};
		return result;
	};
	return _Pact;
})();

// Settles a pact synchronously
function _settle(pact, state, value) {
	if (!pact.s) {
		if (value instanceof _Pact) {
			if (value.s) {
				if (state & 1) {
					state = value.s;
				}
				value = value.v;
			} else {
				value.o = _settle.bind(null, pact, state);
				return;
			}
		}
		if (value && value.then) {
			value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
			return;
		}
		pact.s = state;
		pact.v = value;
		const observer = pact.o;
		if (observer) {
			observer(pact);
		}
	}
}

function _isSettledPact(thenable) {
	return thenable instanceof _Pact && thenable.s & 1;
}

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously implement a generic for loop
function _for(test, update, body) {
	var stage;
	for (;;) {
		var shouldContinue = test();
		if (_isSettledPact(shouldContinue)) {
			shouldContinue = shouldContinue.v;
		}
		if (!shouldContinue) {
			return result;
		}
		if (shouldContinue.then) {
			stage = 0;
			break;
		}
		var result = body();
		if (result && result.then) {
			if (_isSettledPact(result)) {
				result = result.s;
			} else {
				stage = 1;
				break;
			}
		}
		if (update) {
			var updateValue = update();
			if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
				stage = 2;
				break;
			}
		}
	}
	var pact = new _Pact();
	var reject = _settle.bind(null, pact, 2);
	(stage === 0 ? shouldContinue.then(_resumeAfterTest) : stage === 1 ? result.then(_resumeAfterBody) : updateValue.then(_resumeAfterUpdate)).then(void 0, reject);
	return pact;
	function _resumeAfterBody(value) {
		result = value;
		do {
			if (update) {
				updateValue = update();
				if (updateValue && updateValue.then && !_isSettledPact(updateValue)) {
					updateValue.then(_resumeAfterUpdate).then(void 0, reject);
					return;
				}
			}
			shouldContinue = test();
			if (!shouldContinue || (_isSettledPact(shouldContinue) && !shouldContinue.v)) {
				_settle(pact, 1, result);
				return;
			}
			if (shouldContinue.then) {
				shouldContinue.then(_resumeAfterTest).then(void 0, reject);
				return;
			}
			result = body();
			if (_isSettledPact(result)) {
				result = result.v;
			}
		} while (!result || !result.then);
		result.then(_resumeAfterBody).then(void 0, reject);
	}
	function _resumeAfterTest(shouldContinue) {
		if (shouldContinue) {
			result = body();
			if (result && result.then) {
				result.then(_resumeAfterBody).then(void 0, reject);
			} else {
				_resumeAfterBody(result);
			}
		} else {
			_settle(pact, 1, result);
		}
	}
	function _resumeAfterUpdate() {
		if (shouldContinue = test()) {
			if (shouldContinue.then) {
				shouldContinue.then(_resumeAfterTest).then(void 0, reject);
			} else {
				_resumeAfterTest(shouldContinue);
			}
		} else {
			_settle(pact, 1, result);
		}
	}
}

var getDataFromTree = function (tree, client, renderFunction) {
  try {
    var _exit = false;
    if (renderFunction === undefined) { renderFunction = require("react-dom/server").renderToStaticMarkup; }
    return Promise.resolve(_for(function () {
      return !_exit;
    }, void 0, function () {
      var html = renderFunction(tree);

      if (client.__promises.size === 0) {
        _exit = true;
        return html;
      }

      return Promise.resolve(Promise.all(client.__promises.values())).then(function () {});
    }));
  } catch (e) {
    return Promise.reject(e);
  }
};
function createStoreContext(React) {
  return React.createContext(null);
}

function normalizeQuery(store, query, ref) {
  var variables = ref.variables;
  var fetchPolicy = ref.fetchPolicy; if ( fetchPolicy === void 0 ) fetchPolicy = "cache-and-network";

  if (typeof query === "function") { return query(store); }
  if (query instanceof Query) { return query; }
  return store.query(query, variables, {
    fetchPolicy: fetchPolicy
  });
}

function createUseQueryHook(context, React) {
  return function (queryIn, opts) {
    if ( queryIn === void 0 ) queryIn = undefined;
    if ( opts === void 0 ) opts = {};

    var store = opts && opts.store || React.useContext(context); // const prevData = useRef<DATA>() // TODO: is this useful?

    var ref = React.useState(function () {
      if (!queryIn) { return undefined; }
      return normalizeQuery(store, queryIn, opts);
    });
    var query = ref[0];
    var setQuery = ref[1];
    var setQueryHelper = React.useCallback(function (newQuery) {
      // if the current query had results already, save it in prevData
      // if (query && query.data) prevData.current = query.data
      setQuery(normalizeQuery(store, newQuery, opts));
    }, []); // if new query or variables are passed in, replace the query!

    React.useEffect(function () {
      if (!queryIn || typeof queryIn === "function") { return; } // ignore changes to initializer func

      setQueryHelper(queryIn);
    }, [queryIn, opts.fetchPolicy, JSON.stringify(opts.variables)]); // TODO: use a decent deep equal

    return {
      store: store,
      loading: query ? query.loading : false,
      error: query && query.error,
      data: query && query.data,
      // prevData: prevData.current,
      query: query,
      setQuery: setQueryHelper
    };
  };
}

function withTypedRefs() {
  return function (model) {
    return model;
  };
}

export { MSTGQLStore, configureStoreMixin, Query, MSTGQLObject, MSTGQLRef, createHttpClient, QueryBuilder, localStorageMixin, getDataFromTree, createStoreContext, createUseQueryHook, withTypedRefs };
//# sourceMappingURL=mst-gql.module.js.map
