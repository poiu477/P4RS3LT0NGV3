# Review package: caee482b0919e0e9579b8e65fc5f72e7e6e35c9b..HEAD

## Commits
374e017 feat: apply transforms in Encode/Decode mode with shared output path

## Files changed
 css/style.css             |   8 ++++
 js/tools/TransformTool.js | 103 +++++++++++++++++++++++++---------------------
 templates/transforms.html |  14 +++----
 3 files changed, 71 insertions(+), 54 deletions(-)

## Diff
diff --git a/css/style.css b/css/style.css
index 7bbca56..3078150 100644
--- a/css/style.css
+++ b/css/style.css
@@ -5111,20 +5111,28 @@ body.transform-options-modal-open {
     position: relative;
 }
 
 .transform-image-output {
     display: block;
     max-width: 100%;
     height: auto;
     margin: 0 auto;
 }
 
+.transform-image-output-text {
+    font-family: 'Fira Code', 'Courier New', monospace;
+    font-size: 0.85rem;
+    word-break: break-all;
+    margin: 10px 40px 0 0;
+    opacity: 0.85;
+}
+
 .copy-button {
     position: absolute;
     top: 8px;
     right: 8px;
     padding: 6px;
     background: var(--button-bg);
     border: 1px solid var(--input-border);
     border-radius: 4px;
     color: var(--text-color);
     opacity: 0.8;
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index d2e4174..e361a1f 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -36,20 +36,21 @@ class TransformTool extends Tool {
         // Load last used transforms
         const lastUsed = this.loadLastUsed();
         
         // Load favorites
         const favorites = this.loadFavorites();
         
         return {
             transformInput: 'Hello World',
             transformLexemeAnalysis: { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' },
             transformOutput: '',
+            transformOutputImage: '',
             transformOutputKind: 'text',
             transformIoMode: (window.TransformApplyMode
                 ? window.TransformApplyMode.loadMode(localStorage)
                 : 'encode'),
             transformApplyGeneration: 0,
             activeTransform: null,
             transforms: transforms,
             legendCategories: legendCategories, // Always alphabetical for legend
             categories: sectionCategories, // Custom order for sections
             lastUsedTransforms: lastUsed,
@@ -551,35 +552,21 @@ class TransformTool extends Tool {
                     stages: this.stagedDraft.stages
                 };
                 const id = window.TransformChains.saveRecipe(draft);
                 if (!id) {
                     this.chainBuilderError = window.TransformChains.getLastMutationError() ||
                         'Could not save recipe.';
                     return;
                 }
                 this.chainBuilderOpen = false;
                 this.refreshChainsTransforms();
-                this.showNotification('Recipe saved — use Apply on the list (with text in the input)', 'success', 'fas fa-link');
-            },
-
-            applySavedChain: function(chain) {
-                const entry = this.chainRegisteredEntry(chain);
-                if (!entry) {
-                    this.refreshChainsTransforms();
-                    const again = this.chainRegisteredEntry(chain);
-                    if (!again) {
-                        this.showNotification('Recipe is not available yet. Try refreshing the page.', 'error', 'fas fa-link');
-                        return;
-                    }
-                    return this.applyTransform(again);
-                }
-                return this.applyTransform(entry);
+                this.showNotification('Recipe saved — find it in the transform list and click it (with text in the input)', 'success', 'fas fa-link');
             },
 
             // -- LEGACY_FREEFORM_BUILDER: remove with free-form chain support --
 
             chainNodeCandidates: function() {
                 if (!window.transforms) return [];
                 const query = (this.chainNodePickerQuery || '').trim().toLowerCase();
                 return Object.keys(window.transforms)
                     .map(key => ({ key, t: window.transforms[key] }))
                     .filter(({ t }) => t && t.name && !t.isChain && !t.isCycle)
@@ -1126,124 +1113,147 @@ class TransformTool extends Tool {
             },
             stagedRecipeNeedsAsync: function(recipe) {
                 const stages = recipe && recipe.stages;
                 return !!(stages && (stages.translate || stages.carrier));
             },
             applyActiveTransformOutput: async function(options) {
                 const generation = ++this.transformApplyGeneration;
                 const transform = this.activeTransform;
                 const input = this.transformInput;
                 const preserveEmojis = !!(options && options.preserveEmojis);
+                const copyOnSuccess = !!(options && options.copyOnSuccess);
 
                 if (!transform || !input || this.activeTab !== 'transforms') {
                     this.transformOutputKind = 'text';
                     this.transformOutput = '';
+                    this.transformOutputImage = '';
                     return { applied: false };
                 }
 
                 const opts = this.getMergedOptionsForTransform(transform.name);
                 const stagedRecipe = this.stagedRecipeForTransform(transform);
+                const action = window.TransformApplyMode
+                    ? window.TransformApplyMode.resolveAction(transform, this.transformIoMode)
+                    : 'encode';
 
                 try {
-                    let result;
-                    if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
-                        result = await window.TransformChains.runStagedRecipeAsync(
-                            stagedRecipe,
-                            input,
-                            opts
-                        );
-                    } else {
-                        let value;
-                        if (preserveEmojis) {
-                            const segments = window.EmojiUtils.splitEmojis(input);
-                            value = window.EmojiUtils.joinEmojis(segments.map(segment => {
-                                if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
-                                    return segment;
-                                }
-                                return transform.func(segment, opts);
-                            }));
-                        } else {
-                            value = transform.func(input, opts);
+                    let result = { kind: 'text', value: '' };
+
+                    if (action === 'ai_decode') {
+                        if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
+                            || !window.AIProvider.getConfiguredProviders().length) {
+                            throw new Error('Configure an AI provider in Settings to decode this transform.');
+                        }
+                        const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
+                        const text = await window.TransformChains.aiDecode(recipe, input, {
+                            model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
+                        });
+                        result = { kind: 'text', value: text };
+                    } else if (action === 'reverse') {
+                        if (typeof transform.reverse !== 'function') {
+                            throw new Error('No reverse function available.');
                         }
+                        result = { kind: 'text', value: String(transform.reverse(input, opts) || '') };
+                    } else if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
+                        result = await window.TransformChains.runStagedRecipeAsync(stagedRecipe, input, opts);
+                    } else if (preserveEmojis) {
+                        const segments = window.EmojiUtils.splitEmojis(input);
+                        const value = window.EmojiUtils.joinEmojis(segments.map(segment => {
+                            if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
+                                return segment;
+                            }
+                            return transform.func(segment, opts);
+                        }));
                         result = { kind: 'text', value };
+                    } else {
+                        result = { kind: 'text', value: transform.func(input, opts) };
                     }
 
                     if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
                         return { applied: false, stale: true };
                     }
 
-                    this.transformOutputKind = result && result.kind === 'image' ? 'image' : 'text';
-                    this.transformOutput = result && result.value != null ? String(result.value) : '';
+                    if (result && result.kind === 'image') {
+                        this.transformOutputKind = 'image';
+                        this.transformOutputImage = result.value != null ? String(result.value) : '';
+                        this.transformOutput = result.text != null ? String(result.text) : '';
+                    } else {
+                        this.transformOutputKind = 'text';
+                        this.transformOutputImage = '';
+                        this.transformOutput = result && result.value != null ? String(result.value) : '';
+                    }
+
+                    if (copyOnSuccess && this.transformOutput) {
+                        this.isTransformCopy = true;
+                        this.forceCopyToClipboard(this.transformOutput);
+                    }
+
                     return { applied: true, kind: this.transformOutputKind };
                 } catch (e) {
                     if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
                         return { applied: false, stale: true };
                     }
                     this.transformOutputKind = 'text';
                     this.transformOutput = '';
+                    this.transformOutputImage = '';
                     this.showNotification(
-                        `${transform.name} failed: ${e.message || 'Could not apply recipe.'}`,
+                        (e && e.message) ? e.message : (transform.name + ' failed.'),
                         'error',
                         'fas fa-exclamation-triangle'
                     );
                     return { applied: false, error: e };
                 }
             },
             applyTransform: async function(transform, event) {
                 event && event.preventDefault();
                 event && event.stopPropagation();
                 
                 if (transform && transform.name === 'Random Mix') {
                     this.triggerRandomizerChaos();
                 }
 
                 if (!transform) return;
 
                 this.activeTransform = transform;
 
                 if (!this.transformInput) {
-                    this.showNotification('Enter text in the input box, then Apply the recipe again.', 'info', 'fas fa-keyboard');
+                    this.showNotification('Enter text in the input box, then click the transform again.', 'info', 'fas fa-keyboard');
                     document.querySelectorAll('.transform-button').forEach(button => {
                         button.classList.remove('active');
                     });
                     const inputBox = document.querySelector('#transform-input');
                     if (inputBox) {
                         this.focusWithoutScroll(inputBox);
                     }
                     return;
                 }
 
                 // Track last used
                 this.saveLastUsedTransform(transform.name);
                 
-                const outcome = await this.applyActiveTransformOutput();
+                const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
                 if (!outcome.applied) {
                     return;
                 }
 
                 if (transform.name === 'Random Mix') {
                     const transformInfo = window.transforms.randomizer.getLastTransformInfo();
                     if (transformInfo.length > 0) {
                         const transformsList = transformInfo.map(t => t.transformName).join(', ');
                         this.showNotification(`Mixed with: ${transformsList}`, 'success', 'fas fa-random');
                     }
                 }
                 
-                if (this.transformOutputKind === 'text') {
-                    this.isTransformCopy = true;
-                    this.forceCopyToClipboard(this.transformOutput);
-                }
-                
                 if (transform.name !== 'Random Mix') {
-                    const message = this.transformOutputKind === 'image'
+                    const message = this.transformOutputKind === 'image' && !this.transformOutput
                         ? `${transform.name} image preview ready!`
-                        : `${transform.name} applied and copied!`;
+                        : `${transform.name}${this.transformIoMode === 'decode' ? ' decoded and copied!' : ' applied and copied!'}`;
                     this.showNotification(message, 'success', 'fas fa-check');
                 }
                 
                 document.querySelectorAll('.transform-button').forEach(button => {
                     button.classList.remove('active');
                 });
                 
                 const inputBox = document.querySelector('#transform-input');
                 if (inputBox) {
                     this.focusWithoutScroll(inputBox);
@@ -1494,20 +1504,21 @@ class TransformTool extends Tool {
                     const match = this.transforms.find(function(t) {
                         return t.transformKey === previousKey;
                     });
                     this.activeTransform = match || null;
                     if (match && this.transformInput && this.activeTab === 'transforms') {
                         this.applyActiveTransformOutput();
                     } else if (!match) {
                         ++this.transformApplyGeneration;
                         this.transformOutputKind = 'text';
                         this.transformOutput = '';
+                        this.transformOutputImage = '';
                     }
                 }
                 this.pruneFavoritesForMissingTransforms();
             },
         };
     }
     
     getVueWatchers() {
         return {
             transformInput() {
diff --git a/templates/transforms.html b/templates/transforms.html
index 3349db0..76e44de 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -28,42 +28,43 @@
                             type="text"
                             v-model="transformInput"
                             :placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
                             @input="autoTransform"
                             autocomplete="off"
                             autocorrect="off"
                             spellcheck="false"
                         />
                     </div>
 
-                    <div class="output-section" v-if="transformOutput">
+                    <div class="output-section" v-if="transformOutput || transformOutputImage">
                         <div class="output-heading">
                             <h4>
                                 <i class="fas fa-check-circle"></i>
                                 {{ transformIoMode === 'decode' ? 'Decoded' : 'Transformed' }} Message
                                 <small v-if="activeTransform">({{ activeTransform.name }})</small>
                             </h4>
                         </div>
                         <div class="output-container" :class="{ 'signwriting-output': activeTransform && activeTransform.category === 'signwriting' }">
                             <img
                                 v-if="transformOutputKind === 'image'"
-                                :src="transformOutput"
+                                :src="transformOutputImage"
                                 :alt="activeTransform ? activeTransform.name + ' image output' : 'Transformed image output'"
                                 class="transform-image-output"
                             >
                             <textarea
-                                v-else
+                                v-if="transformOutputKind !== 'image'"
                                 readonly
                                 v-model="transformOutput"
                                 aria-label="Transform output text"
                             ></textarea>
-                            <button v-if="transformOutputKind !== 'image'" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
+                            <p v-else-if="transformOutput" class="transform-image-output-text">{{ transformOutput }}</p>
+                            <button v-if="transformOutput" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
                                 <i class="fas fa-copy"></i>
                             </button>
                         </div>
                         <div class="output-instructions">
                             <small v-if="transformOutputKind === 'image'"><i class="fas fa-info-circle"></i> Save or share this generated image.</small>
                             <small v-else><i class="fas fa-info-circle"></i> Copy this text and share it. Use Decode mode to reverse transformations.</small>
                         </div>
                     </div>
 
                     <div v-if="transformGetLexemeAnalysis().totalFindings" class="lexeme-analysis-card transform-lexeme-card">
@@ -184,35 +185,32 @@
                                         type="file"
                                         accept="application/json,.json"
                                         hidden
                                         @change="chainImportAll($event.target.files[0]); $event.target.value = ''"
                                     >
                                     <small v-if="!savedChains().length" class="chain-manager-hint">Create a recipe first — cycles rotate through saved recipes.</small>
                                 </div>
 
                                 <div v-if="savedChains().length" class="chain-list">
                                     <h5>Recipes &amp; free-form chains</h5>
-                                    <small class="chain-manager-hint">Enter text above, then hit Apply on a recipe to run it into the output.</small>
+                                    <small class="chain-manager-hint">Find a recipe in the transform list above and click it, just like any other method.</small>
                                     <div v-for="chain in savedChains()" :key="chain.id" class="chain-list-item">
                                         <div class="chain-list-item-main">
                                             <strong>{{ chain.name }}</strong>
                                             <span class="chain-badge" :class="chainIsReversibleNow(chain) ? 'chain-badge-reversible' : 'chain-badge-ai-only'">
                                                 {{ chainIsReversibleNow(chain) ? 'Reversible' : 'AI-decode only' }}
                                             </span>
                                             <span v-if="recipeHasCarrier(chain)" class="chain-badge chain-badge-carrier">Carrier</span>
                                             <span v-if="chain.kind !== 'staged'" class="chain-badge chain-badge-legacy">Legacy</span>
                                             <small>{{ chainRegisteredEntry(chain) ? chainRegisteredEntry(chain).description : '' }}</small>
                                         </div>
                                         <div class="chain-list-item-actions">
-                                            <button type="button" class="chain-action-btn chain-action-btn-primary" @click="applySavedChain(chain)" title="Apply recipe">
-                                                <i class="fas fa-play"></i> Apply
-                                            </button>
                                             <button type="button" class="chain-action-btn" @click="chainCopyRecipe(chain, 'chain')" title="Copy recipe">
                                                 <i class="fas fa-copy"></i>
                                             </button>
                                             <button type="button" class="chain-action-btn" @click="openChainBuilder(chain)" title="Edit">
                                                 <i class="fas fa-pen"></i>
                                             </button>
                                             <button
                                                 v-if="!chainIsReversibleNow(chain)"
                                                 type="button"
                                                 class="chain-action-btn"
