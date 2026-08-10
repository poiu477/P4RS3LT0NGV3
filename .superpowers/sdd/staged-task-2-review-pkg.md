# Review Package Staged Task 2
Base: 401f755f2a22617b5624546a814891ffb02282a6
Head: a790621d033fc133974c2e556fa4259740a1444f

## Commits
a790621 feat: persist staged recipes alongside legacy free-form chains

## Stat
 js/core/transformChains.js      | 93 ++++++++++++++++++++++++++++++++++++-----
 tests/test_transform_recipes.js | 46 ++++++++++++++++++++
 2 files changed, 129 insertions(+), 10 deletions(-)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index cb4cd22..5754acf 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -41,18 +41,27 @@
     function isValidPersistedNode(node) {
         return isRecord(node) && typeof node.transform === 'string' && node.transform.length > 0;
     }
 
     function sanitizeChainRecord(chain) {
         if (!isRecord(chain)) return null;
         if (typeof chain.id !== 'string' || !chain.id) return null;
         if (typeof chain.name !== 'string') return null;
+        if (chain.kind === 'staged') {
+            if (!isRecord(chain.stages)) return null;
+            return Object.assign({}, chain, {
+                kind: 'staged',
+                stages: chain.stages
+            });
+        }
+        // @legacy free-form chain
         if (!Array.isArray(chain.nodes)) return null;
         return Object.assign({}, chain, {
+            kind: chain.kind || 'freeform',
             nodes: chain.nodes.filter(isValidPersistedNode)
         });
     }
 
     function sanitizeCycleRecord(cycle) {
         if (!isRecord(cycle)) return null;
         if (typeof cycle.id !== 'string' || !cycle.id) return null;
         if (typeof cycle.name !== 'string') return null;
@@ -93,16 +102,20 @@
         }
         return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
     }
 
     function loadChains() {
         return readList(CHAIN_STORAGE_KEY).map(sanitizeChainRecord).filter(Boolean);
     }
 
+    function loadRecipes() {
+        return loadChains().filter(function(chain) { return chain.kind === 'staged'; });
+    }
+
     function loadCycles() {
         return readList(CYCLE_STORAGE_KEY).map(sanitizeCycleRecord).filter(Boolean);
     }
 
     // ---- node execution ---------------------------------------------------
 
     function lookupTransform(key) {
         return (global.transforms && global.transforms[key]) || null;
@@ -203,32 +216,44 @@
                 return applyNode(node, acc);
             } catch (e) {
                 console.warn('Chain node "' + node.transform + '" failed:', e);
                 return acc;
             }
         }, text);
     }
 
+    /**
+     * Staged execution gets a dedicated runner in Task 3. Until then, expose
+     * transform-backed stages through the existing synchronous chain runner.
+     */
+    function getRunnableChainNodes(chain) {
+        if (!chain) return [];
+        if (chain.kind !== 'staged') return chain.nodes || [];
+        var stagesApi = global.TransformRecipeStages;
+        if (!stagesApi || typeof stagesApi.flattenStagedToNodes !== 'function') return [];
+        return stagesApi.flattenStagedToNodes(chain).filter(isValidPersistedNode);
+    }
+
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
-        var nodes = (chain && chain.nodes) || [];
+        var nodes = getRunnableChainNodes(chain);
         if (!nodes.length) return false;
         return nodes.every(function(node) {
             return nodeIsValid(node) && nodeCanReverse(node);
         });
     }
 
     // ---- word splitting ---------------------------------------------------
 
@@ -261,18 +286,18 @@
         if (!chains.length) return text;
         var wordIndex = 0;
         return smartWordSplit(text).map(function(seg) {
             if (!seg.isWord) return seg.text;
             var chain = chains[wordIndex % chains.length];
             wordIndex++;
             try {
                 return reverseMode
-                    ? reverseChainNodes(chain.nodes, seg.text)
-                    : runChainNodes(chain.nodes, seg.text);
+                    ? reverseChainNodes(getRunnableChainNodes(chain), seg.text)
+                    : runChainNodes(getRunnableChainNodes(chain), seg.text);
             } catch (e) {
                 console.warn('Cycle chain "' + chain.name + '" failed:', e);
                 return seg.text;
             }
         }).join('');
     }
 
     function resolveCycleChains(cycle) {
@@ -307,34 +332,35 @@
     function describeNode(node) {
         var key = (node && typeof node.transform === 'string' && node.transform) || '?';
         var t = lookupTransform(key);
         var label = t ? (t.name + ' [' + key + ']') : key;
         return label + ' ' + serializeNodeOptions(node && node.options);
     }
 
     function describeChain(chain) {
-        var names = (chain.nodes || []).map(describeNode);
+        var names = getRunnableChainNodes(chain).map(describeNode);
         return names.join(' ΓåÆ ') || 'empty chain';
     }
 
     function registerChain(chain) {
+        var nodes = getRunnableChainNodes(chain);
         var reversible = chainIsReversible(chain);
         global.transforms[CHAIN_PREFIX + chain.id] = {
             name: chain.name,
             category: CATEGORY,
             description: 'Chain: ' + describeChain(chain),
             priority: 0, // excluded from blind auto-guess; still reversible when selected
             canDecode: reversible,
             isChain: true,
             chainId: chain.id,
-            func: function(text) { return runChainNodes(chain.nodes, text); },
-            preview: function(text) { return runChainNodes(chain.nodes, text); },
+            func: function(text) { return runChainNodes(nodes, text); },
+            preview: function(text) { return runChainNodes(nodes, text); },
             reverse: reversible
-                ? function(text) { return reverseChainNodes(chain.nodes, text); }
+                ? function(text) { return reverseChainNodes(nodes, text); }
                 : null
         };
     }
 
     /**
      * Whether a cycle actually round-trips, decided by experiment rather than
      * assumption.
      *
@@ -386,46 +412,91 @@
 
     // ---- CRUD -------------------------------------------------------------
 
     function getLastMutationError() {
         return lastMutationError || '';
     }
 
     function saveChain(chain) {
+        // @legacy free-form persistence path
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
-                return Object.assign({}, c, chain, { updatedAt: now });
+                return Object.assign({}, c, chain, { kind: 'freeform', updatedAt: now });
             });
-            if (!found) list.push(Object.assign({}, chain, { createdAt: now, updatedAt: now }));
+            if (!found) list.push(Object.assign({}, chain, {
+                kind: 'freeform',
+                createdAt: now,
+                updatedAt: now
+            }));
         } else {
-            chain = Object.assign({}, chain, { id: genId(), createdAt: now, updatedAt: now });
+            chain = Object.assign({}, chain, {
+                id: genId(),
+                kind: 'freeform',
+                createdAt: now,
+                updatedAt: now
+            });
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
 
+    function saveRecipe(input) {
+        lastMutationError = '';
+        var stagesApi = global.TransformRecipeStages;
+        if (!stagesApi) {
+            lastMutationError = 'Staged recipes unavailable.';
+            return null;
+        }
+        var rejection = stagesApi.validateStagedRecipe(input, global.transforms || {});
+        if (rejection) {
+            lastMutationError = rejection;
+            return null;
+        }
+
+        var list = loadChains();
+        var id = (input && input.id) || genId();
+        var now = Date.now();
+        var record = {
+            id: id,
+            name: String(input.name).trim(),
+            kind: 'staged',
+            stages: input.stages,
+            createdAt: (input && input.createdAt) || now,
+            updatedAt: now
+        };
+        var idx = list.findIndex(function(chain) { return chain.id === id; });
+        if (idx >= 0) list[idx] = Object.assign({}, list[idx], record);
+        else list.push(record);
+        if (!writeList(CHAIN_STORAGE_KEY, list)) {
+            lastMutationError = 'Could not write chains to browser storage.';
+            return null;
+        }
+        syncTransforms();
+        return id;
+    }
+
     function deleteChain(id) {
         var prevChains = loadChains();
         var prevCycles = loadCycles();
         var nextChains = prevChains.filter(function(c) { return c.id !== id; });
         var nextCycles = prevCycles.map(function(cy) {
             return Object.assign({}, cy, {
                 chainIds: (cy.chainIds || []).filter(function(cid) { return cid !== id; })
             });
@@ -582,18 +653,20 @@
         });
     }
 
     global.TransformChains = {
         CATEGORY: CATEGORY,
         CHAIN_PREFIX: CHAIN_PREFIX,
         CYCLE_PREFIX: CYCLE_PREFIX,
         loadChains: loadChains,
+        loadRecipes: loadRecipes,
         loadCycles: loadCycles,
         saveChain: saveChain,
+        saveRecipe: saveRecipe,
         deleteChain: deleteChain,
         saveCycle: saveCycle,
         deleteCycle: deleteCycle,
         getLastMutationError: getLastMutationError,
         syncTransforms: syncTransforms,
         chainIsReversible: chainIsReversible,
         cycleRoundTripsCleanly: cycleRoundTripsCleanly,
         describeChain: describeChain,
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index a8f2f6d..fc50a90 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -76,9 +76,55 @@ const flat = S.flattenStagedToNodes({
         present: null, normalize: null, conceal: null,
         carrier: { type: 'emoji_stego', options: { carrier: '≡ƒÿÇ' } }
     }
 });
 assert.strictEqual(flat[0].type, 'translate');
 assert.strictEqual(flat[1].transform, 'caesar');
 assert.strictEqual(flat[flat.length - 1].type, 'emoji_stego');
 
+load(ctx, 'js/core/transformChains.js');
+const TC = ctx.TransformChains;
+
+const rid = TC.saveRecipe({
+    name: 'Staged Demo',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: null,
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: [{ transform: 'theban', options: {} }],
+        conceal: null,
+        carrier: null
+    }
+});
+assert.ok(rid);
+const loaded = TC.loadChains().filter(c => c.id === rid)[0];
+assert.strictEqual(loaded.kind, 'staged');
+assert.strictEqual(loaded.stages.obfuscate[0].transform, 'caesar');
+
+const persisted = JSON.parse(ctx.localStorage._store['transform-chains-v1']);
+persisted.push({
+    id: 'legacy-demo',
+    name: 'Legacy Demo',
+    nodes: [{ transform: 'base64', options: {} }]
+});
+ctx.localStorage.setItem('transform-chains-v1', JSON.stringify(persisted));
+const legacy = TC.loadChains().filter(c => c.id === 'legacy-demo')[0];
+assert.strictEqual(legacy.kind, 'freeform');
+assert.deepStrictEqual(Array.from(TC.loadRecipes(), c => c.id), [rid]);
+assert.ok(ctx.transforms[`chain_${rid}`], 'staged recipe registered as a transform');
+assert.match(ctx.transforms[`chain_${rid}`].description, /Caesar \[caesar\].*Theban \[theban\]/);
+
+assert.strictEqual(TC.saveRecipe({
+    name: 'Bad',
+    kind: 'staged',
+    stages: {
+        obfuscate: [{ transform: 'theban', options: {} }],
+        present: null,
+        translate: null,
+        normalize: null,
+        conceal: null,
+        carrier: null
+    }
+}), null);
+
 console.log('test_transform_recipes: OK');

```