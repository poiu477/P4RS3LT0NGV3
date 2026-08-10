# Review Package Staged Task 8 re-review
Base: 4273f761b922a5aba9d5c4c8caf55a1a29cff04e
Head: f2741554be9de7d1c1f8238e91d73768e7a3ab46

## Commits
f274155 fix: route staged recipe recomputes through async-safe apply
b195190 feat: apply staged recipes with async translate and carrier preview

## Stat
 css/style.css             |   7 +++
 js/tools/TransformTool.js | 118 +++++++++++++++++++++++++++++++++++++---------
 templates/transforms.html |  12 ++++-
 3 files changed, 112 insertions(+), 25 deletions(-)

## Diff
```diff
diff --git a/css/style.css b/css/style.css
index ab4885e..d40f8eb 100644
--- a/css/style.css
+++ b/css/style.css
@@ -5058,10 +5058,17 @@ body.transform-options-modal-open {
 
 .output-container {
     position: relative;
 }
 
+.transform-image-output {
+    display: block;
+    max-width: 100%;
+    height: auto;
+    margin: 0 auto;
+}
+
 .copy-button {
     position: absolute;
     top: 8px;
     right: 8px;
     padding: 6px;
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 9e5f9b7..4936209 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -41,10 +41,12 @@ class TransformTool extends Tool {
         
         return {
             transformInput: 'Hello World',
             transformLexemeAnalysis: { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' },
             transformOutput: '',
+            transformOutputKind: 'text',
+            transformApplyGeneration: 0,
             activeTransform: null,
             transforms: transforms,
             legendCategories: legendCategories, // Always alphabetical for legend
             categories: sectionCategories, // Custom order for sections
             lastUsedTransforms: lastUsed,
@@ -120,10 +122,11 @@ class TransformTool extends Tool {
                 return true;
             })
             .map(([key, transform]) => ({
                 transformKey: key,
                 customSpellingId: transform.customSpellingId || null,
+                chainId: transform.chainId || null,
                 name: transform.name,
                 func: transform.func.bind(transform),
                 preview: transform.preview ? transform.preview.bind(transform) : function() { return '[preview]'; },
                 reverse: transform.reverse ? transform.reverse.bind(transform) : null,
                 category: transform.category || 'special',
@@ -967,12 +970,11 @@ class TransformTool extends Tool {
                     console.warn('Failed to save transform option prefs:', e);
                 }
                 this.showNotification('Options saved', 'success', 'fas fa-gear');
                 this.closeTransformOptions();
                 if (this.activeTransform && this.activeTransform.name === name && this.transformInput) {
-                    const opts = this.getMergedOptionsForTransform(name);
-                    this.transformOutput = this.activeTransform.func(this.transformInput, opts);
+                    this.applyActiveTransformOutput();
                 }
             },
             getTransformsByCategory: function(category) {
                 const list = this.transforms.filter(transform => transform.category === category);
                 if (!this.favorites || this.favorites.length === 0) return list;
@@ -1079,11 +1081,83 @@ class TransformTool extends Tool {
                 return !this.categories.some(category => this.categorySectionVisible(category));
             },
             isSpecialCategory: function(category) {
                 return category === 'randomizer';
             },
-            applyTransform: function(transform, event) {
+            stagedRecipeForTransform: function(transform) {
+                if (!transform || !transform.chainId || !window.TransformChains) {
+                    return null;
+                }
+                return window.TransformChains.loadRecipes().find(function(recipe) {
+                    return recipe.id === transform.chainId && recipe.kind === 'staged';
+                }) || null;
+            },
+            stagedRecipeNeedsAsync: function(recipe) {
+                const stages = recipe && recipe.stages;
+                return !!(stages && (stages.translate || stages.carrier));
+            },
+            applyActiveTransformOutput: async function(options) {
+                const generation = ++this.transformApplyGeneration;
+                const transform = this.activeTransform;
+                const input = this.transformInput;
+                const preserveEmojis = !!(options && options.preserveEmojis);
+
+                if (!transform || !input || this.activeTab !== 'transforms') {
+                    this.transformOutputKind = 'text';
+                    this.transformOutput = '';
+                    return { applied: false };
+                }
+
+                const opts = this.getMergedOptionsForTransform(transform.name);
+                const stagedRecipe = this.stagedRecipeForTransform(transform);
+
+                try {
+                    let result;
+                    if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
+                        result = await window.TransformChains.runStagedRecipeAsync(
+                            stagedRecipe,
+                            input,
+                            opts
+                        );
+                    } else {
+                        let value;
+                        if (preserveEmojis) {
+                            const segments = window.EmojiUtils.splitEmojis(input);
+                            value = window.EmojiUtils.joinEmojis(segments.map(segment => {
+                                if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
+                                    return segment;
+                                }
+                                return transform.func(segment, opts);
+                            }));
+                        } else {
+                            value = transform.func(input, opts);
+                        }
+                        result = { kind: 'text', value };
+                    }
+
+                    if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
+                        return { applied: false, stale: true };
+                    }
+
+                    this.transformOutputKind = result && result.kind === 'image' ? 'image' : 'text';
+                    this.transformOutput = result && result.value != null ? String(result.value) : '';
+                    return { applied: true, kind: this.transformOutputKind };
+                } catch (e) {
+                    if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
+                        return { applied: false, stale: true };
+                    }
+                    this.transformOutputKind = 'text';
+                    this.transformOutput = '';
+                    this.showNotification(
+                        `${transform.name} failed: ${e.message || 'Could not apply recipe.'}`,
+                        'error',
+                        'fas fa-exclamation-triangle'
+                    );
+                    return { applied: false, error: e };
+                }
+            },
+            applyTransform: async function(transform, event) {
                 event && event.preventDefault();
                 event && event.stopPropagation();
                 
                 if (transform && transform.name === 'Random Mix') {
                     this.triggerRandomizerChaos();
@@ -1093,27 +1167,33 @@ class TransformTool extends Tool {
                     this.activeTransform = transform;
                     
                     // Track last used
                     this.saveLastUsedTransform(transform.name);
                     
+                    const outcome = await this.applyActiveTransformOutput();
+                    if (!outcome.applied) {
+                        return;
+                    }
+
                     if (transform.name === 'Random Mix') {
-                        this.transformOutput = window.transforms.randomizer.func(this.transformInput);
                         const transformInfo = window.transforms.randomizer.getLastTransformInfo();
                         if (transformInfo.length > 0) {
                             const transformsList = transformInfo.map(t => t.transformName).join(', ');
                             this.showNotification(`Mixed with: ${transformsList}`, 'success', 'fas fa-random');
                         }
-                    } else {
-                        const opts = this.getMergedOptionsForTransform(transform.name);
-                        this.transformOutput = transform.func(this.transformInput, opts);
                     }
                     
-                    this.isTransformCopy = true;
-                    this.forceCopyToClipboard(this.transformOutput);
+                    if (this.transformOutputKind === 'text') {
+                        this.isTransformCopy = true;
+                        this.forceCopyToClipboard(this.transformOutput);
+                    }
                     
                     if (transform.name !== 'Random Mix') {
-                        this.showNotification(`${transform.name} applied and copied!`, 'success', 'fas fa-check');
+                        const message = this.transformOutputKind === 'image'
+                            ? `${transform.name} image preview ready!`
+                            : `${transform.name} applied and copied!`;
+                        this.showNotification(message, 'success', 'fas fa-check');
                     }
                     
                     document.querySelectorAll('.transform-button').forEach(button => {
                         button.classList.remove('active');
                     });
@@ -1332,19 +1412,11 @@ class TransformTool extends Tool {
                     console.warn('Failed to save category order:', e);
                 }
             },
             autoTransform: function() {
                 if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
-                    const opts = this.getMergedOptionsForTransform(this.activeTransform.name);
-                    const segments = window.EmojiUtils.splitEmojis(this.transformInput);
-                    const transformedSegments = segments.map(segment => {
-                        if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
-                            return segment;
-                        }
-                        return this.activeTransform.func(segment, opts);
-                    });
-                    this.transformOutput = window.EmojiUtils.joinEmojis(transformedSegments);
+                    this.applyActiveTransformOutput({ preserveEmojis: true });
                 }
             },
             refreshCustomSpellingTransforms: function() {
                 const transformTool = window.toolRegistry && window.toolRegistry.get('transforms');
                 if (!transformTool || typeof transformTool.buildTransformsFromWindow !== 'function') {
@@ -1377,13 +1449,14 @@ class TransformTool extends Tool {
                     const match = this.transforms.find(function(t) {
                         return t.transformKey === previousKey;
                     });
                     this.activeTransform = match || null;
                     if (match && this.transformInput && this.activeTab === 'transforms') {
-                        const opts = this.getMergedOptionsForTransform(match.name);
-                        this.transformOutput = match.func(this.transformInput, opts);
+                        this.applyActiveTransformOutput();
                     } else if (!match) {
+                        ++this.transformApplyGeneration;
+                        this.transformOutputKind = 'text';
                         this.transformOutput = '';
                     }
                 }
                 this.pruneFavoritesForMissingTransforms();
             },
@@ -1395,12 +1468,11 @@ class TransformTool extends Tool {
             transformInput() {
                 if (typeof this.transformRefreshLexemeAnalysis === 'function') {
                     this.transformRefreshLexemeAnalysis();
                 }
                 if (this.activeTransform && this.activeTab === 'transforms') {
-                    const opts = this.getMergedOptionsForTransform(this.activeTransform.name);
-                    this.transformOutput = this.activeTransform.func(this.transformInput, opts);
+                    this.applyActiveTransformOutput();
                 }
             },
             transformOptionsModalOpen(val) {
                 if (typeof document !== 'undefined') {
                     document.body.classList.toggle('transform-options-modal-open', !!val);
diff --git a/templates/transforms.html b/templates/transforms.html
index d94576d..784bd23 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -718,21 +718,29 @@
                                 Transformed Message
                                 <small v-if="activeTransform">({{ activeTransform.name }})</small>
                             </h4>
                         </div>
                         <div class="output-container" :class="{ 'signwriting-output': activeTransform && activeTransform.category === 'signwriting' }">
+                            <img
+                                v-if="transformOutputKind === 'image'"
+                                :src="transformOutput"
+                                :alt="activeTransform ? activeTransform.name + ' image output' : 'Transformed image output'"
+                                class="transform-image-output"
+                            >
                             <textarea 
+                                v-else
                                 readonly 
                                 v-model="transformOutput"
                                 aria-label="Transformed text output"
                             ></textarea>
-                            <button class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
+                            <button v-if="transformOutputKind !== 'image'" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
                                 <i class="fas fa-copy"></i>
                             </button>
                         </div>
                         <div class="output-instructions">
-                            <small><i class="fas fa-info-circle"></i> Copy this text and share it. Use the Decoder tab to reverse transformations.</small>
+                            <small v-if="transformOutputKind === 'image'"><i class="fas fa-info-circle"></i> Save or share this generated image.</small>
+                            <small v-else><i class="fas fa-info-circle"></i> Copy this text and share it. Use the Decoder tab to reverse transformations.</small>
                         </div>
                     </div>
                 </div>
 
                 <!-- Native <template> keeps children out of the layout until Vue runs (no modal flash on load). -->

```