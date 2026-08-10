# Review Package Task 4
Base: a2879216d53c00aeea32be4b3b5f6a1dfdb1f236
Head: 8538f71

## Commits
8538f71 fix: drop orphan transform favorites after list refresh

## Stat
 js/tools/TransformTool.js | 19 +++++++++++++++++++
 1 file changed, 19 insertions(+)

## Diff
```diff
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 669e08f..50e8a9f 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -508,34 +508,36 @@ class TransformTool extends Tool {
                 const ok = window.TransformChains.deleteChain(chain.id);
                 if (!ok) {
                     this.showNotification(
                         window.TransformChains.getLastMutationError() || 'Could not delete chain.',
                         'error',
                         'fas fa-exclamation-triangle'
                     );
                     return;
                 }
                 this.refreshChainsTransforms();
+                this.pruneFavoritesForMissingTransforms();
                 this.showNotification('Chain deleted', 'success', 'fas fa-trash');
             },
             deleteSavedCycle: function(cycle) {
                 if (!window.confirm('Delete cycle "' + cycle.name + '"?')) return;
                 const ok = window.TransformChains.deleteCycle(cycle.id);
                 if (!ok) {
                     this.showNotification(
                         window.TransformChains.getLastMutationError() || 'Could not delete cycle.',
                         'error',
                         'fas fa-exclamation-triangle'
                     );
                     return;
                 }
                 this.refreshChainsTransforms();
+                this.pruneFavoritesForMissingTransforms();
                 this.showNotification('Cycle deleted', 'success', 'fas fa-trash');
             },
 
             // -- AI-assisted decode for chains/cycles that can't mechanically reverse --
 
             chainDecodeKey: function(kind, id) {
                 return kind + ':' + id;
             },
             chainToggleDecode: function(kind, id) {
                 const key = this.chainDecodeKey(kind, id);
@@ -962,20 +964,36 @@ class TransformTool extends Tool {
                     .map(transformName => this.transforms.find(t => t.name === transformName))
                     .filter(t => t !== undefined);
             },
             saveFavorites: function(favorites) {
                 try {
                     localStorage.setItem('transformFavorites', JSON.stringify(favorites));
                 } catch (e) {
                     console.warn('Failed to save favorites:', e);
                 }
             },
+            pruneFavoritesForMissingTransforms: function() {
+                if (!Array.isArray(this.favorites) || !this.favorites.length) return;
+                const names = {};
+                (this.transforms || []).forEach(function(t) {
+                    if (t && t.name) names[t.name] = true;
+                });
+                const next = this.favorites.filter(function(f) {
+                    if (typeof f === 'string') return !!names[f];
+                    return true; // keep translate favorites objects
+                });
+                if (next.length !== this.favorites.length) {
+                    this.favorites = next;
+                    this.showFavorites = next.length > 0;
+                    this.saveFavorites(next);
+                }
+            },
             moveCategoryUp: function(categoryIndex) {
                 if (categoryIndex <= 0) return;
                 
                 // Never allow moving randomizer itself
                 if (this.categories[categoryIndex] === 'randomizer') return;
                 
                 // Use Vue's array mutation methods for proper reactivity
                 const categoryToMove = this.categories[categoryIndex];
                 this.categories.splice(categoryIndex, 1);
                 this.categories.splice(categoryIndex - 1, 0, categoryToMove);
@@ -1054,20 +1072,21 @@ class TransformTool extends Tool {
                         return t.transformKey === previousKey;
                     });
                     this.activeTransform = match || null;
                     if (match && this.transformInput && this.activeTab === 'transforms') {
                         const opts = this.getMergedOptionsForTransform(match.name);
                         this.transformOutput = match.func(this.transformInput, opts);
                     } else if (!match) {
                         this.transformOutput = '';
                     }
                 }
+                this.pruneFavoritesForMissingTransforms();
             },
         };
     }
     
     getVueWatchers() {
         return {
             transformInput() {
                 if (typeof this.transformRefreshLexemeAnalysis === 'function') {
                     this.transformRefreshLexemeAnalysis();
                 }

```