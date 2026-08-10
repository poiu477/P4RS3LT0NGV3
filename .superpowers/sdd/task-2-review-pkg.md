# Review Package Task 2
Base: 862fdadd823f47c7c7ea51749b9f53ec01bb5cb9
Head: a845920

## Commits
a845920 fix: surface chain/cycle storage and validation failures in UI


## Stat
 js/core/transformChains.js | 32 ++++++++++++++++++++++++++++----
 js/tools/TransformTool.js  | 26 ++++++++++++++++++++++----
 2 files changed, 50 insertions(+), 8 deletions(-)


## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index abb916d..8f41b7a 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -22,20 +22,21 @@
  * and a chain's output doesn't drift when global option prefs change.
  */
 (function(global) {
     'use strict';
 
     var CHAIN_STORAGE_KEY = 'transform-chains-v1';
     var CYCLE_STORAGE_KEY = 'transform-cycles-v1';
     var CHAIN_PREFIX = 'chain_';
     var CYCLE_PREFIX = 'cycle_';
     var CATEGORY = 'chains';
+    var lastMutationError = '';
 
     // ---- storage ----------------------------------------------------------
 
     function isRecord(value) {
         return !!value && typeof value === 'object' && !Array.isArray(value);
     }
 
     /** Structural check for a persisted node (transform key required). */
     function isValidPersistedNode(node) {
         return isRecord(node) && typeof node.transform === 'string' && node.transform.length > 0;
@@ -354,90 +355,112 @@
 
     function syncTransforms() {
         if (!global.transforms) global.transforms = {};
         unregisterAll();
         loadChains().forEach(registerChain);
         loadCycles().forEach(registerCycle);
     }
 
     // ---- CRUD -------------------------------------------------------------
 
+    function getLastMutationError() {
+        return lastMutationError || '';
+    }
+
     function saveChain(chain) {
         var rejection = validateChainForSave(chain);
         if (rejection) {
             console.warn('saveChain rejected:', rejection);
+            lastMutationError = rejection;
             return null;
         }
 
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
-        if (!writeList(CHAIN_STORAGE_KEY, list)) return null;
+        if (!writeList(CHAIN_STORAGE_KEY, list)) {
+            lastMutationError = 'Could not write chains to browser storage.';
+            return null;
+        }
         syncTransforms();
+        lastMutationError = '';
         return chain.id;
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
 
-        if (!writeList(CHAIN_STORAGE_KEY, nextChains)) return false;
+        if (!writeList(CHAIN_STORAGE_KEY, nextChains)) {
+            lastMutationError = 'Could not write chains to browser storage.';
+            return false;
+        }
         if (!writeList(CYCLE_STORAGE_KEY, nextCycles)) {
             // Keep chain + cycle lists consistent if the second write fails.
             writeList(CHAIN_STORAGE_KEY, prevChains);
+            lastMutationError = 'Could not write cycles to browser storage.';
             return false;
         }
         syncTransforms();
+        lastMutationError = '';
         return true;
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
-        if (!writeList(CYCLE_STORAGE_KEY, list)) return null;
+        if (!writeList(CYCLE_STORAGE_KEY, list)) {
+            lastMutationError = 'Could not write cycles to browser storage.';
+            return null;
+        }
         syncTransforms();
+        lastMutationError = '';
         return cycle.id;
     }
 
     function deleteCycle(id) {
         var next = loadCycles().filter(function(c) { return c.id !== id; });
-        if (!writeList(CYCLE_STORAGE_KEY, next)) return false;
+        if (!writeList(CYCLE_STORAGE_KEY, next)) {
+            lastMutationError = 'Could not write cycles to browser storage.';
+            return false;
+        }
         syncTransforms();
+        lastMutationError = '';
         return true;
     }
 
     // ---- recipe keys & AI-assisted decode ----------------------------------
 
     /**
      * A human- and model-readable description of exactly what was applied.
      *
      * Mechanical reverse only works when every node is individually
      * reversible, and per-word cycles often can't round-trip at all: a
@@ -531,20 +554,21 @@
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
+        getLastMutationError: getLastMutationError,
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
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 3080a70..669e08f 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -419,21 +419,22 @@ class TransformTool extends Tool {
                 if (!this.chainDraftNodes.length) {
                     this.chainBuilderError = 'Add at least one transform to the chain.';
                     return;
                 }
                 const id = window.TransformChains.saveChain({
                     id: this.chainBuilderEditId,
                     name,
                     nodes: this.chainDraftNodes
                 });
                 if (!id) {
-                    this.chainBuilderError = 'Could not save ΓÇö a chain cannot reference itself or another saved chain/cycle.';
+                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
+                        'Could not save chain.';
                     return;
                 }
                 this.chainBuilderOpen = false;
                 this.refreshChainsTransforms();
                 this.showNotification('Chain saved ΓÇö find it on the Transforms page under chains', 'success', 'fas fa-link');
             },
 
             // -- cycle (per-word rotation) builder --
 
             openCycleBuilder: function(existing) {
@@ -482,41 +483,58 @@ class TransformTool extends Tool {
                 if (!this.cycleDraftChainIds.length) {
                     this.chainBuilderError = 'Add at least one chain to rotate through.';
                     return;
                 }
                 const id = window.TransformChains.saveCycle({
                     id: this.chainBuilderEditId,
                     name,
                     chainIds: this.cycleDraftChainIds
                 });
                 if (!id) {
-                    this.chainBuilderError = 'Could not save cycle.';
+                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
+                        'Could not save cycle.';
                     return;
                 }
                 this.chainBuilderOpen = false;
                 this.refreshChainsTransforms();
                 this.showNotification('Cycle saved ΓÇö find it on the Transforms page under chains', 'success', 'fas fa-repeat');
             },
 
             closeChainBuilder: function() {
                 this.chainBuilderOpen = false;
                 this.chainBuilderError = '';
             },
             deleteSavedChain: function(chain) {
                 if (!window.confirm('Delete chain "' + chain.name + '"? Any cycle using it will drop the reference.')) return;
-                window.TransformChains.deleteChain(chain.id);
+                const ok = window.TransformChains.deleteChain(chain.id);
+                if (!ok) {
+                    this.showNotification(
+                        window.TransformChains.getLastMutationError() || 'Could not delete chain.',
+                        'error',
+                        'fas fa-exclamation-triangle'
+                    );
+                    return;
+                }
                 this.refreshChainsTransforms();
                 this.showNotification('Chain deleted', 'success', 'fas fa-trash');
             },
             deleteSavedCycle: function(cycle) {
                 if (!window.confirm('Delete cycle "' + cycle.name + '"?')) return;
-                window.TransformChains.deleteCycle(cycle.id);
+                const ok = window.TransformChains.deleteCycle(cycle.id);
+                if (!ok) {
+                    this.showNotification(
+                        window.TransformChains.getLastMutationError() || 'Could not delete cycle.',
+                        'error',
+                        'fas fa-exclamation-triangle'
+                    );
+                    return;
+                }
                 this.refreshChainsTransforms();
                 this.showNotification('Cycle deleted', 'success', 'fas fa-trash');
             },
 
             // -- AI-assisted decode for chains/cycles that can't mechanically reverse --
 
             chainDecodeKey: function(kind, id) {
                 return kind + ':' + id;
             },
             chainToggleDecode: function(kind, id) {

```