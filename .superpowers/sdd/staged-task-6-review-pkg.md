# Review Package Staged Task 6
Base: 6395de876ed0b55861a120223b9f99a2e5d5a250
Head: 8b700fdb011da835189e077ec1368acb66e98e06

## Commits
8b700fd feat: cycle word_safe vs one_way modes

## Stat
 js/core/transformChains.js     | 39 +++++++++++++++++++++++++++++++++++++--
 tests/test_transform_chains.js | 22 ++++++++++++++++++++--
 2 files changed, 57 insertions(+), 4 deletions(-)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 312999a..13e1f76 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -25,16 +25,20 @@
     'use strict';
 
     var CHAIN_STORAGE_KEY = 'transform-chains-v1';
     var CYCLE_STORAGE_KEY = 'transform-cycles-v1';
     var CHAIN_PREFIX = 'chain_';
     var CYCLE_PREFIX = 'cycle_';
     var CATEGORY = 'chains';
     var lastMutationError = '';
+    var WORD_UNSAFE_KEYS = {
+        base64: true,
+        base64url: true
+    };
 
     // ---- storage ----------------------------------------------------------
 
     function isRecord(value) {
         return !!value && typeof value === 'object' && !Array.isArray(value);
     }
 
     /** Structural check for a persisted node (transform key required). */
@@ -62,16 +66,17 @@
     }
 
     function sanitizeCycleRecord(cycle) {
         if (!isRecord(cycle)) return null;
         if (typeof cycle.id !== 'string' || !cycle.id) return null;
         if (typeof cycle.name !== 'string') return null;
         if (!Array.isArray(cycle.chainIds)) return null;
         return Object.assign({}, cycle, {
+            mode: cycle.mode === 'one_way' ? 'one_way' : 'word_safe',
             chainIds: cycle.chainIds.filter(function(id) {
                 return typeof id === 'string' && id.length > 0;
             })
         });
     }
 
     function readList(key) {
         try {
@@ -172,26 +177,32 @@
             return 'Invalid cycle.';
         }
         if (typeof cycle.name !== 'string' || !cycle.name.trim()) {
             return 'Cycle name is required.';
         }
         if (!Array.isArray(cycle.chainIds) || !cycle.chainIds.length) {
             return 'Add at least one chain to the cycle.';
         }
+        if (cycle.mode != null && cycle.mode !== 'word_safe' && cycle.mode !== 'one_way') {
+            return 'Cycle mode must be "word_safe" or "one_way".';
+        }
         var known = Object.create(null);
-        loadChains().forEach(function(c) { known[c.id] = true; });
+        loadChains().forEach(function(c) { known[c.id] = c; });
         for (var i = 0; i < cycle.chainIds.length; i++) {
             var cid = cycle.chainIds[i];
             if (typeof cid !== 'string' || !cid) {
                 return 'Cycle contains an invalid chain reference.';
             }
             if (!known[cid]) {
                 return 'Cycle references a missing chain (' + cid + ').';
             }
+            if (cycle.mode !== 'one_way' && !recipeIsWordSafe(known[cid])) {
+                return 'Cycle recipe "' + known[cid].name + '" is not word-safe. Use one_way mode instead.';
+            }
         }
         return null;
     }
 
     function nodeCanReverse(node) {
         var t = lookupTransform(node && node.transform);
         return !!(t && typeof t.reverse === 'function' && t.canDecode !== false);
     }
@@ -490,19 +501,39 @@
         var probe = 'Hello World, Foo Bar! 42 baz';
         try {
             return runCycle(chains, runCycle(chains, probe, false), true) === probe;
         } catch (e) {
             return false;
         }
     }
 
+    /**
+     * Whether a chain or staged recipe can safely transform one word at a time
+     * without changing the cycle splitter's word boundaries.
+     */
+    function recipeIsWordSafe(chain) {
+        if (!chain) return false;
+        var nodes = chain.kind === 'staged' ? getStagedNodes(chain) : (chain.nodes || []);
+        for (var i = 0; i < nodes.length; i++) {
+            var node = nodes[i] || {};
+            if (WORD_UNSAFE_KEYS[node.transform]) return false;
+            if (node.type === 'translate' || node.type === 'qr' || node.type === 'emoji_stego') {
+                return false;
+            }
+        }
+        return cycleRoundTripsCleanly([chain]);
+    }
+
     function registerCycle(cycle) {
         var chains = resolveCycleChains(cycle);
-        var reversible = cycleRoundTripsCleanly(chains);
+        var mode = cycle.mode === 'one_way' ? 'one_way' : 'word_safe';
+        var reversible = mode === 'word_safe' &&
+            chains.every(recipeIsWordSafe) &&
+            cycleRoundTripsCleanly(chains);
         global.transforms[CYCLE_PREFIX + cycle.id] = {
             name: cycle.name,
             category: CATEGORY,
             description: 'Per-word cycle: ' + chains.map(function(c) { return c.name; }).join(' / '),
             priority: 0,
             canDecode: reversible,
             isCycle: true,
             cycleId: cycle.id,
@@ -631,16 +662,19 @@
     function saveCycle(cycle) {
         var rejection = validateCycleForSave(cycle);
         if (rejection) {
             console.warn('saveCycle rejected:', rejection);
             lastMutationError = rejection;
             return null;
         }
 
+        cycle = Object.assign({}, cycle, {
+            mode: cycle.mode === 'one_way' ? 'one_way' : 'word_safe'
+        });
         var list = loadCycles();
         var now = Date.now();
         if (cycle.id) {
             var found = false;
             list = list.map(function(c) {
                 if (c.id !== cycle.id) return c;
                 found = true;
                 return Object.assign({}, c, cycle, { updatedAt: now });
@@ -775,16 +809,17 @@
         saveRecipe: saveRecipe,
         deleteChain: deleteChain,
         saveCycle: saveCycle,
         deleteCycle: deleteCycle,
         getLastMutationError: getLastMutationError,
         syncTransforms: syncTransforms,
         chainIsReversible: chainIsReversible,
         cycleRoundTripsCleanly: cycleRoundTripsCleanly,
+        recipeIsWordSafe: recipeIsWordSafe,
         describeChain: describeChain,
         describeRecipe: describeRecipe,
         buildDecodePrompt: buildDecodePrompt,
         aiDecode: aiDecode,
         previewNodes: previewNodes,
         previewSteps: previewSteps,
         smartWordSplit: smartWordSplit,
         runChainNodes: runChainNodes,
diff --git a/tests/test_transform_chains.js b/tests/test_transform_chains.js
index 7b4f1c0..26938e3 100644
--- a/tests/test_transform_chains.js
+++ b/tests/test_transform_chains.js
@@ -93,23 +93,41 @@ assert.ok(recipe.indexOf('"shift":3') !== -1 || recipe.indexOf('"shift": 3') !==
 const beforeEmptyCycle = JSON.stringify(TC.loadCycles());
 const beforeEmptyCycleStorage = ctx.localStorage.getItem('transform-cycles-v1');
 assert.strictEqual(TC.saveCycle({ name: 'C', chainIds: [] }), null);
 assert.strictEqual(
     ctx.localStorage.getItem('transform-cycles-v1'),
     beforeEmptyCycleStorage
 );
 assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeEmptyCycle);
-const cyId = TC.saveCycle({ name: 'C', chainIds: [id] });
+assert.strictEqual(TC.recipeIsWordSafe(chains[0]), false);
+assert.strictEqual(TC.saveCycle({ name: 'Unsafe default', chainIds: [id] }), null);
+assert.match(TC.getLastMutationError(), /Demo/);
+
+const cyId = TC.saveCycle({ name: 'C', chainIds: [id], mode: 'one_way' });
 assert.ok(cyId);
-const cycles = TC.loadCycles();
+let cycles = TC.loadCycles();
 assert.strictEqual(cycles.length, 1);
 assert.strictEqual(cycles[0].id, cyId);
 assert.strictEqual(cycles[0].name, 'C');
+assert.strictEqual(cycles[0].mode, 'one_way');
 assert.deepStrictEqual(Array.from(cycles[0].chainIds), [id]);
+assert.strictEqual(ctx.transforms[`cycle_${cyId}`].canDecode, false);
+assert.strictEqual(ctx.transforms[`cycle_${cyId}`].reverse, null);
+
+const safeId = TC.saveChain({
+    name: 'Safe Caesar',
+    nodes: [{ transform: 'caesar', options: { shift: 3 } }]
+});
+const safeChain = TC.loadChains().find((chain) => chain.id === safeId);
+assert.strictEqual(TC.recipeIsWordSafe(safeChain), true);
+const safeCycleId = TC.saveCycle({ name: 'Safe default', chainIds: [safeId] });
+assert.ok(safeCycleId);
+cycles = TC.loadCycles();
+assert.strictEqual(cycles.find((cycle) => cycle.id === safeCycleId).mode, 'word_safe');
 
 // write failure rollback on deleteChain
 const beforeChains = JSON.stringify(TC.loadChains());
 const beforeCycles = JSON.stringify(TC.loadCycles());
 let calls = 0;
 let failureFired = false;
 const writeKeys = [];
 const realSet = ctx.localStorage.setItem.bind(ctx.localStorage);

```