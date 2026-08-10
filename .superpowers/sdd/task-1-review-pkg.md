# Review Package Task 1
Base: 6a047a675c4740aa38ba7e6942e17e817ddd5c14
Head: 862fdad

## Commits
862fdad fix: rematch activeTransform after transform list refresh


## Stat
 js/tools/TransformTool.js | 19 +++++++++++++++++++
 1 file changed, 19 insertions(+)


## Diff
```diff
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 4b9e6f6..3080a70 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -1006,31 +1006,50 @@ class TransformTool extends Tool {
             refreshCustomSpellingTransforms: function() {
                 const transformTool = window.toolRegistry && window.toolRegistry.get('transforms');
                 if (!transformTool || typeof transformTool.buildTransformsFromWindow !== 'function') {
                     return;
                 }
 
                 const previousCustomCount = (this.transforms || []).filter(function(t) {
                     return t.category === 'custom_spelling';
                 }).length;
 
+                const previousKey = this.activeTransform && this.activeTransform.transformKey
+                    ? this.activeTransform.transformKey
+                    : null;
+
                 this.transforms = transformTool.buildTransformsFromWindow();
                 const categories = transformTool.rebuildTransformCategories(this.transforms);
                 this.legendCategories = categories.legendCategories;
                 this.categories = categories.sectionCategories;
 
                 const nextCustomCount = this.transforms.filter(function(t) {
                     return t.category === 'custom_spelling';
                 }).length;
                 if (nextCustomCount !== previousCustomCount) {
                     this.saveCategoryOrder(this.categories);
                 }
+
+                if (!previousKey) {
+                    this.activeTransform = null;
+                } else {
+                    const match = this.transforms.find(function(t) {
+                        return t.transformKey === previousKey;
+                    });
+                    this.activeTransform = match || null;
+                    if (match && this.transformInput && this.activeTab === 'transforms') {
+                        const opts = this.getMergedOptionsForTransform(match.name);
+                        this.transformOutput = match.func(this.transformInput, opts);
+                    } else if (!match) {
+                        this.transformOutput = '';
+                    }
+                }
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