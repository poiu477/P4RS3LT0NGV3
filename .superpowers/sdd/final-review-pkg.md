# Final Review Package — transform-chains-completion
Plan start (SDD Task 1 base): 6a047a675c4740aa38ba7e6942e17e817ddd5c14
Merge-base with main: a6cb7c9054800e106b63888d362601922477a614
Head: bf390d179951adb2e6b379a66039cd7a29c4d3e7

## Commits (plan range)
bf390d1 docs: document transform chains and cycles
bb04cee test: assert raw localStorage unchanged on chain rejection
f37aefb test: strengthen TransformChains assertions for persistence and rollback
5d157c7 test: add TransformChains unit coverage
c83c383 fix: report chain import save failures instead of false success
d63dfdf feat: chain decode model, prefs-seeded nodes, export/import and copy recipe
2617ff1 fix: exclude saved chains/cycles from blind decoder auto-guess
8538f71 fix: drop orphan transform favorites after list refresh
a287921 fix: use null-prototype map in validateCycleForSave
f28b6ec feat: validate cycles before save
a845920 fix: surface chain/cycle storage and validation failures in UI
862fdad fix: rematch activeTransform after transform list refresh


## Stat
 CONTRIBUTING.md                |   2 +
 README.md                      |   9 +++
 docs/TOOL_ARCHITECTURE.md      |   9 +++
 js/core/decoder.js             |   6 ++
 js/core/transformChains.js     |  65 +++++++++++++++--
 js/tools/TransformTool.js      | 153 +++++++++++++++++++++++++++++++++++++++--
 package.json                   |   3 +-
 templates/transforms.html      |  21 ++++++
 tests/test_transform_chains.js | 143 ++++++++++++++++++++++++++++++++++++++
 9 files changed, 398 insertions(+), 13 deletions(-)


## Diff
```diff
diff --git a/CONTRIBUTING.md b/CONTRIBUTING.md
index b6cd8a1..a473165 100644
--- a/CONTRIBUTING.md
+++ b/CONTRIBUTING.md
@@ -21,10 +21,11 @@ P4RS3LT0NGV3/
 Γöé   Γöé   ΓööΓöÇΓöÇ constants.js
 Γöé   Γö£ΓöÇΓöÇ core/                    # Shared logic (not tab-specific UI)
 Γöé   Γöé   Γö£ΓöÇΓöÇ decoder.js         # Universal decode engine
 Γöé   Γöé   Γö£ΓöÇΓöÇ steganography.js   # Emoji / invisible carriers
 Γöé   Γöé   Γö£ΓöÇΓöÇ toolRegistry.js    # Registers tools, merges Vue data/methods
+Γöé   Γöé   Γö£ΓöÇΓöÇ transformChains.js # Saved transform chains & per-word cycles
 Γöé   Γöé   ΓööΓöÇΓöÇ transformOptions.js
 Γöé   Γö£ΓöÇΓöÇ data/                    # Static data shipped with the app (see note below)
 Γöé   Γöé   Γö£ΓöÇΓöÇ anticlassifierPrompt.js
 Γöé   Γöé   Γö£ΓöÇΓöÇ emojiCompatibility.js
 Γöé   Γöé   Γö£ΓöÇΓöÇ endSequences.js
@@ -119,10 +120,11 @@ dist/   # npm run build ΓÇö gitignored
 
 ### Core vs Tools
 
 - **`js/core/`** ΓÇö Shared business logic and infrastructure (not tab-specific)
   - Examples: `decoder.js` (DecodeTool, decoder pipeline), `steganography.js` (EmojiTool, steg engine), `toolRegistry.js` (registers tools, merges Vue surface), `transformOptions.js` (shared transform UI helpers)
+  - Transform chains and cycles are core logic in `transformChains.js`, registered into `window.transforms`; their UI lives on `TransformTool`.
 - **`js/utils/`** ΓÇö Cross-cutting helpers (`clipboard`, `EmojiUtils` in `emoji.js`, notifications, `theme.js`, `openrouterModels.js`, etc.)
 - **`js/data/`** ΓÇö Committed static payloads (models, prompts, glitch token data, end sequences, `emojiCompatibility.js`). **`emojiData.js`** is **not** edited here ΓÇö it is **generated** to `dist/js/data/emojiData.js` by `npm run build:emoji`.
 - **`src/`** ΓÇö `emojiWordMap.js` feeds the emoji build; `transformers/` holds transformer modules
 - **Generated bundle** ΓÇö `npm run build:transforms` writes `dist/js/bundles/transforms-bundle.js` (a legacy `js/bundles/transforms-bundle.js` path may exist for older workflows and is gitignored)
 - **`js/tools/`** ΓÇö Vue integration: one `*Tool.js` per tab (plus `TranslateTool.js`, which is hidden and wired from the Transform tab)
diff --git a/README.md b/README.md
index d1044a7..6307c1e 100644
--- a/README.md
+++ b/README.md
@@ -266,10 +266,19 @@ Tabs appear in **UI order** below. AI-backed tools use whichever **AI provider**
 - **Categories**: Grouped sections you can **reorder**; quick-jump legend; **randomizer** last.
 - **Favorites & last used**: Pin transforms and recall recent picks.
 - **Per-transform options**: Gear icon where a transform exposes settings.
 - **Keyboard shortcut**: **T** (shown in the tab title).
 
+### Chains & Cycles (on the Transform tab)
+
+- **Chain** ΓÇö an ordered pipeline of transforms applied to the whole input; each node snapshots its own options (e.g. Caesar shift 3 then shift 7).
+- **Cycle** ΓÇö rotate a list of chains across words (word 1 ΓåÆ chain A, word 2 ΓåÆ chain B, wrap).
+- Saved entities appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply).
+- Nested chains/cycles are not allowed.
+- If a recipe cannot mechanically reverse, use **AI decode** in the Chains manager (uses your configured AI providers).
+- Export/import JSON from the Chains manager; copy the human-readable recipe for sharing.
+
 ### ≡ƒîÉ **AI Translation** (AI-powered)
 
 *Lives on the **Transform** tab ΓÇö not a separate tab.*
 
 - **20+ Languages**: Major world languages (Spanish, French, Chinese, Japanese, Korean, etc.)
diff --git a/docs/TOOL_ARCHITECTURE.md b/docs/TOOL_ARCHITECTURE.md
index 6bb5c35..bdce527 100644
--- a/docs/TOOL_ARCHITECTURE.md
+++ b/docs/TOOL_ARCHITECTURE.md
@@ -77,10 +77,19 @@ Example: Transform Tool, Decoder Tool, Emoji Tool
 - Γ£à Tokenizer Tool - Dynamic token display
 
 ### Tools with Dynamic Content
 - Γ£à Splitter Tool - Self-contained in SplitterTool.js
 
+## Transform chains & cycles
+
+- Module: `js/core/transformChains.js` (`window.TransformChains`)
+- Storage: `localStorage` keys `transform-chains-v1`, `transform-cycles-v1`
+- Registration: `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`
+- No nesting of saved chains/cycles inside chain nodes
+- Mechanical reverse when every node (and cycle probe) allows it; otherwise AI recipe decode via `aiDecode`
+- UI: Transform tab Chains manager (`templates/transforms.html`, methods on `TransformTool`)
+
 ## Adding a New Tool
 
 ### Step 1: Create Tool Class
 
 ```javascript
diff --git a/js/core/decoder.js b/js/core/decoder.js
index 937e844..eac703e 100644
--- a/js/core/decoder.js
+++ b/js/core/decoder.js
@@ -13,10 +13,13 @@ function universalDecode(input, context = {}) {
         }
     }
     
     let foundHighPriorityMatch = false;
     for (const [transformKey, transform] of Object.entries(window.transforms)) {
+        if (transform.isChain || transform.isCycle || transform.category === 'chains') {
+            continue; // only via explicit user selection / AI recipe decode
+        }
         if (transform.detector && transform.reverse) {
             try {
                 if (transform.detector(input)) {
                     const opts = window.getMergedTransformOptions
                         ? window.getMergedTransformOptions(transform)
@@ -72,10 +75,13 @@ function universalDecode(input, context = {}) {
         }
     }
     
     for (const name in window.transforms) {
         const transform = window.transforms[name];
+        if (transform.isChain || transform.isCycle || transform.category === 'chains') {
+            continue; // only via explicit user selection / AI recipe decode
+        }
         if (transform.reverse && !transform.detector) {
             try {
                 const opts = window.getMergedTransformOptions ? window.getMergedTransformOptions(transform) : {};
                 const result = transform.reverse(input, opts);
                 if (result !== input && /[a-zA-Z0-9\s]{3,}/.test(result)) {
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index abb916d..cb4cd22 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -27,10 +27,11 @@
     var CHAIN_STORAGE_KEY = 'transform-chains-v1';
     var CYCLE_STORAGE_KEY = 'transform-cycles-v1';
     var CHAIN_PREFIX = 'chain_';
     var CYCLE_PREFIX = 'cycle_';
     var CATEGORY = 'chains';
+    var lastMutationError = '';
 
     // ---- storage ----------------------------------------------------------
 
     function isRecord(value) {
         return !!value && typeof value === 'object' && !Array.isArray(value);
@@ -151,10 +152,34 @@
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
 
@@ -295,11 +320,11 @@
         var reversible = chainIsReversible(chain);
         global.transforms[CHAIN_PREFIX + chain.id] = {
             name: chain.name,
             category: CATEGORY,
             description: 'Chain: ' + describeChain(chain),
-            priority: 0, // never auto-guessed by the decoder; user picks it explicitly
+            priority: 0, // excluded from blind auto-guess; still reversible when selected
             canDecode: reversible,
             isChain: true,
             chainId: chain.id,
             func: function(text) { return runChainNodes(chain.nodes, text); },
             preview: function(text) { return runChainNodes(chain.nodes, text); },
@@ -359,14 +384,19 @@
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
@@ -380,12 +410,16 @@
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
@@ -395,21 +429,33 @@
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
@@ -420,19 +466,27 @@
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
 
@@ -536,10 +590,11 @@
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
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index 4b9e6f6..e982b5a 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -72,11 +72,12 @@ class TransformTool extends Tool {
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
@@ -367,11 +368,16 @@ class TransformTool extends Tool {
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
@@ -424,11 +430,12 @@ class TransformTool extends Tool {
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
@@ -487,11 +494,12 @@ class TransformTool extends Tool {
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
@@ -501,20 +509,112 @@ class TransformTool extends Tool {
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
+                this.pruneFavoritesForMissingTransforms();
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
+                this.pruneFavoritesForMissingTransforms();
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
@@ -533,12 +633,15 @@ class TransformTool extends Tool {
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
@@ -949,10 +1052,26 @@ class TransformTool extends Tool {
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
@@ -1011,10 +1130,14 @@ class TransformTool extends Tool {
 
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
 
@@ -1022,10 +1145,26 @@ class TransformTool extends Tool {
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
+                this.pruneFavoritesForMissingTransforms();
             },
         };
     }
     
     getVueWatchers() {
diff --git a/package.json b/package.json
index 35fe727..bb6c180 100644
--- a/package.json
+++ b/package.json
@@ -17,11 +17,12 @@
     "test": "node tests/test_universal.js",
     "test:lexeme": "node tests/test_lexeme_analysis.js",
     "test:lexeme-ui": "node tests/test_lexeme_ui_surface.js",
     "test:universal": "node tests/test_universal.js",
     "test:steg": "node tests/test_steganography_options.js",
-    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui",
+    "test:chains": "node tests/test_transform_chains.js",
+    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains",
     "precommit": "npm run test:all"
   },
   "repository": {
     "type": "git",
     "url": "."
diff --git a/templates/transforms.html b/templates/transforms.html
index 89917c1..1ba47b1 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -123,10 +123,23 @@
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
@@ -137,10 +150,13 @@
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
@@ -155,10 +171,11 @@
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
@@ -175,10 +192,13 @@
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
@@ -193,10 +213,11 @@
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
diff --git a/tests/test_transform_chains.js b/tests/test_transform_chains.js
new file mode 100644
index 0000000..7b4f1c0
--- /dev/null
+++ b/tests/test_transform_chains.js
@@ -0,0 +1,143 @@
+#!/usr/bin/env node
+const assert = require('assert');
+const path = require('path');
+const fs = require('fs');
+const vm = require('vm');
+
+function createContext() {
+    const store = Object.create(null);
+    const ctx = {
+        window: null,
+        console,
+        localStorage: {
+            getItem: (k) => (k in store ? store[k] : null),
+            setItem: (k, v) => { store[k] = String(v); },
+            _store: store
+        }
+    };
+    ctx.window = ctx;
+    return ctx;
+}
+
+function load(ctx, rel) {
+    const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
+    vm.runInContext(code, ctx, { filename: rel });
+}
+
+const ctx = createContext();
+vm.createContext(ctx);
+ctx.transforms = {
+    base64: {
+        name: 'Base64',
+        category: 'encoding',
+        func: (t) => Buffer.from(t, 'utf8').toString('base64'),
+        reverse: (t) => Buffer.from(t, 'base64').toString('utf8'),
+        canDecode: true
+    },
+    caesar: {
+        name: 'Caesar Cipher',
+        category: 'cipher',
+        configurableOptions: [{ id: 'shift', default: 3 }],
+        func: (t, o) => t,
+        reverse: (t, o) => t,
+        canDecode: true
+    }
+};
+load(ctx, 'js/core/transformChains.js');
+const TC = ctx.TransformChains;
+assert.ok(TC, 'TransformChains global');
+
+// sanitize / null filtering via save+load
+const id = TC.saveChain({
+    name: 'Demo',
+    nodes: [
+        { transform: 'caesar', options: { shift: 3 } },
+        { transform: 'base64', options: {} }
+    ]
+});
+assert.ok(id);
+const storedChains = JSON.parse(ctx.localStorage._store['transform-chains-v1']);
+storedChains[0].nodes.splice(1, 0, null);
+ctx.localStorage._store['transform-chains-v1'] = JSON.stringify(storedChains);
+const chains = TC.loadChains();
+assert.strictEqual(chains.length, 1);
+assert.strictEqual(chains[0].nodes.length, 2);
+assert.deepStrictEqual(
+    Array.from(chains[0].nodes, (node) => node.transform),
+    ['caesar', 'base64']
+);
+assert.strictEqual(chains[0].nodes[0].options.shift, 3);
+assert.deepStrictEqual(Object.keys(chains[0].nodes[1].options), []);
+
+// nesting reject
+TC.syncTransforms();
+const beforeNestedChains = JSON.stringify(TC.loadChains());
+const beforeNestedChainStorage = ctx.localStorage.getItem('transform-chains-v1');
+const nested = TC.saveChain({
+    name: 'Bad',
+    nodes: [{ transform: 'chain_' + id, options: {} }]
+});
+assert.strictEqual(nested, null);
+assert.strictEqual(
+    ctx.localStorage.getItem('transform-chains-v1'),
+    beforeNestedChainStorage
+);
+assert.strictEqual(JSON.stringify(TC.loadChains()), beforeNestedChains);
+
+// describe includes options
+const recipe = TC.describeChain(chains[0]);
+assert.ok(recipe.indexOf('caesar') !== -1);
+assert.ok(recipe.indexOf('"shift":3') !== -1 || recipe.indexOf('"shift": 3') !== -1);
+
+// cycle validation
+const beforeEmptyCycle = JSON.stringify(TC.loadCycles());
+const beforeEmptyCycleStorage = ctx.localStorage.getItem('transform-cycles-v1');
+assert.strictEqual(TC.saveCycle({ name: 'C', chainIds: [] }), null);
+assert.strictEqual(
+    ctx.localStorage.getItem('transform-cycles-v1'),
+    beforeEmptyCycleStorage
+);
+assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeEmptyCycle);
+const cyId = TC.saveCycle({ name: 'C', chainIds: [id] });
+assert.ok(cyId);
+const cycles = TC.loadCycles();
+assert.strictEqual(cycles.length, 1);
+assert.strictEqual(cycles[0].id, cyId);
+assert.strictEqual(cycles[0].name, 'C');
+assert.deepStrictEqual(Array.from(cycles[0].chainIds), [id]);
+
+// write failure rollback on deleteChain
+const beforeChains = JSON.stringify(TC.loadChains());
+const beforeCycles = JSON.stringify(TC.loadCycles());
+let calls = 0;
+let failureFired = false;
+const writeKeys = [];
+const realSet = ctx.localStorage.setItem.bind(ctx.localStorage);
+ctx.localStorage.setItem = (k, v) => {
+    calls += 1;
+    writeKeys.push(k);
+    if (calls === 2) {
+        failureFired = true;
+        throw new Error('fail cycle write');
+    }
+    return realSet(k, v);
+};
+const deleted = TC.deleteChain(id);
+assert.strictEqual(deleted, false);
+ctx.localStorage.setItem = realSet;
+assert.strictEqual(failureFired, true);
+assert.strictEqual(calls, 3);
+assert.deepStrictEqual(writeKeys, [
+    'transform-chains-v1',
+    'transform-cycles-v1',
+    'transform-chains-v1'
+]);
+const storageKeys = Object.keys(ctx.localStorage._store).sort();
+assert.deepStrictEqual(storageKeys, ['transform-chains-v1', 'transform-cycles-v1']);
+assert.strictEqual(storageKeys.length, 2);
+assert.strictEqual(ctx.localStorage._store['transform-chains-v1'], beforeChains);
+assert.strictEqual(ctx.localStorage._store['transform-cycles-v1'], beforeCycles);
+assert.strictEqual(JSON.stringify(TC.loadChains()), beforeChains);
+assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeCycles);
+
+console.log('test_transform_chains: OK');

```