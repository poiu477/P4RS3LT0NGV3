# Review package: 715fa06fbda14e3aa4463245ea79f5ddcb7d8d37..HEAD

## Commits
caee482 feat: add Encode/Decode switch and move output under input

## Files changed
 css/style.css             | 26 ++++++++++++++++
 js/tools/TransformTool.js | 13 ++++++++
 templates/transforms.html | 79 ++++++++++++++++++++++++++++-------------------
 3 files changed, 86 insertions(+), 32 deletions(-)

## Diff
diff --git a/css/style.css b/css/style.css
index ce33cc4..7bbca56 100644
--- a/css/style.css
+++ b/css/style.css
@@ -1848,20 +1848,46 @@ body.theme-light .mobile-tool-dropdown {
 /* Input and output sections */
 .input-section,
 .output-section,
 .decode-section {
     background: var(--main-bg-color);
     border-radius: 4px;
     padding: 16px;
     margin-bottom: 16px;
 }
 
+.transform-io-mode {
+    display: inline-flex;
+    margin-bottom: 0.5rem;
+    border: 1px solid var(--input-border);
+    border-radius: 8px;
+    overflow: hidden;
+}
+
+.transform-io-mode-btn {
+    border: 0;
+    background: transparent;
+    color: var(--text-color);
+    padding: 0.4rem 0.9rem;
+    cursor: pointer;
+}
+
+.transform-io-mode-btn.active {
+    background: rgba(52, 152, 219, 0.2);
+    color: #3498db;
+    font-weight: 600;
+}
+
+.transform-layout .input-section + .output-section {
+    margin-top: 0.75rem;
+}
+
 .input-container,
 .output-container {
     position: relative;
 }
 .fuzzer-list .fuzzer-case-row { position: relative; }
 .fuzzer-list .fuzzer-case-row .copy-button { position: static; }
 
 .section-header {
     margin-bottom: 15px;
 }
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index c4a7d9c..d2e4174 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -37,20 +37,23 @@ class TransformTool extends Tool {
         const lastUsed = this.loadLastUsed();
         
         // Load favorites
         const favorites = this.loadFavorites();
         
         return {
             transformInput: 'Hello World',
             transformLexemeAnalysis: { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' },
             transformOutput: '',
             transformOutputKind: 'text',
+            transformIoMode: (window.TransformApplyMode
+                ? window.TransformApplyMode.loadMode(localStorage)
+                : 'encode'),
             transformApplyGeneration: 0,
             activeTransform: null,
             transforms: transforms,
             legendCategories: legendCategories, // Always alphabetical for legend
             categories: sectionCategories, // Custom order for sections
             lastUsedTransforms: lastUsed,
             showLastUsed: lastUsed.length > 0,
             favorites: favorites,
             showFavorites: favorites.length > 0,
             transformOptionPrefs: this.loadTransformOptionPrefs(),
@@ -889,20 +892,30 @@ class TransformTool extends Tool {
                     .then(text => { this.chainDecodeOutput = text; })
                     .catch(e => { this.chainDecodeError = e.message || 'Decode failed.'; })
                     .finally(() => { this.chainDecodeLoading = false; });
             },
             transformInputControlKind: function() {
                 if (!this.activeTransform || this.activeTransform.inputKind !== 'text') {
                     return 'textarea';
                 }
                 return 'text';
             },
+            setTransformIoMode: function(mode) {
+                if (!window.TransformApplyMode) return;
+                const next = window.TransformApplyMode.normalizeMode(mode);
+                if (next === this.transformIoMode) return;
+                this.transformIoMode = next;
+                window.TransformApplyMode.saveMode(localStorage, next);
+                if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
+                    this.applyTransform(this.activeTransform);
+                }
+            },
             transformRefreshLexemeAnalysis: function() {
                 if (typeof window === 'undefined' || !window.LexemeAnalysis || typeof window.LexemeAnalysis.analyze !== 'function') {
                     this.transformLexemeAnalysis = { totalFindings: 0, findings: [], summary: 'Lexeme analysis unavailable.' };
                     return;
                 }
                 this.transformLexemeAnalysis = window.LexemeAnalysis.analyze(this.transformInput);
             },
             transformGetLexemeAnalysis: function() {
                 return this.transformLexemeAnalysis || { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' };
             },
diff --git a/templates/transforms.html b/templates/transforms.html
index a7b9115..3349db0 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -1,33 +1,78 @@
 <div v-if="activeTab === 'transforms'" class="tab-content">
                 <div class="transform-layout">
                     <div class="input-section">
+                        <div class="transform-io-mode" role="group" aria-label="Encode or decode">
+                            <button
+                                type="button"
+                                class="transform-io-mode-btn"
+                                :class="{ active: transformIoMode === 'encode' }"
+                                @click="setTransformIoMode('encode')"
+                            >Encode</button>
+                            <button
+                                type="button"
+                                class="transform-io-mode-btn"
+                                :class="{ active: transformIoMode === 'decode' }"
+                                @click="setTransformIoMode('decode')"
+                            >Decode</button>
+                        </div>
                         <textarea 
                             v-if="transformInputControlKind() === 'textarea'"
                             id="transform-input" 
                             v-model="transformInput" 
-                            placeholder="Enter text to transform..."
+                            :placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
                             @input="autoTransform"
                         ></textarea>
                         <input
                             v-else
                             id="transform-input"
                             type="text"
                             v-model="transformInput"
-                            placeholder="Enter text to transform..."
+                            :placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
                             @input="autoTransform"
                             autocomplete="off"
                             autocorrect="off"
                             spellcheck="false"
                         />
                     </div>
 
+                    <div class="output-section" v-if="transformOutput">
+                        <div class="output-heading">
+                            <h4>
+                                <i class="fas fa-check-circle"></i>
+                                {{ transformIoMode === 'decode' ? 'Decoded' : 'Transformed' }} Message
+                                <small v-if="activeTransform">({{ activeTransform.name }})</small>
+                            </h4>
+                        </div>
+                        <div class="output-container" :class="{ 'signwriting-output': activeTransform && activeTransform.category === 'signwriting' }">
+                            <img
+                                v-if="transformOutputKind === 'image'"
+                                :src="transformOutput"
+                                :alt="activeTransform ? activeTransform.name + ' image output' : 'Transformed image output'"
+                                class="transform-image-output"
+                            >
+                            <textarea
+                                v-else
+                                readonly
+                                v-model="transformOutput"
+                                aria-label="Transform output text"
+                            ></textarea>
+                            <button v-if="transformOutputKind !== 'image'" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
+                                <i class="fas fa-copy"></i>
+                            </button>
+                        </div>
+                        <div class="output-instructions">
+                            <small v-if="transformOutputKind === 'image'"><i class="fas fa-info-circle"></i> Save or share this generated image.</small>
+                            <small v-else><i class="fas fa-info-circle"></i> Copy this text and share it. Use Decode mode to reverse transformations.</small>
+                        </div>
+                    </div>
+
                     <div v-if="transformGetLexemeAnalysis().totalFindings" class="lexeme-analysis-card transform-lexeme-card">
                         <div class="lexeme-analysis-header">
                             <div>
                                 <div class="lexeme-analysis-kicker">Latin-Root Analysis</div>
                                 <h4>{{ transformGetLexemeAnalysis().summary }}</h4>
                                 <p>This shared input feeds transforms and inline translation. Neutralizing flagged wording here affects both paths.</p>
                             </div>
                             <button type="button" class="action-button copy lexeme-neutralize-btn" @click="transformNeutralizeInput">
                                 <i class="fas fa-seedling"></i> Neutralize flagged terms
                             </button>
@@ -708,50 +753,20 @@
                             </template>
 
                             <div v-if="transformListHasNoMatches()" class="transform-filter-empty">
                                 <i class="fas fa-search" aria-hidden="true"></i>
                                 <p>No transforms match your filters.</p>
                                 <button type="button" class="btn btn-secondary" @click="clearTransformFilters">Clear filters</button>
                             </div>
                         </div>
                     </div>
 
-                    <div class="output-section" v-if="transformOutput">
-                        <div class="output-heading">
-                            <h4>
-                                <i class="fas fa-check-circle"></i> 
-                                Transformed Message
-                                <small v-if="activeTransform">({{ activeTransform.name }})</small>
-                            </h4>
-                        </div>
-                        <div class="output-container" :class="{ 'signwriting-output': activeTransform && activeTransform.category === 'signwriting' }">
-                            <img
-                                v-if="transformOutputKind === 'image'"
-                                :src="transformOutput"
-                                :alt="activeTransform ? activeTransform.name + ' image output' : 'Transformed image output'"
-                                class="transform-image-output"
-                            >
-                            <textarea 
-                                v-else
-                                readonly 
-                                v-model="transformOutput"
-                                aria-label="Transformed text output"
-                            ></textarea>
-                            <button v-if="transformOutputKind !== 'image'" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
-                                <i class="fas fa-copy"></i>
-                            </button>
-                        </div>
-                        <div class="output-instructions">
-                            <small v-if="transformOutputKind === 'image'"><i class="fas fa-info-circle"></i> Save or share this generated image.</small>
-                            <small v-else><i class="fas fa-info-circle"></i> Copy this text and share it. Use the Decoder tab to reverse transformations.</small>
-                        </div>
-                    </div>
                 </div>
 
                 <!-- Native <template> keeps children out of the layout until Vue runs (no modal flash on load). -->
                 <template v-if="transformOptionsModalOpen && transformOptionsModalTransform">
                     <div
                         class="transform-options-backdrop"
                         @click.self="closeTransformOptions"
                     >
                     <div
                         class="transform-options-panel"
