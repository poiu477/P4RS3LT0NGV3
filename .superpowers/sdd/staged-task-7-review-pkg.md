# Review Package Staged Task 7 re-review
Base: 8b700fdb011da835189e077ec1368acb66e98e06
Head: 4273f761b922a5aba9d5c4c8caf55a1a29cff04e

## Commits
4273f76 fix: staged builder emoji carrier picker and template chip state
125d6f3 feat: staged recipe builder UI with templates and legacy toggle

## Stat
 .superpowers/sdd/staged-task-7-report.md |  35 +++++
 css/style.css                            | 191 +++++++++++++++++++++++-
 js/tools/TransformTool.js                | 239 +++++++++++++++++++++++++++++--
 templates/transforms.html                | 217 ++++++++++++++++++++++++++--
 4 files changed, 659 insertions(+), 23 deletions(-)

## Diff
```diff
diff --git a/.superpowers/sdd/staged-task-7-report.md b/.superpowers/sdd/staged-task-7-report.md
new file mode 100644
index 0000000..0a3b82b
--- /dev/null
+++ b/.superpowers/sdd/staged-task-7-report.md
@@ -0,0 +1,35 @@
+# Task 7 Report ΓÇö Staged builder UI
+
+## Status
+
+Complete. The Transform manager now defaults to a staged recipe builder while retaining an explicitly marked legacy free-form path.
+
+## Implementation
+
+- Added **New recipe** and **Free-form (legacy)** manager actions.
+- Added template chips backed by `TransformRecipeStages.TEMPLATES`.
+- Added a responsive `STAGE_ORDER` rail with stage-filtered transform pickers, per-stage ordering, options, and removal controls.
+- Added Translate language/model fields and QR/emoji-stego carrier controls.
+- Added `cycleDraftMode` checkbox support for `word_safe` and `one_way`.
+- Preserved staged records during import and showed Carrier/Legacy badges in manager rows.
+- Added `LEGACY_FREEFORM_BUILDER` markers to the unrestricted builder path.
+
+## Verification
+
+- `npm run build:templates` ΓÇö passed.
+- `npm run test:all` ΓÇö passed.
+- IDE lint check for edited files ΓÇö no errors.
+- `git diff --check` ΓÇö passed.
+
+## Concerns
+
+- Interactive browser coverage is intentionally deferred to Task 9 per the brief.
+- `index.html` is generated but untracked in this repository, so no rebuilt generated output is included.
+
+## Spec Review Follow-up
+
+- Replaced the emoji-stego free-text-only control with quick-pick buttons and a carrier select sourced from `window.steganography.carriers`.
+- Template chips now clear their selected state whenever a staged field, node, option, Translate setting, or carrier changes.
+- Added an accessible stage-specific label to every filtered transform search field.
+- Word-safe cycle mode now disables unsafe recipes in the add selector and flags unsafe members already in the draft.
+- Re-ran `npm run build:templates` and `npm run test:all`; both passed.
diff --git a/css/style.css b/css/style.css
index 46b6581..ab4885e 100644
--- a/css/style.css
+++ b/css/style.css
@@ -4608,10 +4608,20 @@ body.transform-options-modal-open {
 .chain-badge-ai-only {
     background: rgba(157, 122, 230, 0.18);
     color: #9d7ae6;
 }
 
+.chain-badge-carrier {
+    background: rgba(52, 152, 219, 0.18);
+    color: #3498db;
+}
+
+.chain-badge-legacy {
+    background: rgba(149, 165, 166, 0.2);
+    color: var(--text-color);
+}
+
 .chain-action-btn {
     width: 34px;
     height: 34px;
     display: flex;
     align-items: center;
@@ -4637,19 +4647,198 @@ body.transform-options-modal-open {
     border-color: #e05252;
     color: #e05252;
 }
 
 .chain-builder-panel {
-    max-width: 520px;
+    width: min(1100px, calc(100vw - 32px));
+    max-width: 1100px;
 }
 
 .chain-builder-body {
     display: flex;
     flex-direction: column;
     gap: 4px;
 }
 
+.chain-legacy-button {
+    opacity: 0.82;
+}
+
+.recipe-template-section {
+    margin: 4px 0 14px;
+}
+
+.recipe-section-label {
+    display: block;
+    margin-bottom: 7px;
+    font-size: 0.78rem;
+    font-weight: 700;
+    letter-spacing: 0.04em;
+    text-transform: uppercase;
+    opacity: 0.7;
+}
+
+.recipe-template-chips {
+    display: flex;
+    flex-wrap: wrap;
+    gap: 7px;
+}
+
+.recipe-template-chip {
+    text-transform: none;
+}
+
+.recipe-stage-rail {
+    display: grid;
+    grid-template-columns: repeat(6, minmax(210px, 1fr));
+    gap: 10px;
+    overflow-x: auto;
+    padding: 2px 2px 12px;
+}
+
+.recipe-stage {
+    min-width: 0;
+    padding: 10px;
+    border: 1px solid var(--input-border);
+    border-radius: 8px;
+    background: var(--main-bg-color);
+}
+
+.recipe-stage-required {
+    border-color: var(--accent-color);
+}
+
+.recipe-stage-header {
+    display: flex;
+    align-items: center;
+    gap: 8px;
+    margin-bottom: 10px;
+}
+
+.recipe-stage-header > div {
+    display: flex;
+    flex-direction: column;
+    min-width: 0;
+}
+
+.recipe-stage-header small {
+    font-size: 0.72rem;
+    opacity: 0.6;
+}
+
+.recipe-stage-nodes .chain-node-item {
+    background: var(--button-bg);
+}
+
+.recipe-stage-nodes .chain-node-row {
+    padding: 7px;
+}
+
+.recipe-stage-add {
+    width: 100%;
+    padding: 9px;
+    border: 1px dashed var(--input-border);
+    border-radius: 7px;
+    background: transparent;
+    color: var(--text-color);
+    cursor: pointer;
+    text-align: left;
+}
+
+.recipe-stage-add:hover {
+    border-color: var(--accent-color);
+    background: var(--button-hover-bg);
+}
+
+.recipe-stage-picker {
+    margin: 8px 0 0;
+}
+
+.recipe-stage-picker .chain-node-picker-results {
+    max-height: 210px;
+}
+
+.recipe-special-stage {
+    display: flex;
+    flex-direction: column;
+    gap: 8px;
+}
+
+.recipe-special-stage .transform-options-field {
+    margin: 0;
+}
+
+.recipe-stage-remove {
+    padding: 5px 0;
+    border: 0;
+    background: transparent;
+    color: var(--error-color, #e05252);
+    cursor: pointer;
+    font-size: 0.78rem;
+    text-align: left;
+}
+
+.recipe-carrier-options {
+    display: flex;
+    flex-direction: column;
+    gap: 8px;
+    font-size: 0.85rem;
+}
+
+.recipe-carrier-options label {
+    display: flex;
+    align-items: center;
+    gap: 6px;
+}
+
+.recipe-emoji-input {
+    font-size: 1.25rem;
+}
+
+.recipe-legacy-notice,
+.recipe-cycle-mode {
+    padding: 10px;
+    border: 1px solid var(--input-border);
+    border-radius: 8px;
+    background: var(--button-bg);
+}
+
+.recipe-legacy-notice {
+    margin: 0 0 12px;
+    font-size: 0.85rem;
+}
+
+.recipe-cycle-mode {
+    display: flex;
+    align-items: flex-start;
+    gap: 9px;
+    margin-bottom: 12px;
+    cursor: pointer;
+}
+
+.recipe-cycle-mode span {
+    display: flex;
+    flex-direction: column;
+    gap: 2px;
+}
+
+.recipe-cycle-mode small {
+    opacity: 0.65;
+}
+
+@media (max-width: 780px) {
+    .chain-builder-panel {
+        width: min(520px, calc(100vw - 20px));
+    }
+
+    .recipe-stage-rail {
+        display: flex;
+        flex-direction: column;
+        overflow-x: visible;
+    }
+}
+
 .chain-node-list {
     margin-bottom: 12px;
 }
 
 .chain-node-item {
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index e982b5a..9e5f9b7 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -60,18 +60,35 @@ class TransformTool extends Tool {
 
             // Chain / cycle builder
             chainManageOpen: false,
             chainBuilderOpen: false,
             chainBuilderKind: 'chain', // 'chain' | 'cycle'
+            recipeBuilderMode: 'staged', // 'staged' | 'legacy'
+            recipeTemplateId: '',
+            stagedDraft: {
+                name: '',
+                stages: {
+                    normalize: null,
+                    translate: null,
+                    obfuscate: [],
+                    present: null,
+                    conceal: null,
+                    carrier: null
+                }
+            },
+            stagedPickerStage: '',
+            stagedPickerQuery: '',
+            stagedOpenNodeOptions: null,
             chainBuilderEditId: null,
             chainBuilderError: '',
             chainDraftName: '',
             chainDraftNodes: [],
             chainNodePickerQuery: '',
             chainOpenNodeOptionsIndex: null,
             cycleDraftName: '',
             cycleDraftChainIds: [],
+            cycleDraftMode: 'word_safe',
             chainDecodeOpenKey: '',
             chainDecodeInput: '',
             chainDecodeOutput: '',
             chainDecodeLoading: false,
             chainDecodeError: '',
@@ -334,19 +351,211 @@ class TransformTool extends Tool {
             },
             cycleChainName: function(chainId) {
                 const chain = this.savedChains().find(c => c.id === chainId);
                 return chain ? chain.name : '(deleted chain)';
             },
+            cycleRecipeIsWordSafe: function(chain) {
+                return !!(window.TransformChains &&
+                    typeof window.TransformChains.recipeIsWordSafe === 'function' &&
+                    window.TransformChains.recipeIsWordSafe(chain));
+            },
+            cycleChainIsWordSafe: function(chainId) {
+                return this.cycleRecipeIsWordSafe(this.savedChains().find(chain => chain.id === chainId));
+            },
+            recipeHasCarrier: function(recipe) {
+                return !!(recipe && recipe.kind === 'staged' && recipe.stages && recipe.stages.carrier);
+            },
             refreshChainsTransforms: function() {
                 // Same rebuild custom spelling alphabets use after a CRUD change ΓÇö
                 // generic over window.transforms, not spelling-specific.
                 if (typeof this.refreshCustomSpellingTransforms === 'function') {
                     this.refreshCustomSpellingTransforms();
                 }
             },
 
-            // -- chain (node sequence) builder --
+            // -- staged recipe builder --
+
+            stagedEmptyDraft: function() {
+                return {
+                    name: '',
+                    stages: {
+                        normalize: null,
+                        translate: null,
+                        obfuscate: [],
+                        present: null,
+                        conceal: null,
+                        carrier: null
+                    }
+                };
+            },
+            recipeStageOrder: function() {
+                return window.TransformRecipeStages ? window.TransformRecipeStages.STAGE_ORDER : [];
+            },
+            recipeStageLabel: function(stageId) {
+                const labels = {
+                    normalize: 'Normalize',
+                    translate: 'Translate',
+                    obfuscate: 'Obfuscate',
+                    present: 'Present',
+                    conceal: 'Conceal',
+                    carrier: 'Carrier'
+                };
+                return labels[stageId] || stageId;
+            },
+            recipeTemplates: function() {
+                return window.TransformRecipeStages ? window.TransformRecipeStages.TEMPLATES : [];
+            },
+            recipeCarrierChoices: function() {
+                const carriers = window.steganography && Array.isArray(window.steganography.carriers)
+                    ? window.steganography.carriers
+                    : [];
+                return carriers.map(carrier => ({
+                    emoji: carrier.emoji,
+                    name: carrier.name || carrier.emoji
+                }));
+            },
+            clearRecipeTemplateSelection: function() {
+                this.recipeTemplateId = '';
+            },
+            openRecipeBuilder: function(existing) {
+                this.chainBuilderKind = 'chain';
+                this.recipeBuilderMode = 'staged';
+                this.chainBuilderEditId = existing ? existing.id : null;
+                this.stagedDraft = existing
+                    ? { name: existing.name, stages: JSON.parse(JSON.stringify(existing.stages || {})) }
+                    : this.stagedEmptyDraft();
+                this.recipeTemplateId = '';
+                this.stagedPickerStage = '';
+                this.stagedPickerQuery = '';
+                this.stagedOpenNodeOptions = null;
+                this.chainBuilderError = '';
+                this.chainBuilderOpen = true;
+            },
+            applyRecipeTemplate: function(templateId) {
+                const template = this.recipeTemplates().find(t => t.id === templateId);
+                if (!template) return;
+                this.recipeTemplateId = templateId;
+                this.$set(this.stagedDraft, 'stages', JSON.parse(JSON.stringify(template.stages)));
+                this.stagedPickerStage = '';
+                this.stagedPickerQuery = '';
+                this.chainBuilderError = '';
+            },
+            stagedStageNodes: function(stageId) {
+                const nodes = this.stagedDraft && this.stagedDraft.stages
+                    ? this.stagedDraft.stages[stageId]
+                    : null;
+                return Array.isArray(nodes) ? nodes : [];
+            },
+            stagedNodeCandidates: function(stageId) {
+                if (!window.transforms || !window.TransformRecipeStages) return [];
+                const query = (this.stagedPickerQuery || '').trim().toLowerCase();
+                return Object.keys(window.transforms)
+                    .filter(key => window.TransformRecipeStages.isTransformAllowedInStage(
+                        stageId,
+                        key,
+                        window.transforms
+                    ))
+                    .map(key => ({ key, t: window.transforms[key] }))
+                    .filter(({ t }) => t && t.name && (!query || t.name.toLowerCase().indexOf(query) !== -1))
+                    .sort((a, b) => a.t.name.localeCompare(b.t.name))
+                    .map(({ key, t }) => ({ key, name: t.name, category: t.category }));
+            },
+            stagedTogglePicker: function(stageId) {
+                this.stagedPickerStage = this.stagedPickerStage === stageId ? '' : stageId;
+                this.stagedPickerQuery = '';
+            },
+            stagedAddNode: function(stageId, key) {
+                const t = window.transforms && window.transforms[key];
+                if (!t || !window.TransformRecipeStages ||
+                    !window.TransformRecipeStages.isTransformAllowedInStage(stageId, key, window.transforms)) {
+                    return;
+                }
+                const options = {};
+                const prefs = typeof this.getMergedOptionsForTransform === 'function'
+                    ? this.getMergedOptionsForTransform(t.name)
+                    : {};
+                (t.configurableOptions || []).forEach(opt => {
+                    options[opt.id] = prefs && prefs[opt.id] != null ? prefs[opt.id] : opt.default;
+                });
+                const nodes = this.stagedStageNodes(stageId).slice();
+                nodes.push({ transform: key, options });
+                this.$set(this.stagedDraft.stages, stageId, nodes);
+                this.clearRecipeTemplateSelection();
+                this.stagedPickerQuery = '';
+                this.chainBuilderError = '';
+            },
+            stagedRemoveNode: function(stageId, index) {
+                const nodes = this.stagedStageNodes(stageId).slice();
+                nodes.splice(index, 1);
+                this.$set(this.stagedDraft.stages, stageId, nodes.length ? nodes : null);
+                this.clearRecipeTemplateSelection();
+                this.stagedOpenNodeOptions = null;
+            },
+            stagedMoveNode: function(stageId, index, direction) {
+                const nodes = this.stagedStageNodes(stageId).slice();
+                const target = index + direction;
+                if (target < 0 || target >= nodes.length) return;
+                const node = nodes.splice(index, 1)[0];
+                nodes.splice(target, 0, node);
+                this.$set(this.stagedDraft.stages, stageId, nodes);
+                this.clearRecipeTemplateSelection();
+                this.stagedOpenNodeOptions = null;
+            },
+            stagedToggleNodeOptions: function(stageId, index) {
+                const open = this.stagedOpenNodeOptions;
+                this.stagedOpenNodeOptions = open && open.stageId === stageId && open.index === index
+                    ? null
+                    : { stageId, index };
+            },
+            stagedNodeOptionsOpen: function(stageId, index) {
+                const open = this.stagedOpenNodeOptions;
+                return !!(open && open.stageId === stageId && open.index === index);
+            },
+            stagedSetNodeOption: function(stageId, index, optId, value) {
+                const node = this.stagedStageNodes(stageId)[index];
+                if (node) {
+                    this.$set(node.options, optId, value);
+                    this.clearRecipeTemplateSelection();
+                }
+            },
+            stagedSetTranslateEnabled: function(enabled) {
+                this.$set(this.stagedDraft.stages, 'translate', enabled
+                    ? { type: 'translate', lang: 'la', model: this.translateModel || '' }
+                    : null);
+                this.clearRecipeTemplateSelection();
+            },
+            stagedSetCarrier: function(type) {
+                this.$set(this.stagedDraft.stages, 'carrier', type
+                    ? { type, options: type === 'emoji_stego' ? { carrierEmoji: '≡ƒÉì' } : {} }
+                    : null);
+                this.clearRecipeTemplateSelection();
+            },
+            stagedSetCarrierEmoji: function(emoji) {
+                const carrier = this.stagedDraft.stages.carrier;
+                if (!carrier || carrier.type !== 'emoji_stego') return;
+                this.$set(carrier.options, 'carrierEmoji', emoji);
+                this.clearRecipeTemplateSelection();
+            },
+            saveStagedRecipe: function() {
+                const draft = {
+                    id: this.chainBuilderEditId,
+                    name: (this.stagedDraft.name || '').trim(),
+                    kind: 'staged',
+                    stages: this.stagedDraft.stages
+                };
+                const id = window.TransformChains.saveRecipe(draft);
+                if (!id) {
+                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
+                        'Could not save recipe.';
+                    return;
+                }
+                this.chainBuilderOpen = false;
+                this.refreshChainsTransforms();
+                this.showNotification('Recipe saved ΓÇö find it under chains', 'success', 'fas fa-link');
+            },
+
+            // -- LEGACY_FREEFORM_BUILDER: remove with free-form chain support --
 
             chainNodeCandidates: function() {
                 if (!window.transforms) return [];
                 const query = (this.chainNodePickerQuery || '').trim().toLowerCase();
                 return Object.keys(window.transforms)
@@ -355,19 +564,28 @@ class TransformTool extends Tool {
                     .filter(({ t }) => !query || t.name.toLowerCase().indexOf(query) !== -1)
                     .sort((a, b) => a.t.name.localeCompare(b.t.name))
                     .map(({ key, t }) => ({ key, name: t.name, category: t.category }));
             },
             openChainBuilder: function(existing) {
+                if (existing && existing.kind === 'staged') {
+                    this.openRecipeBuilder(existing);
+                    return;
+                }
                 this.chainBuilderKind = 'chain';
+                this.recipeBuilderMode = 'legacy';
                 this.chainBuilderEditId = existing ? existing.id : null;
                 this.chainDraftName = existing ? existing.name : '';
                 this.chainDraftNodes = existing ? JSON.parse(JSON.stringify(existing.nodes || [])) : [];
                 this.chainNodePickerQuery = '';
                 this.chainOpenNodeOptionsIndex = null;
                 this.chainBuilderError = '';
                 this.chainBuilderOpen = true;
             },
+            setLegacyFreeformBuilder: function(enabled) {
+                // LEGACY_FREEFORM_BUILDER: explicit escape hatch for unrestricted transform stacks.
+                if (enabled) this.openChainBuilder(null);
+            },
             chainAddNode: function(key) {
                 const t = window.transforms[key];
                 if (!t) return;
                 const options = {};
                 const prefs = typeof this.getMergedOptionsForTransform === 'function'
@@ -446,10 +664,11 @@ class TransformTool extends Tool {
             openCycleBuilder: function(existing) {
                 this.chainBuilderKind = 'cycle';
                 this.chainBuilderEditId = existing ? existing.id : null;
                 this.cycleDraftName = existing ? existing.name : '';
                 this.cycleDraftChainIds = existing ? existing.chainIds.slice() : [];
+                this.cycleDraftMode = existing && existing.mode === 'one_way' ? 'one_way' : 'word_safe';
                 this.chainBuilderError = '';
                 this.chainBuilderOpen = true;
             },
             cycleAddChainRef: function(chainId) {
                 if (!chainId) return;
@@ -491,11 +710,12 @@ class TransformTool extends Tool {
                     return;
                 }
                 const id = window.TransformChains.saveCycle({
                     id: this.chainBuilderEditId,
                     name,
-                    chainIds: this.cycleDraftChainIds
+                    chainIds: this.cycleDraftChainIds,
+                    mode: this.cycleDraftMode
                 });
                 if (!id) {
                     this.chainBuilderError = window.TransformChains.getLastMutationError() ||
                         'Could not save cycle.';
                     return;
@@ -579,22 +799,25 @@ class TransformTool extends Tool {
                                     mutationErrors.push(mutationError);
                                 }
                             }
                         };
                         (data.chains || []).forEach(function(c) {
-                            const result = window.TransformChains.saveChain({
-                                id: c.id,
-                                name: c.name,
-                                nodes: c.nodes
-                            });
+                            const result = c && c.kind === 'staged'
+                                ? window.TransformChains.saveRecipe(c)
+                                : window.TransformChains.saveChain({
+                                    id: c.id,
+                                    name: c.name,
+                                    nodes: c.nodes
+                                });
                             recordSaveResult(result);
                         });
                         (data.cycles || []).forEach(function(cy) {
                             const result = window.TransformChains.saveCycle({
                                 id: cy.id,
                                 name: cy.name,
-                                chainIds: cy.chainIds
+                                chainIds: cy.chainIds,
+                                mode: cy.mode
                             });
                             recordSaveResult(result);
                         });
                         self.refreshChainsTransforms();
                         if (failedCount) {
diff --git a/templates/transforms.html b/templates/transforms.html
index 1ba47b1..d94576d 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -102,27 +102,30 @@
                                     </button>
                                 </div>
                             </div>
                         </div>
 
-                        <!-- Chains: ordered transform pipelines, and per-word cycles across them -->
+                        <!-- Recipes: staged pipelines, legacy free-form chains, and per-word cycles -->
                         <div class="transform-section chain-manager">
                             <button
                                 type="button"
                                 class="chain-manager-toggle"
                                 @click="chainManageOpen = !chainManageOpen"
                                 :aria-expanded="chainManageOpen ? 'true' : 'false'"
                             >
                                 <i class="fas" :class="chainManageOpen ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                                 <i class="fas fa-link"></i>
-                                Chains
-                                <small>Combine transforms into a pipeline, or rotate several across words</small>
+                                Recipes &amp; chains
+                                <small>Build a staged recipe, or rotate saved recipes across words</small>
                             </button>
                             <div v-if="chainManageOpen" class="chain-manager-body">
                                 <div class="chain-manager-actions">
-                                    <button type="button" class="btn btn-secondary" @click="openChainBuilder(null)">
-                                        <i class="fas fa-plus"></i> New chain
+                                    <button type="button" class="btn btn-secondary" @click="openRecipeBuilder(null)">
+                                        <i class="fas fa-plus"></i> New recipe
+                                    </button>
+                                    <button type="button" class="btn btn-secondary chain-legacy-button" @click="setLegacyFreeformBuilder(true)">
+                                        <i class="fas fa-sliders"></i> Free-form (legacy)
                                     </button>
                                     <button type="button" class="btn btn-secondary" @click="openCycleBuilder(null)" :disabled="!savedChains().length">
                                         <i class="fas fa-plus"></i> New per-word cycle
                                     </button>
                                     <button type="button" class="btn btn-secondary" @click="chainExportAll">
@@ -136,21 +139,23 @@
                                         type="file"
                                         accept="application/json,.json"
                                         hidden
                                         @change="chainImportAll($event.target.files[0]); $event.target.value = ''"
                                     >
-                                    <small v-if="!savedChains().length" class="chain-manager-hint">Create a chain first ΓÇö cycles rotate through saved chains.</small>
+                                    <small v-if="!savedChains().length" class="chain-manager-hint">Create a recipe first ΓÇö cycles rotate through saved recipes.</small>
                                 </div>
 
                                 <div v-if="savedChains().length" class="chain-list">
-                                    <h5>Chains</h5>
+                                    <h5>Recipes &amp; free-form chains</h5>
                                     <div v-for="chain in savedChains()" :key="chain.id" class="chain-list-item">
                                         <div class="chain-list-item-main">
                                             <strong>{{ chain.name }}</strong>
                                             <span class="chain-badge" :class="chainIsReversibleNow(chain) ? 'chain-badge-reversible' : 'chain-badge-ai-only'">
                                                 {{ chainIsReversibleNow(chain) ? 'Reversible' : 'AI-decode only' }}
                                             </span>
+                                            <span v-if="recipeHasCarrier(chain)" class="chain-badge chain-badge-carrier">Carrier</span>
+                                            <span v-if="chain.kind !== 'staged'" class="chain-badge chain-badge-legacy">Legacy</span>
                                             <small>{{ chainRegisteredEntry(chain) ? chainRegisteredEntry(chain).description : '' }}</small>
                                         </div>
                                         <div class="chain-list-item-actions">
                                             <button type="button" class="chain-action-btn" @click="chainCopyRecipe(chain, 'chain')" title="Copy recipe">
                                                 <i class="fas fa-copy"></i>
@@ -224,12 +229,12 @@
                                         </div>
                                     </div>
                                 </div>
 
                                 <p v-if="!savedChains().length && !savedCycles().length" class="chain-manager-empty">
-                                    No chains yet. A chain applies several transforms in sequence to your whole
-                                    input; a cycle rotates several chains across successive words. Both appear as
+                                    No recipes yet. A recipe applies staged transforms to your whole input; a
+                                    cycle rotates several recipes across successive words. Both appear as
                                     buttons on this page under <strong>chains</strong> once saved.
                                 </p>
                             </div>
                         </div>
 
@@ -834,20 +839,182 @@
                         @click.stop
                     >
                         <div class="transform-options-panel-header">
                             <h3 id="chain-builder-title">
                                 {{ chainBuilderEditId ? 'Edit' : 'New' }}
-                                {{ chainBuilderKind === 'chain' ? 'chain' : 'per-word cycle' }}
+                                {{ chainBuilderKind === 'cycle' ? 'per-word cycle' : (recipeBuilderMode === 'staged' ? 'recipe' : 'free-form chain') }}
                             </h3>
                             <button type="button" class="transform-options-close" @click="closeChainBuilder" title="Close" aria-label="Close">
                                 <i class="fas fa-times"></i>
                             </button>
                         </div>
 
                         <div class="transform-options-panel-body chain-builder-body">
-                            <!-- Chain builder: ordered list of transform nodes -->
-                            <template v-if="chainBuilderKind === 'chain'">
+                            <!-- Default staged recipe builder -->
+                            <template v-if="chainBuilderKind === 'chain' && recipeBuilderMode === 'staged'">
+                                <label class="transform-options-field">
+                                    Name
+                                    <input type="text" v-model="stagedDraft.name" class="transform-options-text" placeholder="e.g. Latin cipher carrier" autocomplete="off" />
+                                </label>
+
+                                <div class="recipe-template-section">
+                                    <span class="recipe-section-label">Start from a template</span>
+                                    <div class="recipe-template-chips" role="group" aria-label="Recipe templates">
+                                        <button
+                                            v-for="template in recipeTemplates()"
+                                            :key="template.id"
+                                            type="button"
+                                            class="category-chip recipe-template-chip"
+                                            :class="{ 'active-filter': recipeTemplateId === template.id }"
+                                            @click="applyRecipeTemplate(template.id)"
+                                        >
+                                            {{ template.name }}
+                                        </button>
+                                    </div>
+                                </div>
+
+                                <div class="recipe-stage-rail">
+                                    <section
+                                        v-for="(stageId, stageIndex) in recipeStageOrder()"
+                                        :key="stageId"
+                                        class="recipe-stage"
+                                        :class="{ 'recipe-stage-required': stageId === 'obfuscate' }"
+                                    >
+                                        <header class="recipe-stage-header">
+                                            <span class="chain-node-index">{{ stageIndex + 1 }}</span>
+                                            <div>
+                                                <strong>{{ recipeStageLabel(stageId) }}</strong>
+                                                <small>{{ stageId === 'obfuscate' ? 'At least one step' : 'Optional' }}</small>
+                                            </div>
+                                        </header>
+
+                                        <template v-if="stageId === 'translate'">
+                                            <button
+                                                v-if="!stagedDraft.stages.translate"
+                                                type="button"
+                                                class="recipe-stage-add"
+                                                @click="stagedSetTranslateEnabled(true)"
+                                            >
+                                                <i class="fas fa-plus"></i> Add Translate
+                                            </button>
+                                            <div v-else class="recipe-special-stage">
+                                                <label class="transform-options-field">
+                                                    Language
+                                                    <select v-model="stagedDraft.stages.translate.lang" class="transform-options-select" @change="clearRecipeTemplateSelection">
+                                                        <optgroup label="Major languages">
+                                                            <option v-for="lang in translateMainLangs" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
+                                                        </optgroup>
+                                                        <optgroup label="Dead &amp; exotic">
+                                                            <option v-for="lang in translateExoticLangs" :key="lang.code" :value="lang.code">{{ lang.name }}</option>
+                                                        </optgroup>
+                                                        <optgroup v-if="translateCustomLangs.length" label="Custom">
+                                                            <option v-for="lang in translateCustomLangs" :key="lang.name" :value="lang.name">{{ lang.name }}</option>
+                                                        </optgroup>
+                                                    </select>
+                                                </label>
+                                                <openrouter-model-select v-model="stagedDraft.stages.translate.model" label="Translation model" @input="clearRecipeTemplateSelection"></openrouter-model-select>
+                                                <span class="chain-badge chain-badge-ai-only">AI / not mechanically reversible</span>
+                                                <button type="button" class="recipe-stage-remove" @click="stagedSetTranslateEnabled(false)">Remove Translate</button>
+                                            </div>
+                                        </template>
+
+                                        <template v-else-if="stageId === 'carrier'">
+                                            <div class="recipe-carrier-options">
+                                                <label><input type="radio" name="recipe-carrier" :checked="!stagedDraft.stages.carrier" @change="stagedSetCarrier('')" /> None</label>
+                                                <label><input type="radio" name="recipe-carrier" value="qr" :checked="stagedDraft.stages.carrier && stagedDraft.stages.carrier.type === 'qr'" @change="stagedSetCarrier('qr')" /> QR</label>
+                                                <label><input type="radio" name="recipe-carrier" value="emoji_stego" :checked="stagedDraft.stages.carrier && stagedDraft.stages.carrier.type === 'emoji_stego'" @change="stagedSetCarrier('emoji_stego')" /> Emoji stego</label>
+                                            </div>
+                                            <div v-if="stagedDraft.stages.carrier && stagedDraft.stages.carrier.type === 'emoji_stego'" class="recipe-carrier-picker carrier-quick-grid">
+                                                <span class="recipe-section-label">Carrier emoji</span>
+                                                <div class="emoji-grid" role="group" aria-label="Quick carrier emoji choices">
+                                                    <button
+                                                        v-for="carrier in recipeCarrierChoices().slice(0, 10)"
+                                                        :key="carrier.emoji"
+                                                        type="button"
+                                                        class="emoji-button"
+                                                        :class="{ selected: stagedDraft.stages.carrier.options.carrierEmoji === carrier.emoji }"
+                                                        :title="'Use ' + carrier.name"
+                                                        :aria-label="'Use ' + carrier.name + ' carrier'"
+                                                        @click="stagedSetCarrierEmoji(carrier.emoji)"
+                                                    >
+                                                        {{ carrier.emoji }}
+                                                    </button>
+                                                </div>
+                                                <label class="transform-options-field">
+                                                    All carriers
+                                                    <select
+                                                        class="transform-options-select recipe-emoji-input"
+                                                        :value="stagedDraft.stages.carrier.options.carrierEmoji"
+                                                        aria-label="Emoji steganography carrier"
+                                                        @change="stagedSetCarrierEmoji($event.target.value)"
+                                                    >
+                                                        <option v-for="carrier in recipeCarrierChoices()" :key="carrier.emoji" :value="carrier.emoji">
+                                                            {{ carrier.emoji }} {{ carrier.name }}
+                                                        </option>
+                                                    </select>
+                                                </label>
+                                            </div>
+                                        </template>
+
+                                        <template v-else>
+                                            <div v-if="stagedStageNodes(stageId).length" class="recipe-stage-nodes">
+                                                <div v-for="(node, nodeIndex) in stagedStageNodes(stageId)" :key="nodeIndex" class="chain-node-item">
+                                                    <div class="chain-node-row">
+                                                        <span class="chain-node-name">{{ chainNodeName(node) }}</span>
+                                                        <span class="chain-node-controls">
+                                                            <button type="button" class="chain-action-btn" :disabled="nodeIndex === 0" @click="stagedMoveNode(stageId, nodeIndex, -1)" title="Move up">
+                                                                <i class="fas fa-arrow-up"></i>
+                                                            </button>
+                                                            <button type="button" class="chain-action-btn" :disabled="nodeIndex === stagedStageNodes(stageId).length - 1" @click="stagedMoveNode(stageId, nodeIndex, 1)" title="Move down">
+                                                                <i class="fas fa-arrow-down"></i>
+                                                            </button>
+                                                            <button v-if="chainNodeOptionFields(node).length" type="button" class="chain-action-btn" @click="stagedToggleNodeOptions(stageId, nodeIndex)" title="Options">
+                                                                <i class="fas fa-gear"></i>
+                                                            </button>
+                                                            <button type="button" class="chain-action-btn chain-action-btn-danger" @click="stagedRemoveNode(stageId, nodeIndex)" title="Remove">
+                                                                <i class="fas fa-times"></i>
+                                                            </button>
+                                                        </span>
+                                                    </div>
+                                                    <div v-if="stagedNodeOptionsOpen(stageId, nodeIndex)" class="chain-node-options">
+                                                        <div v-for="opt in chainNodeOptionFields(node)" :key="opt.id" class="transform-options-field">
+                                                            <label :for="'recipe-opt-' + stageId + '-' + nodeIndex + '-' + opt.id">{{ opt.label }}</label>
+                                                            <input v-if="opt.type === 'boolean'" :id="'recipe-opt-' + stageId + '-' + nodeIndex + '-' + opt.id" type="checkbox" class="transform-options-checkbox" :checked="node.options[opt.id]" @change="stagedSetNodeOption(stageId, nodeIndex, opt.id, $event.target.checked)" />
+                                                            <select v-else-if="opt.type === 'select'" :id="'recipe-opt-' + stageId + '-' + nodeIndex + '-' + opt.id" class="transform-options-select" :value="node.options[opt.id]" @change="stagedSetNodeOption(stageId, nodeIndex, opt.id, $event.target.value)">
+                                                                <option v-for="choice in opt.options" :key="String(choice.value)" :value="choice.value">{{ choice.label }}</option>
+                                                            </select>
+                                                            <input v-else-if="opt.type === 'number'" :id="'recipe-opt-' + stageId + '-' + nodeIndex + '-' + opt.id" type="number" class="transform-options-number" :value="node.options[opt.id]" :min="opt.min != null ? opt.min : null" :max="opt.max != null ? opt.max : null" :step="opt.step != null ? opt.step : 1" @input="stagedSetNodeOption(stageId, nodeIndex, opt.id, $event.target.value === '' ? opt.default : Number($event.target.value))" />
+                                                            <input v-else :id="'recipe-opt-' + stageId + '-' + nodeIndex + '-' + opt.id" type="text" class="transform-options-text" :value="node.options[opt.id]" @input="stagedSetNodeOption(stageId, nodeIndex, opt.id, $event.target.value)" />
+                                                        </div>
+                                                    </div>
+                                                </div>
+                                            </div>
+                                            <button type="button" class="recipe-stage-add" @click="stagedTogglePicker(stageId)">
+                                                <i class="fas" :class="stagedPickerStage === stageId ? 'fa-minus' : 'fa-plus'"></i>
+                                                {{ stagedStageNodes(stageId).length ? 'Add another' : 'Add ' + recipeStageLabel(stageId) }}
+                                            </button>
+                                            <div v-if="stagedPickerStage === stageId" class="chain-node-picker recipe-stage-picker">
+                                                <input type="search" v-model="stagedPickerQuery" :placeholder="'Search ' + recipeStageLabel(stageId).toLowerCase() + ' transforms...'" :aria-label="'Search transforms for ' + recipeStageLabel(stageId) + ' stage'" autocomplete="off" spellcheck="false" />
+                                                <div class="chain-node-picker-results">
+                                                    <button v-for="candidate in stagedNodeCandidates(stageId)" :key="candidate.key" type="button" class="chain-node-picker-result" @click="stagedAddNode(stageId, candidate.key)">
+                                                        <i class="fas fa-plus"></i> {{ candidate.name }}
+                                                        <small>{{ candidate.category }}</small>
+                                                    </button>
+                                                    <small v-if="!stagedNodeCandidates(stageId).length" class="chain-manager-hint">No allowed transforms match.</small>
+                                                </div>
+                                            </div>
+                                        </template>
+                                    </section>
+                                </div>
+                            </template>
+
+                            <!-- LEGACY_FREEFORM_BUILDER: unrestricted ordered transform list -->
+                            <template v-else-if="chainBuilderKind === 'chain'">
+                                <p class="recipe-legacy-notice">
+                                    <span class="chain-badge chain-badge-legacy">Legacy</span>
+                                    Free-form chains ignore stage rules and may be removed in a future version.
+                                </p>
                                 <label class="transform-options-field">
                                     Name
                                     <input type="text" v-model="chainDraftName" class="transform-options-text" placeholder="e.g. ROT13 then Base64" autocomplete="off" />
                                 </label>
 
@@ -965,16 +1132,31 @@
                             <template v-else>
                                 <label class="transform-options-field">
                                     Name
                                     <input type="text" v-model="cycleDraftName" class="transform-options-text" placeholder="e.g. Alternate Base64 / Caesar" autocomplete="off" />
                                 </label>
+                                <label class="recipe-cycle-mode">
+                                    <input
+                                        type="checkbox"
+                                        v-model="cycleDraftMode"
+                                        true-value="one_way"
+                                        false-value="word_safe"
+                                    />
+                                    <span>
+                                        <strong>One-way / AI-decode</strong>
+                                        <small>Allows recipes that are not word-safe. Leave off for reversible word-safe cycles.</small>
+                                    </span>
+                                </label>
 
                                 <div class="chain-node-list">
                                     <div v-for="(chainId, index) in cycleDraftChainIds" :key="index" class="chain-node-item">
                                         <div class="chain-node-row">
                                             <span class="chain-node-index">{{ index + 1 }}</span>
                                             <span class="chain-node-name">{{ cycleChainName(chainId) }}</span>
+                                            <span v-if="cycleDraftMode === 'word_safe' && !cycleChainIsWordSafe(chainId)" class="chain-badge chain-badge-ai-only">
+                                                Not word-safe
+                                            </span>
                                             <span class="chain-node-controls">
                                                 <button type="button" class="chain-action-btn" :disabled="index === 0" @click="cycleMoveChainRef(index, -1)" title="Move up">
                                                     <i class="fas fa-arrow-up"></i>
                                                 </button>
                                                 <button type="button" class="chain-action-btn" :disabled="index === cycleDraftChainIds.length - 1" @click="cycleMoveChainRef(index, 1)" title="Move down">
@@ -994,11 +1176,18 @@
 
                                 <label class="transform-options-field">
                                     Add chain to rotation
                                     <select class="transform-options-select" @change="cycleAddChainRef($event.target.value); $event.target.value = ''">
                                         <option value="">Select a chainΓÇª</option>
-                                        <option v-for="chain in savedChains()" :key="chain.id" :value="chain.id">{{ chain.name }}</option>
+                                        <option
+                                            v-for="chain in savedChains()"
+                                            :key="chain.id"
+                                            :value="chain.id"
+                                            :disabled="cycleDraftMode === 'word_safe' && !cycleRecipeIsWordSafe(chain)"
+                                        >
+                                            {{ chain.name }}{{ cycleDraftMode === 'word_safe' && !cycleRecipeIsWordSafe(chain) ? ' ΓÇö not word-safe' : '' }}
+                                        </option>
                                     </select>
                                 </label>
 
                                 <div v-if="cycleDraftChainIds.length" class="chain-preview">
                                     <h5>Preview</h5>
@@ -1014,11 +1203,11 @@
                                 Cancel
                             </button>
                             <button
                                 type="button"
                                 class="transform-options-btn transform-options-btn-primary"
-                                @click="chainBuilderKind === 'chain' ? saveChainDraft() : saveCycleDraft()"
+                                @click="chainBuilderKind === 'cycle' ? saveCycleDraft() : (recipeBuilderMode === 'staged' ? saveStagedRecipe() : saveChainDraft())"
                             >
                                 Save
                             </button>
                         </div>
                     </div>

```