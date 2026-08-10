# Review Package Task 3 (re-review)
Base: a845920e24f7e777b5fd0995346f2a0d3e7c7ef2
Head: a287921

## Commits
a287921 fix: use null-prototype map in validateCycleForSave
f28b6ec feat: validate cycles before save

## Stat
 js/core/transformChains.js | 31 +++++++++++++++++++++++++++++++
 1 file changed, 31 insertions(+)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 8f41b7a..3db1385 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -147,20 +147,44 @@
                 return 'Chains cannot nest other saved chains or cycles.';
             }
             var t = lookupTransform(node.transform);
             if (t && (t.isChain || t.isCycle)) {
                 return 'Chains cannot nest other saved chains or cycles.';
             }
         }
         return null;
     }
 
+    function validateCycleForSave(cycle) {
+        if (!cycle || typeof cycle !== 'object') {
+            return 'Invalid cycle.';
+        }
+        if (typeof cycle.name !== 'string' || !cycle.name.trim()) {
+            return 'Cycle name is required.';
+        }
+        if (!Array.isArray(cycle.chainIds) || !cycle.chainIds.length) {
+            return 'Add at least one chain to the cycle.';
+        }
+        var known = Object.create(null);
+        loadChains().forEach(function(c) { known[c.id] = true; });
+        for (var i = 0; i < cycle.chainIds.length; i++) {
+            var cid = cycle.chainIds[i];
+            if (typeof cid !== 'string' || !cid) {
+                return 'Cycle contains an invalid chain reference.';
+            }
+            if (!known[cid]) {
+                return 'Cycle references a missing chain (' + cid + ').';
+            }
+        }
+        return null;
+    }
+
     function nodeCanReverse(node) {
         var t = lookupTransform(node && node.transform);
         return !!(t && typeof t.reverse === 'function' && t.canDecode !== false);
     }
 
     function applyNode(node, text) {
         var t = lookupTransform(node.transform);
         if (!t) return text;
         return t.func(text, node.options || {});
     }
@@ -416,20 +440,27 @@
             writeList(CHAIN_STORAGE_KEY, prevChains);
             lastMutationError = 'Could not write cycles to browser storage.';
             return false;
         }
         syncTransforms();
         lastMutationError = '';
         return true;
     }
 
     function saveCycle(cycle) {
+        var rejection = validateCycleForSave(cycle);
+        if (rejection) {
+            console.warn('saveCycle rejected:', rejection);
+            lastMutationError = rejection;
+            return null;
+        }
+
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

```