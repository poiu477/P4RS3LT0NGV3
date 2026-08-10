# Review Package Staged Task 3
Base: a790621d033fc133974c2e556fa4259740a1444f
Head: 1e8bd9615170f8084a3dbc71084397ae647d603f

## Commits
1e8bd96 feat: run sync stages for staged recipes

## Stat
 js/core/transformChains.js      | 26 +++++++++++++++++++++-----
 tests/test_transform_recipes.js | 31 +++++++++++++++++++++++++++++++
 2 files changed, 52 insertions(+), 5 deletions(-)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 5754acf..99c689c 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -220,22 +220,32 @@
             }
         }, text);
     }
 
     /**
      * Staged execution gets a dedicated runner in Task 3. Until then, expose
      * transform-backed stages through the existing synchronous chain runner.
      */
+    function getStagedTransformNodes(recipe) {
+        var stagesApi = global.TransformRecipeStages;
+        if (!stagesApi || typeof stagesApi.flattenStagedToNodes !== 'function') return [];
+        return stagesApi.flattenStagedToNodes(recipe).filter(function(n) {
+            return n && typeof n.transform === 'string';
+        });
+    }
+
+    function runStagedRecipeSync(recipe, text) {
+        return runChainNodes(getStagedTransformNodes(recipe), text);
+    }
+
     function getRunnableChainNodes(chain) {
         if (!chain) return [];
         if (chain.kind !== 'staged') return chain.nodes || [];
-        var stagesApi = global.TransformRecipeStages;
-        if (!stagesApi || typeof stagesApi.flattenStagedToNodes !== 'function') return [];
-        return stagesApi.flattenStagedToNodes(chain).filter(isValidPersistedNode);
+        return getStagedTransformNodes(chain);
     }
 
     /** Undo a chain: same nodes, back-to-front, each reversed. */
     function reverseChainNodes(nodes, text) {
         var list = (nodes || []).filter(nodeIsValid).slice().reverse();
         return list.reduce(function(acc, node) {
             try {
                 return reverseNode(node, acc);
@@ -339,26 +349,31 @@
     function describeChain(chain) {
         var names = getRunnableChainNodes(chain).map(describeNode);
         return names.join(' ΓåÆ ') || 'empty chain';
     }
 
     function registerChain(chain) {
         var nodes = getRunnableChainNodes(chain);
         var reversible = chainIsReversible(chain);
+        var isStaged = chain.kind === 'staged';
         global.transforms[CHAIN_PREFIX + chain.id] = {
             name: chain.name,
             category: CATEGORY,
             description: 'Chain: ' + describeChain(chain),
             priority: 0, // excluded from blind auto-guess; still reversible when selected
             canDecode: reversible,
             isChain: true,
             chainId: chain.id,
-            func: function(text) { return runChainNodes(nodes, text); },
-            preview: function(text) { return runChainNodes(nodes, text); },
+            func: function(text) {
+                return isStaged ? runStagedRecipeSync(chain, text) : runChainNodes(nodes, text);
+            },
+            preview: function(text) {
+                return isStaged ? runStagedRecipeSync(chain, text) : runChainNodes(nodes, text);
+            },
             reverse: reversible
                 ? function(text) { return reverseChainNodes(nodes, text); }
                 : null
         };
     }
 
     /**
      * Whether a cycle actually round-trips, decided by experiment rather than
@@ -672,14 +687,15 @@
         describeChain: describeChain,
         describeRecipe: describeRecipe,
         buildDecodePrompt: buildDecodePrompt,
         aiDecode: aiDecode,
         previewNodes: previewNodes,
         previewSteps: previewSteps,
         smartWordSplit: smartWordSplit,
         runChainNodes: runChainNodes,
+        runStagedRecipeSync: runStagedRecipeSync,
         reverseChainNodes: reverseChainNodes,
         runCycle: runCycle,
         resolveCycleChains: resolveCycleChains,
         genId: genId
     };
 })(typeof window !== 'undefined' ? window : this);
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index fc50a90..96ff43f 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -122,9 +122,40 @@ assert.strictEqual(TC.saveRecipe({
         present: null,
         translate: null,
         normalize: null,
         conceal: null,
         carrier: null
     }
 }), null);
 
+ctx.transforms.caesar.func = (t, o) => {
+    const shift = (o && o.shift) || 3;
+    return t.replace(/[a-zA-Z]/g, (ch) => {
+        const base = ch <= 'Z' ? 65 : 97;
+        return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
+    });
+};
+ctx.transforms.base64.func = (t) => Buffer.from(t, 'utf8').toString('base64');
+
+const syncId = TC.saveRecipe({
+    name: 'Caesar Base64',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: null,
+        obfuscate: [
+            { transform: 'caesar', options: { shift: 3 } },
+            { transform: 'base64', options: {} }
+        ],
+        present: null,
+        conceal: null,
+        carrier: null
+    }
+});
+const syncRecipe = TC.loadChains().filter(c => c.id === syncId)[0];
+const syncInput = 'Hello';
+const caesarOut = ctx.transforms.caesar.func(syncInput, { shift: 3 });
+const syncExpected = ctx.transforms.base64.func(caesarOut);
+assert.strictEqual(TC.runStagedRecipeSync(syncRecipe, syncInput), syncExpected);
+assert.strictEqual(ctx.transforms[`chain_${syncId}`].func(syncInput), syncExpected);
+
 console.log('test_transform_recipes: OK');

```