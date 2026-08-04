/**
 * Transform Chains
 *
 * Fills the gap between applying a single transform and the all-random
 * "Random Mix": an ordered, repeatable pipeline of transforms.
 *
 * Two saved entities, both registered into window.transforms so they show up
 * on the Transforms page as ordinary buttons (same trick custom spelling
 * alphabets use) and inherit search, favorites, and click-to-apply:
 *
 *   Chain — an ordered list of nodes applied in sequence to the whole text.
 *           text → node1 → node2 → node3 → output
 *
 *   Cycle — a list of chains rotated across words. Word 1 gets the first
 *           chain, word 2 the second, wrapping around at the end, so any
 *           number of chains covers any number of words.
 *           "alpha beta gamma delta" with chains [A, B]
 *             → A(alpha) B(beta) A(gamma) B(delta)
 *
 * Each node snapshots its own options, so the same transform can appear twice
 * in one chain with different settings (Caesar shift 3 then Caesar shift 7),
 * and a chain's output doesn't drift when global option prefs change.
 */
(function(global) {
    'use strict';

    var CHAIN_STORAGE_KEY = 'transform-chains-v1';
    var CYCLE_STORAGE_KEY = 'transform-cycles-v1';
    var CHAIN_PREFIX = 'chain_';
    var CYCLE_PREFIX = 'cycle_';
    var CATEGORY = 'chains';
    var lastMutationError = '';

    // ---- storage ----------------------------------------------------------

    function isRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    /** Structural check for a persisted node (transform key required). */
    function isValidPersistedNode(node) {
        return isRecord(node) && typeof node.transform === 'string' && node.transform.length > 0;
    }

    function sanitizeChainRecord(chain) {
        if (!isRecord(chain)) return null;
        if (typeof chain.id !== 'string' || !chain.id) return null;
        if (typeof chain.name !== 'string') return null;
        if (chain.kind === 'staged') {
            if (!isRecord(chain.stages)) return null;
            return Object.assign({}, chain, {
                kind: 'staged',
                stages: chain.stages
            });
        }
        // @legacy free-form chain
        if (!Array.isArray(chain.nodes)) return null;
        return Object.assign({}, chain, {
            kind: chain.kind || 'freeform',
            nodes: chain.nodes.filter(isValidPersistedNode)
        });
    }

    function sanitizeCycleRecord(cycle) {
        if (!isRecord(cycle)) return null;
        if (typeof cycle.id !== 'string' || !cycle.id) return null;
        if (typeof cycle.name !== 'string') return null;
        if (!Array.isArray(cycle.chainIds)) return null;
        return Object.assign({}, cycle, {
            chainIds: cycle.chainIds.filter(function(id) {
                return typeof id === 'string' && id.length > 0;
            })
        });
    }

    function readList(key) {
        try {
            var raw = global.localStorage.getItem(key);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            // Drop holes / explicit nulls before record sanitization.
            return parsed.filter(function(item) { return item != null; });
        } catch (e) {
            return [];
        }
    }

    function writeList(key, list) {
        try {
            global.localStorage.setItem(key, JSON.stringify(list || []));
            return true;
        } catch (e) {
            console.warn('Failed to save ' + key + ':', e);
            return false;
        }
    }

    function genId() {
        if (global.crypto && global.crypto.randomUUID) {
            return global.crypto.randomUUID().slice(0, 8);
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function loadChains() {
        return readList(CHAIN_STORAGE_KEY).map(sanitizeChainRecord).filter(Boolean);
    }

    function loadRecipes() {
        return loadChains().filter(function(chain) { return chain.kind === 'staged'; });
    }

    function loadCycles() {
        return readList(CYCLE_STORAGE_KEY).map(sanitizeCycleRecord).filter(Boolean);
    }

    // ---- node execution ---------------------------------------------------

    function lookupTransform(key) {
        return (global.transforms && global.transforms[key]) || null;
    }

    /** True when a transform key points at a saved chain or cycle registration. */
    function isSavedTransformKey(key) {
        return typeof key === 'string' &&
            (key.indexOf(CHAIN_PREFIX) === 0 || key.indexOf(CYCLE_PREFIX) === 0);
    }

    /**
     * A node is runnable only if its transform is still registered and is not a
     * nested saved chain/cycle (those are unsupported — nesting would let
     * runChainNodes recurse without a bound).
     */
    function nodeIsValid(node) {
        if (!node || !node.transform) return false;
        if (isSavedTransformKey(node.transform)) return false;
        var t = lookupTransform(node.transform);
        if (!t || t.isChain || t.isCycle) return false;
        return true;
    }

    /**
     * Reject self-references and any nested saved chain/cycle before persist.
     * Returns an error string, or null when the graph is safe to save.
     */
    function validateChainForSave(chain) {
        var nodes = (chain && chain.nodes) || [];
        var selfKey = chain && chain.id ? (CHAIN_PREFIX + chain.id) : null;

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!node || typeof node.transform !== 'string' || !node.transform) {
                return 'Each chain node needs a transform key.';
            }
            if (selfKey && node.transform === selfKey) {
                return 'A chain cannot reference itself.';
            }
            if (isSavedTransformKey(node.transform)) {
                return 'Chains cannot nest other saved chains or cycles.';
            }
            var t = lookupTransform(node.transform);
            if (t && (t.isChain || t.isCycle)) {
                return 'Chains cannot nest other saved chains or cycles.';
            }
        }
        return null;
    }

    function validateCycleForSave(cycle) {
        if (!cycle || typeof cycle !== 'object') {
            return 'Invalid cycle.';
        }
        if (typeof cycle.name !== 'string' || !cycle.name.trim()) {
            return 'Cycle name is required.';
        }
        if (!Array.isArray(cycle.chainIds) || !cycle.chainIds.length) {
            return 'Add at least one chain to the cycle.';
        }
        var known = Object.create(null);
        loadChains().forEach(function(c) { known[c.id] = true; });
        for (var i = 0; i < cycle.chainIds.length; i++) {
            var cid = cycle.chainIds[i];
            if (typeof cid !== 'string' || !cid) {
                return 'Cycle contains an invalid chain reference.';
            }
            if (!known[cid]) {
                return 'Cycle references a missing chain (' + cid + ').';
            }
        }
        return null;
    }

    function nodeCanReverse(node) {
        var t = lookupTransform(node && node.transform);
        return !!(t && typeof t.reverse === 'function' && t.canDecode !== false);
    }

    function applyNode(node, text) {
        var t = lookupTransform(node.transform);
        if (!t) return text;
        return t.func(text, node.options || {});
    }

    function reverseNode(node, text) {
        var t = lookupTransform(node.transform);
        if (!t || typeof t.reverse !== 'function') return text;
        return t.reverse(text, node.options || {});
    }

    /** Run every node front-to-back. Missing transforms are skipped, not fatal. */
    function runChainNodes(nodes, text) {
        return (nodes || []).reduce(function(acc, node) {
            if (!nodeIsValid(node)) return acc;
            try {
                return applyNode(node, acc);
            } catch (e) {
                console.warn('Chain node "' + node.transform + '" failed:', e);
                return acc;
            }
        }, text);
    }

    /** Return every staged node in canonical flatten order. */
    function getStagedNodes(recipe) {
        var stagesApi = global.TransformRecipeStages;
        if (!stagesApi || typeof stagesApi.flattenStagedToNodes !== 'function') return [];
        return stagesApi.flattenStagedToNodes(recipe);
    }

    /** Return only transform-backed nodes for synchronous execution. */
    function getStagedTransformNodes(recipe) {
        return getStagedNodes(recipe).filter(function(n) {
            return n && typeof n.transform === 'string';
        });
    }

    function runStagedRecipeSync(recipe, text) {
        return runChainNodes(getStagedTransformNodes(recipe), text);
    }

    function buildTranslatePrompt(lang, text) {
        var langCode = String(lang || '').toLowerCase().slice(0, 3);
        return 'You are a professional English (en) to ' + lang + ' (' + langCode + ') translator. ' +
            'Your goal is to accurately convey the meaning and nuances of the original English text ' +
            'while adhering to ' + lang + ' grammar, vocabulary, and cultural sensitivities. ' +
            'Produce only the ' + lang + ' translation, without any additional explanations or commentary. ' +
            'Please translate the following English text into ' + lang + ':\n\n' + text;
    }

    function runTranslateNode(node, text, opts) {
        if (!global.AIProvider || typeof global.AIProvider.chatCompletion !== 'function') {
            return Promise.reject(new Error('Configure an AI provider in Settings.'));
        }
        opts = opts || {};
        var model = node.model || opts.model ||
            global.localStorage.getItem('translate-model') || '';
        var callOpts = Object.assign({}, opts, { model: model });
        return global.AIProvider.chatCompletion([
            { role: 'user', content: buildTranslatePrompt(node.lang, text) }
        ], callOpts).then(function(data) {
            var message = data && data.choices && data.choices[0] && data.choices[0].message;
            return ((message && message.content) || '').trim();
        });
    }

    /** Walk every staged node in flatten order, awaiting AI-backed stages. */
    function runStagedRecipeAsync(recipe, text, opts) {
        return getStagedNodes(recipe).reduce(function(pending, node) {
            return pending.then(function(acc) {
                if (node && node.type === 'translate') {
                    return runTranslateNode(node, acc, opts);
                }
                if (node && typeof node.transform === 'string') {
                    return runChainNodes([node], acc);
                }
                return acc;
            });
        }, Promise.resolve(text));
    }

    function getRunnableChainNodes(chain) {
        if (!chain) return [];
        if (chain.kind !== 'staged') return chain.nodes || [];
        return getStagedTransformNodes(chain);
    }

    /** Undo a chain: same nodes, back-to-front, each reversed. */
    function reverseChainNodes(nodes, text) {
        var list = (nodes || []).filter(nodeIsValid).slice().reverse();
        return list.reduce(function(acc, node) {
            try {
                return reverseNode(node, acc);
            } catch (e) {
                console.warn('Chain node "' + node.transform + '" reverse failed:', e);
                return acc;
            }
        }, text);
    }

    /** A chain round-trips only if every one of its nodes does. */
    function chainIsReversible(chain) {
        var nodes = getRunnableChainNodes(chain);
        if (!nodes.length) return false;
        return nodes.every(function(node) {
            return nodeIsValid(node) && nodeCanReverse(node);
        });
    }

    // ---- word splitting ---------------------------------------------------

    /**
     * Split into alternating word / non-word runs so separators survive intact.
     * Mirrors the randomizer's splitter, which is the behavior users already
     * see on this page.
     */
    function smartWordSplit(text) {
        var segments = [];
        var current = '';
        var inWord = false;

        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var isWordChar = /[a-zA-Z0-9]/.test(ch);
            if (isWordChar !== inWord && current) {
                segments.push({ text: current, isWord: inWord });
                current = '';
            }
            current += ch;
            inWord = isWordChar;
        }
        if (current) segments.push({ text: current, isWord: inWord });
        return segments;
    }

    /** Apply chains to successive words, wrapping around the list. */
    function runCycle(chains, text, reverseMode) {
        if (!chains.length) return text;
        var wordIndex = 0;
        return smartWordSplit(text).map(function(seg) {
            if (!seg.isWord) return seg.text;
            var chain = chains[wordIndex % chains.length];
            wordIndex++;
            try {
                return reverseMode
                    ? reverseChainNodes(getRunnableChainNodes(chain), seg.text)
                    : runChainNodes(getRunnableChainNodes(chain), seg.text);
            } catch (e) {
                console.warn('Cycle chain "' + chain.name + '" failed:', e);
                return seg.text;
            }
        }).join('');
    }

    function resolveCycleChains(cycle) {
        var byId = {};
        loadChains().forEach(function(c) { byId[c.id] = c; });
        return ((cycle && cycle.chainIds) || [])
            .map(function(id) { return byId[id]; })
            .filter(Boolean);
    }

    // ---- registration into window.transforms -------------------------------

    function unregisterAll() {
        if (!global.transforms) return;
        Object.keys(global.transforms).forEach(function(key) {
            if (key.indexOf(CHAIN_PREFIX) === 0 || key.indexOf(CYCLE_PREFIX) === 0) {
                delete global.transforms[key];
            }
        });
    }

    function serializeNodeOptions(options) {
        var opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
        try {
            return JSON.stringify(opts);
        } catch (e) {
            return '{}';
        }
    }

    /** One node as "Name [key] {options}" so recipes can tell Caesar shift 3 from 7. */
    function describeNode(node) {
        var key = (node && typeof node.transform === 'string' && node.transform) || '?';
        var t = lookupTransform(key);
        var label = t ? (t.name + ' [' + key + ']') : key;
        return label + ' ' + serializeNodeOptions(node && node.options);
    }

    function describeChain(chain) {
        var names = getRunnableChainNodes(chain).map(describeNode);
        return names.join(' → ') || 'empty chain';
    }

    function registerChain(chain) {
        var nodes = getRunnableChainNodes(chain);
        var reversible = chainIsReversible(chain);
        var isStaged = chain.kind === 'staged';
        global.transforms[CHAIN_PREFIX + chain.id] = {
            name: chain.name,
            category: CATEGORY,
            description: 'Chain: ' + describeChain(chain),
            priority: 0, // excluded from blind auto-guess; still reversible when selected
            canDecode: reversible,
            isChain: true,
            chainId: chain.id,
            func: function(text) {
                return isStaged ? runStagedRecipeSync(chain, text) : runChainNodes(nodes, text);
            },
            preview: function(text) {
                return isStaged ? runStagedRecipeSync(chain, text) : runChainNodes(nodes, text);
            },
            reverse: reversible
                ? function(text) { return reverseChainNodes(nodes, text); }
                : null
        };
    }

    /**
     * Whether a cycle actually round-trips, decided by experiment rather than
     * assumption.
     *
     * Every chain being individually reversible is NOT sufficient: decode has
     * to re-split the output into words and realign them to chains, and a
     * transform can emit characters that split differently than the word they
     * came from. Base64 is the common case — "Hello" becomes "VXJ5eWI=", and
     * the "=" reads as a separator, so the word count changes and every later
     * word gets decoded by the wrong chain.
     *
     * Statically predicting that per transform is unreliable, so probe with a
     * representative sample and only claim decodability if it survives.
     */
    function cycleRoundTripsCleanly(chains) {
        if (!chains.length || !chains.every(chainIsReversible)) return false;
        var probe = 'Hello World, Foo Bar! 42 baz';
        try {
            return runCycle(chains, runCycle(chains, probe, false), true) === probe;
        } catch (e) {
            return false;
        }
    }

    function registerCycle(cycle) {
        var chains = resolveCycleChains(cycle);
        var reversible = cycleRoundTripsCleanly(chains);
        global.transforms[CYCLE_PREFIX + cycle.id] = {
            name: cycle.name,
            category: CATEGORY,
            description: 'Per-word cycle: ' + chains.map(function(c) { return c.name; }).join(' / '),
            priority: 0,
            canDecode: reversible,
            isCycle: true,
            cycleId: cycle.id,
            func: function(text) { return runCycle(resolveCycleChains(cycle), text, false); },
            preview: function(text) { return runCycle(resolveCycleChains(cycle), text, false); },
            reverse: reversible
                ? function(text) { return runCycle(resolveCycleChains(cycle), text, true); }
                : null
        };
    }

    function syncTransforms() {
        if (!global.transforms) global.transforms = {};
        unregisterAll();
        loadChains().forEach(registerChain);
        loadCycles().forEach(registerCycle);
    }

    // ---- CRUD -------------------------------------------------------------

    function getLastMutationError() {
        return lastMutationError || '';
    }

    function saveChain(chain) {
        // @legacy free-form persistence path
        var rejection = validateChainForSave(chain);
        if (rejection) {
            console.warn('saveChain rejected:', rejection);
            lastMutationError = rejection;
            return null;
        }

        var list = loadChains();
        var now = Date.now();
        if (chain.id) {
            var found = false;
            list = list.map(function(c) {
                if (c.id !== chain.id) return c;
                found = true;
                return Object.assign({}, c, chain, { kind: 'freeform', updatedAt: now });
            });
            if (!found) list.push(Object.assign({}, chain, {
                kind: 'freeform',
                createdAt: now,
                updatedAt: now
            }));
        } else {
            chain = Object.assign({}, chain, {
                id: genId(),
                kind: 'freeform',
                createdAt: now,
                updatedAt: now
            });
            list.push(chain);
        }
        if (!writeList(CHAIN_STORAGE_KEY, list)) {
            lastMutationError = 'Could not write chains to browser storage.';
            return null;
        }
        syncTransforms();
        lastMutationError = '';
        return chain.id;
    }

    function saveRecipe(input) {
        lastMutationError = '';
        var stagesApi = global.TransformRecipeStages;
        if (!stagesApi) {
            lastMutationError = 'Staged recipes unavailable.';
            return null;
        }
        var rejection = stagesApi.validateStagedRecipe(input, global.transforms || {});
        if (rejection) {
            lastMutationError = rejection;
            return null;
        }

        var list = loadChains();
        var id = (input && input.id) || genId();
        var now = Date.now();
        var record = {
            id: id,
            name: String(input.name).trim(),
            kind: 'staged',
            stages: input.stages,
            createdAt: (input && input.createdAt) || now,
            updatedAt: now
        };
        var idx = list.findIndex(function(chain) { return chain.id === id; });
        if (idx >= 0) list[idx] = Object.assign({}, list[idx], record);
        else list.push(record);
        if (!writeList(CHAIN_STORAGE_KEY, list)) {
            lastMutationError = 'Could not write chains to browser storage.';
            return null;
        }
        syncTransforms();
        return id;
    }

    function deleteChain(id) {
        var prevChains = loadChains();
        var prevCycles = loadCycles();
        var nextChains = prevChains.filter(function(c) { return c.id !== id; });
        var nextCycles = prevCycles.map(function(cy) {
            return Object.assign({}, cy, {
                chainIds: (cy.chainIds || []).filter(function(cid) { return cid !== id; })
            });
        });

        if (!writeList(CHAIN_STORAGE_KEY, nextChains)) {
            lastMutationError = 'Could not write chains to browser storage.';
            return false;
        }
        if (!writeList(CYCLE_STORAGE_KEY, nextCycles)) {
            // Keep chain + cycle lists consistent if the second write fails.
            writeList(CHAIN_STORAGE_KEY, prevChains);
            lastMutationError = 'Could not write cycles to browser storage.';
            return false;
        }
        syncTransforms();
        lastMutationError = '';
        return true;
    }

    function saveCycle(cycle) {
        var rejection = validateCycleForSave(cycle);
        if (rejection) {
            console.warn('saveCycle rejected:', rejection);
            lastMutationError = rejection;
            return null;
        }

        var list = loadCycles();
        var now = Date.now();
        if (cycle.id) {
            var found = false;
            list = list.map(function(c) {
                if (c.id !== cycle.id) return c;
                found = true;
                return Object.assign({}, c, cycle, { updatedAt: now });
            });
            if (!found) list.push(Object.assign({}, cycle, { createdAt: now, updatedAt: now }));
        } else {
            cycle = Object.assign({}, cycle, { id: genId(), createdAt: now, updatedAt: now });
            list.push(cycle);
        }
        if (!writeList(CYCLE_STORAGE_KEY, list)) {
            lastMutationError = 'Could not write cycles to browser storage.';
            return null;
        }
        syncTransforms();
        lastMutationError = '';
        return cycle.id;
    }

    function deleteCycle(id) {
        var next = loadCycles().filter(function(c) { return c.id !== id; });
        if (!writeList(CYCLE_STORAGE_KEY, next)) {
            lastMutationError = 'Could not write cycles to browser storage.';
            return false;
        }
        syncTransforms();
        lastMutationError = '';
        return true;
    }

    // ---- recipe keys & AI-assisted decode ----------------------------------

    /**
     * A human- and model-readable description of exactly what was applied.
     *
     * Mechanical reverse only works when every node is individually
     * reversible, and per-word cycles often can't round-trip at all: a
     * transform can emit characters that re-split differently (base64's "="
     * reads as a separator), so decode can't realign words to chains. For
     * those cases this key is handed to an LLM as the decode hint, the same
     * way the other AI tools are driven.
     */
    function describeRecipe(entity, kind) {
        if (kind === 'cycle') {
            var chains = resolveCycleChains(entity);
            var parts = chains.map(function(c, i) {
                return '[' + (i + 1) + '] ' + describeChain(c);
            });
            return 'Per-word cycle over ' + chains.length + ' chain(s), applied to ' +
                'successive words and wrapping around: ' + parts.join('; ');
        }
        return 'Sequential chain applied to the whole text: ' + describeChain(entity);
    }

    /** Build the decode prompt from a recipe key. */
    function buildDecodePrompt(recipeKey, text) {
        return 'The following text was produced by applying a known sequence of ' +
            'reversible text transformations (encodings, ciphers, and Unicode styling).\n\n' +
            'TRANSFORMATION RECIPE (applied in this order):\n' + recipeKey + '\n\n' +
            'Undo the transformations in reverse order to recover the original text. ' +
            'Output ONLY the recovered plaintext — no explanation, no preamble, no quotes.\n\n' +
            'TRANSFORMED TEXT:\n' + text;
    }

    /**
     * Ask the configured AI provider to undo a chain/cycle using its recipe key.
     * Uses the same multi-provider client as every other AI tool, so whichever
     * model the user picked applies here too.
     */
    function aiDecode(recipeKey, text, opts) {
        opts = opts || {};
        if (!global.AIProvider) {
            return Promise.reject(new Error('AI provider unavailable.'));
        }
        var model = opts.model || global.localStorage.getItem('chain-decode-model') ||
            global.localStorage.getItem('translate-model') || 'google/gemma-3-27b-it';
        return global.AIProvider.chatCompletion([
            {
                role: 'system',
                content: 'You are a decoding engine for layered text transformations. ' +
                    'You output only the recovered plaintext.'
            },
            { role: 'user', content: buildDecodePrompt(recipeKey, text) }
        ], {
            model: model,
            temperature: 0,
            maxTokens: 4096
        }).then(function(data) {
            var out = data && data.choices && data.choices[0] && data.choices[0].message;
            return ((out && out.content) || '').trim();
        });
    }

    /** Run a chain definition without saving it — powers the builder preview. */
    function previewNodes(nodes, text) {
        return runChainNodes(nodes, text);
    }

    /** Per-node output, so the builder can show the text after each step. */
    function previewSteps(nodes, text) {
        var acc = text;
        return (nodes || []).map(function(node) {
            var t = lookupTransform(node.transform);
            var before = acc;
            var error = '';
            if (!t) {
                error = 'missing transform';
            } else {
                try {
                    acc = t.func(acc, node.options || {});
                } catch (e) {
                    error = e.message || 'failed';
                }
            }
            return {
                transform: node.transform,
                name: t ? t.name : node.transform,
                before: before,
                after: acc,
                error: error
            };
        });
    }

    global.TransformChains = {
        CATEGORY: CATEGORY,
        CHAIN_PREFIX: CHAIN_PREFIX,
        CYCLE_PREFIX: CYCLE_PREFIX,
        loadChains: loadChains,
        loadRecipes: loadRecipes,
        loadCycles: loadCycles,
        saveChain: saveChain,
        saveRecipe: saveRecipe,
        deleteChain: deleteChain,
        saveCycle: saveCycle,
        deleteCycle: deleteCycle,
        getLastMutationError: getLastMutationError,
        syncTransforms: syncTransforms,
        chainIsReversible: chainIsReversible,
        cycleRoundTripsCleanly: cycleRoundTripsCleanly,
        describeChain: describeChain,
        describeRecipe: describeRecipe,
        buildDecodePrompt: buildDecodePrompt,
        aiDecode: aiDecode,
        previewNodes: previewNodes,
        previewSteps: previewSteps,
        smartWordSplit: smartWordSplit,
        runChainNodes: runChainNodes,
        runStagedRecipeSync: runStagedRecipeSync,
        runStagedRecipeAsync: runStagedRecipeAsync,
        reverseChainNodes: reverseChainNodes,
        runCycle: runCycle,
        resolveCycleChains: resolveCycleChains,
        genId: genId
    };
})(typeof window !== 'undefined' ? window : this);
