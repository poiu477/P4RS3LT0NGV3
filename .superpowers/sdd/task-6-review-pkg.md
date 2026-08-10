# Review Package Task 6 re-review
Base: 2617ff1fb12a6df6ec9b12aa1c5171e101d51b97
Head: c83c383222314118a8f9e58fa44e89976dbafb30

## Commits
c83c383 fix: report chain import save failures instead of false success
d63dfdf feat: chain decode model, prefs-seeded nodes, export/import and copy recipe

## Stat
 js/tools/TransformTool.js | 89 +++++++++++++++++++++++++++++++++++++++++++++--
 templates/transforms.html | 21 +++++++++++
 2 files changed, 107 insertions(+), 3 deletions(-)

## Diff
```diff
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 50e8a9f..e982b5a 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -69,17 +69,18 @@ class TransformTool extends Tool {
             chainNodePickerQuery: '',
             chainOpenNodeOptionsIndex: null,
             cycleDraftName: '',
             cycleDraftChainIds: [],
             chainDecodeOpenKey: '',
             chainDecodeInput: '',
             chainDecodeOutput: '',
             chainDecodeLoading: false,
-            chainDecodeError: ''
+            chainDecodeError: '',
+            chainDecodeModel: localStorage.getItem('chain-decode-model') || localStorage.getItem('translate-model') || ''
         };
     }
 
     buildTransformsFromWindow() {
         if (typeof window !== 'undefined' && typeof window.syncCustomSpellingAlphabets === 'function') {
             window.syncCustomSpellingAlphabets();
         }
 
@@ -364,17 +365,22 @@ class TransformTool extends Tool {
                 this.chainOpenNodeOptionsIndex = null;
                 this.chainBuilderError = '';
                 this.chainBuilderOpen = true;
             },
             chainAddNode: function(key) {
                 const t = window.transforms[key];
                 if (!t) return;
                 const options = {};
-                (t.configurableOptions || []).forEach(opt => { options[opt.id] = opt.default; });
+                const prefs = typeof this.getMergedOptionsForTransform === 'function'
+                    ? this.getMergedOptionsForTransform(t.name)
+                    : {};
+                (t.configurableOptions || []).forEach(opt => {
+                    options[opt.id] = (prefs && prefs[opt.id] != null) ? prefs[opt.id] : opt.default;
+                });
                 this.chainDraftNodes.push({ transform: key, options });
                 this.chainNodePickerQuery = '';
             },
             chainRemoveNode: function(index) {
                 this.chainDraftNodes.splice(index, 1);
                 if (this.chainOpenNodeOptionsIndex === index) {
                     this.chainOpenNodeOptionsIndex = null;
                 }
@@ -528,16 +534,90 @@ class TransformTool extends Tool {
                         'fas fa-exclamation-triangle'
                     );
                     return;
                 }
                 this.refreshChainsTransforms();
                 this.pruneFavoritesForMissingTransforms();
                 this.showNotification('Cycle deleted', 'success', 'fas fa-trash');
             },
+            chainCopyRecipe: function(entity, kind) {
+                const recipe = window.TransformChains.describeRecipe(entity, kind);
+                this.copyToClipboard(recipe);
+                this.showNotification('Recipe copied', 'success', 'fas fa-copy');
+            },
+            chainExportAll: function() {
+                const payload = {
+                    version: 1,
+                    chains: window.TransformChains.loadChains(),
+                    cycles: window.TransformChains.loadCycles()
+                };
+                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
+                const url = URL.createObjectURL(blob);
+                const a = document.createElement('a');
+                a.href = url;
+                a.download = 'p4rs3ltongv3-chains.json';
+                a.click();
+                URL.revokeObjectURL(url);
+            },
+            chainImportAll: function(file) {
+                const reader = new FileReader();
+                const self = this;
+                reader.onload = function() {
+                    try {
+                        const data = JSON.parse(reader.result);
+                        let importedCount = 0;
+                        let failedCount = 0;
+                        const mutationErrors = [];
+                        const recordSaveResult = function(result) {
+                            if (result) {
+                                importedCount += 1;
+                                return;
+                            }
+                            failedCount += 1;
+                            if (typeof window.TransformChains.getLastMutationError === 'function') {
+                                const mutationError = window.TransformChains.getLastMutationError();
+                                if (mutationError && mutationErrors.indexOf(mutationError) === -1) {
+                                    mutationErrors.push(mutationError);
+                                }
+                            }
+                        };
+                        (data.chains || []).forEach(function(c) {
+                            const result = window.TransformChains.saveChain({
+                                id: c.id,
+                                name: c.name,
+                                nodes: c.nodes
+                            });
+                            recordSaveResult(result);
+                        });
+                        (data.cycles || []).forEach(function(cy) {
+                            const result = window.TransformChains.saveCycle({
+                                id: cy.id,
+                                name: cy.name,
+                                chainIds: cy.chainIds
+                            });
+                            recordSaveResult(result);
+                        });
+                        self.refreshChainsTransforms();
+                        if (failedCount) {
+                            let message = 'Import incomplete: ' + importedCount + ' imported, ' +
+                                failedCount + ' failed';
+                            if (mutationErrors.length) {
+                                message += '. ' + mutationErrors.join('; ');
+                            }
+                            self.showNotification(message, 'error', 'fas fa-exclamation-triangle');
+                            return;
+                        }
+                        self.showNotification('Chains imported', 'success', 'fas fa-file-import');
+                    } catch (e) {
+                        self.showNotification('Import failed: ' + (e.message || 'invalid file'), 'error');
+                    }
+                };
+                reader.readAsText(file);
+            },
 
             // -- AI-assisted decode for chains/cycles that can't mechanically reverse --
 
             chainDecodeKey: function(kind, id) {
                 return kind + ':' + id;
             },
             chainToggleDecode: function(kind, id) {
                 const key = this.chainDecodeKey(kind, id);
@@ -550,18 +630,21 @@ class TransformTool extends Tool {
                 if (!window.TransformChains) return;
                 this.chainDecodeError = '';
                 this.chainDecodeOutput = '';
                 if (!(this.chainDecodeInput || '').trim()) {
                     this.chainDecodeError = 'Paste the transformed text first.';
                     return;
                 }
                 const recipe = window.TransformChains.describeRecipe(entity, kind);
+                if (this.chainDecodeModel) {
+                    localStorage.setItem('chain-decode-model', this.chainDecodeModel);
+                }
                 this.chainDecodeLoading = true;
-                window.TransformChains.aiDecode(recipe, this.chainDecodeInput)
+                window.TransformChains.aiDecode(recipe, this.chainDecodeInput, { model: this.chainDecodeModel })
                     .then(text => { this.chainDecodeOutput = text; })
                     .catch(e => { this.chainDecodeError = e.message || 'Decode failed.'; })
                     .finally(() => { this.chainDecodeLoading = false; });
             },
             transformInputControlKind: function() {
                 if (!this.activeTransform || this.activeTransform.inputKind !== 'text') {
                     return 'textarea';
                 }
diff --git a/templates/transforms.html b/templates/transforms.html
index 89917c1..1ba47b1 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -120,30 +120,46 @@
                             <div v-if="chainManageOpen" class="chain-manager-body">
                                 <div class="chain-manager-actions">
                                     <button type="button" class="btn btn-secondary" @click="openChainBuilder(null)">
                                         <i class="fas fa-plus"></i> New chain
                                     </button>
                                     <button type="button" class="btn btn-secondary" @click="openCycleBuilder(null)" :disabled="!savedChains().length">
                                         <i class="fas fa-plus"></i> New per-word cycle
                                     </button>
+                                    <button type="button" class="btn btn-secondary" @click="chainExportAll">
+                                        <i class="fas fa-file-export"></i> Export
+                                    </button>
+                                    <button type="button" class="btn btn-secondary" @click="$refs.chainImportFile.click()">
+                                        <i class="fas fa-file-import"></i> Import
+                                    </button>
+                                    <input
+                                        ref="chainImportFile"
+                                        type="file"
+                                        accept="application/json,.json"
+                                        hidden
+                                        @change="chainImportAll($event.target.files[0]); $event.target.value = ''"
+                                    >
                                     <small v-if="!savedChains().length" class="chain-manager-hint">Create a chain first ΓÇö cycles rotate through saved chains.</small>
                                 </div>
 
                                 <div v-if="savedChains().length" class="chain-list">
                                     <h5>Chains</h5>
                                     <div v-for="chain in savedChains()" :key="chain.id" class="chain-list-item">
                                         <div class="chain-list-item-main">
                                             <strong>{{ chain.name }}</strong>
                                             <span class="chain-badge" :class="chainIsReversibleNow(chain) ? 'chain-badge-reversible' : 'chain-badge-ai-only'">
                                                 {{ chainIsReversibleNow(chain) ? 'Reversible' : 'AI-decode only' }}
                                             </span>
                                             <small>{{ chainRegisteredEntry(chain) ? chainRegisteredEntry(chain).description : '' }}</small>
                                         </div>
                                         <div class="chain-list-item-actions">
+                                            <button type="button" class="chain-action-btn" @click="chainCopyRecipe(chain, 'chain')" title="Copy recipe">
+                                                <i class="fas fa-copy"></i>
+                                            </button>
                                             <button type="button" class="chain-action-btn" @click="openChainBuilder(chain)" title="Edit">
                                                 <i class="fas fa-pen"></i>
                                             </button>
                                             <button
                                                 v-if="!chainIsReversibleNow(chain)"
                                                 type="button"
                                                 class="chain-action-btn"
                                                 @click="chainToggleDecode('chain', chain.id)"
@@ -152,16 +168,17 @@
                                                 <i class="fas fa-wand-magic-sparkles"></i>
                                             </button>
                                             <button type="button" class="chain-action-btn chain-action-btn-danger" @click="deleteSavedChain(chain)" title="Delete">
                                                 <i class="fas fa-trash"></i>
                                             </button>
                                         </div>
                                         <div v-if="chainDecodeOpenKey === chainDecodeKey('chain', chain.id)" class="chain-decode-box">
                                             <textarea v-model="chainDecodeInput" placeholder="Paste the transformed text to decode..."></textarea>
+                                            <openrouter-model-select v-model="chainDecodeModel" label="Decode model"></openrouter-model-select>
                                             <button type="button" class="btn btn-secondary" :disabled="chainDecodeLoading" @click="chainRunAiDecode(chain, 'chain')">
                                                 {{ chainDecodeLoading ? 'DecodingΓÇª' : 'Decode with AI' }}
                                             </button>
                                             <p v-if="chainDecodeError" class="chain-decode-error">{{ chainDecodeError }}</p>
                                             <textarea v-if="chainDecodeOutput" readonly :value="chainDecodeOutput" class="chain-decode-output"></textarea>
                                         </div>
                                     </div>
                                 </div>
@@ -172,16 +189,19 @@
                                         <div class="chain-list-item-main">
                                             <strong>{{ cycle.name }}</strong>
                                             <span class="chain-badge" :class="cycleIsReversibleNow(cycle) ? 'chain-badge-reversible' : 'chain-badge-ai-only'">
                                                 {{ cycleIsReversibleNow(cycle) ? 'Reversible' : 'AI-decode only' }}
                                             </span>
                                             <small>{{ cycleRegisteredEntry(cycle) ? cycleRegisteredEntry(cycle).description : '' }}</small>
                                         </div>
                                         <div class="chain-list-item-actions">
+                                            <button type="button" class="chain-action-btn" @click="chainCopyRecipe(cycle, 'cycle')" title="Copy recipe">
+                                                <i class="fas fa-copy"></i>
+                                            </button>
                                             <button type="button" class="chain-action-btn" @click="openCycleBuilder(cycle)" title="Edit">
                                                 <i class="fas fa-pen"></i>
                                             </button>
                                             <button
                                                 v-if="!cycleIsReversibleNow(cycle)"
                                                 type="button"
                                                 class="chain-action-btn"
                                                 @click="chainToggleDecode('cycle', cycle.id)"
@@ -190,16 +210,17 @@
                                                 <i class="fas fa-wand-magic-sparkles"></i>
                                             </button>
                                             <button type="button" class="chain-action-btn chain-action-btn-danger" @click="deleteSavedCycle(cycle)" title="Delete">
                                                 <i class="fas fa-trash"></i>
                                             </button>
                                         </div>
                                         <div v-if="chainDecodeOpenKey === chainDecodeKey('cycle', cycle.id)" class="chain-decode-box">
                                             <textarea v-model="chainDecodeInput" placeholder="Paste the transformed text to decode..."></textarea>
+                                            <openrouter-model-select v-model="chainDecodeModel" label="Decode model"></openrouter-model-select>
                                             <button type="button" class="btn btn-secondary" :disabled="chainDecodeLoading" @click="chainRunAiDecode(cycle, 'cycle')">
                                                 {{ chainDecodeLoading ? 'DecodingΓÇª' : 'Decode with AI' }}
                                             </button>
                                             <p v-if="chainDecodeError" class="chain-decode-error">{{ chainDecodeError }}</p>
                                             <textarea v-if="chainDecodeOutput" readonly :value="chainDecodeOutput" class="chain-decode-output"></textarea>
                                         </div>
                                     </div>
                                 </div>

```