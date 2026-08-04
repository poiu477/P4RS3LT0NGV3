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

    // ---- storage ----------------------------------------------------------

    function readList(key) {
        try {
            var raw = global.localStorage.getItem(key);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
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

    function loadChains() { return readList(CHAIN_STORAGE_KEY); }
    function loadCycles() { return readList(CYCLE_STORAGE_KEY); }

    // ---- node execution ---------------------------------------------------

    function lookupTransform(key) {
        return (global.transforms && global.transforms[key]) || null;
    }

    /** A node is runnable only if its transform is still registered. */
    function nodeIsValid(node) {
        return !!(node && node.transform && lookupTransform(node.transform));
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
        var nodes = (chain && chain.nodes) || [];
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
                    ? reverseChainNodes(chain.nodes, seg.text)
                    : runChainNodes(chain.nodes, seg.text);
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

    function describeChain(chain) {
        var names = (chain.nodes || []).map(function(n) {
            var t = lookupTransform(n.transform);
            return t ? t.name : n.transform;
        });
        return names.join(' → ') || 'empty chain';
    }

    function registerChain(chain) {
        var reversible = chainIsReversible(chain);
        global.transforms[CHAIN_PREFIX + chain.id] = {
            name: chain.name,
            category: CATEGORY,
            description: 'Chain: ' + describeChain(chain),
            priority: 0, // never auto-guessed by the decoder; user picks it explicitly
            canDecode: reversible,
            isChain: true,
            chainId: chain.id,
            func: function(text) { return runChainNodes(chain.nodes, text); },
            preview: function(text) { return runChainNodes(chain.nodes, text); },
            reverse: reversible
                ? function(text) { return reverseChainNodes(chain.nodes, text); }
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

    function saveChain(chain) {
        var list = loadChains();
        var now = Date.now();
        if (chain.id) {
            var found = false;
            list = list.map(function(c) {
                if (c.id !== chain.id) return c;
                found = true;
                return Object.assign({}, c, chain, { updatedAt: now });
            });
            if (!found) list.push(Object.assign({}, chain, { createdAt: now, updatedAt: now }));
        } else {
            chain = Object.assign({}, chain, { id: genId(), createdAt: now, updatedAt: now });
            list.push(chain);
        }
        writeList(CHAIN_STORAGE_KEY, list);
        syncTransforms();
        return chain.id;
    }

    function deleteChain(id) {
        writeList(CHAIN_STORAGE_KEY, loadChains().filter(function(c) { return c.id !== id; }));
        // Drop the dangling reference from any cycle that used it.
        writeList(CYCLE_STORAGE_KEY, loadCycles().map(function(cy) {
            return Object.assign({}, cy, {
                chainIds: (cy.chainIds || []).filter(function(cid) { return cid !== id; })
            });
        }));
        syncTransforms();
    }

    function saveCycle(cycle) {
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
        writeList(CYCLE_STORAGE_KEY, list);
        syncTransforms();
        return cycle.id;
    }

    function deleteCycle(id) {
        writeList(CYCLE_STORAGE_KEY, loadCycles().filter(function(c) { return c.id !== id; }));
        syncTransforms();
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
        loadCycles: loadCycles,
        saveChain: saveChain,
        deleteChain: deleteChain,
        saveCycle: saveCycle,
        deleteCycle: deleteCycle,
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
        reverseChainNodes: reverseChainNodes,
        runCycle: runCycle,
        resolveCycleChains: resolveCycleChains,
        genId: genId
    };
})(typeof window !== 'undefined' ? window : this);
