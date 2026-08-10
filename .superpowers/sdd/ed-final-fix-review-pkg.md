# Review package: fa59b7a9a65259518dca407dd3941a466c019807..HEAD

## Commits
31044e5 fix: gate AI decode behind explicit apply, fix recipe decode metadata, fix translate/carrier reversibility

## Files changed
 .superpowers/sdd/ed-task-4-report.md | 119 +++++++++++++++++++++++++++++++++++
 README.md                            |   2 +-
 js/core/transformChains.js           |  46 +++++++++++++-
 js/tools/TransformTool.js            |  16 ++++-
 tests/test_transform_apply_mode.js   |  94 +++++++++++++++++++++++++++
 tests/test_transform_recipes.js      |  64 +++++++++++++++++++
 6 files changed, 338 insertions(+), 3 deletions(-)

## Diff
diff --git a/.superpowers/sdd/ed-task-4-report.md b/.superpowers/sdd/ed-task-4-report.md
new file mode 100644
index 0000000..43cbdeb
--- /dev/null
+++ b/.superpowers/sdd/ed-task-4-report.md
@@ -0,0 +1,119 @@
+# Task 4 Report: Apply path — encode / reverse / AI decode + clipboard
+
+## Summary
+
+Implemented the shared apply path per brief, rewriting `applyActiveTransformOutput` and `applyTransform` in `js/tools/TransformTool.js`, and demoting the manager Apply button in `templates/transforms.html`.
+
+## Changes
+
+### `js/tools/TransformTool.js`
+
+- Added `transformOutputImage: ''` to tool state (alongside existing `transformOutput`/`transformOutputKind`).
+- Rewrote `applyActiveTransformOutput(options)`:
+  - Resolves `action` via `TransformApplyMode.resolveAction(transform, this.transformIoMode)` → `'encode' | 'reverse' | 'ai_decode'`.
+  - `ai_decode`: guards on `AIProvider.getConfiguredProviders().length`, throws a Settings-toast-worthy error if missing; otherwise calls `TransformChains.aiDecode(describeForAiDecode(...), input, { model })`.
+  - `reverse`: calls `transform.reverse(input, opts)`, throws if absent.
+  - Falls through to existing staged-async / emoji-preserving / plain `transform.func` paths for `encode`.
+  - Splits result into `transformOutputImage` (image `value`) vs `transformOutput` (text `value`, or `text` field for image results e.g. QR's underlying payload).
+  - `copyOnSuccess` option now triggers `forceCopyToClipboard`/`isTransformCopy` here (moved out of `applyTransform`), only when explicitly requested and `transformOutput` is non-empty.
+  - Stale-generation/error handling preserved; errors clear both output fields and toast the error message (AI-missing message surfaces verbatim).
+- `applyTransform`: now calls `applyActiveTransformOutput({ copyOnSuccess: true })`, removed the now-redundant clipboard block, success toast wording reflects mode (`decoded and copied!` vs `applied and copied!`) and still special-cases image-only (no text) previews and Random Mix.
+- `autoTransform` unchanged (`{ preserveEmojis: true }`, no `copyOnSuccess`) — confirmed it already omits clipboard, satisfying "no history flood" while typing.
+- All other call sites (`commitTransformOptions`, `refreshCustomSpellingTransforms`, `transformInput` watcher) call the shared method without `copyOnSuccess` — unchanged behavior, now also clear `transformOutputImage` where output is cleared.
+- Removed dead `applySavedChain` (only consumer was the deleted Apply button); updated leftover "use Apply on the list" notification copy after recipe save.
+
+### `templates/transforms.html`
+
+- Manager recipe list: removed the primary "Apply" button entirely (chains now run only via clicking the registered transform button, same path as every other method); updated the now-stale hint text.
+- Output section: `v-if` now shows on `transformOutput || transformOutputImage`; image `<img>` binds to `transformOutputImage`; added a `<p>` fallback to surface the underlying `transformOutput` text for image results (e.g. QR's pre-carrier payload) with its own copy button (copy button now shows whenever `transformOutput` is non-empty, regardless of kind).
+
+### `css/style.css`
+
+- Added `.transform-image-output-text` (small monospace, wrapping) for the new underlying-text paragraph under image output.
+
+## Verification
+
+- `npm run test:apply-mode`, `test:chains`, `test:recipes` — pass individually.
+- `npm run build:templates` — succeeds, no HTML/Vue errors.
+- `npm run test:all` — exit 0 (universal, steg, lexeme, lexeme-ui, chains, recipes, apply-mode all OK).
+- `ReadLints` on all three changed files — no errors.
+- Manual checklist from brief not run in a browser (no headless UI harness in this pass); logic was traced end-to-end against `TransformApplyMode.resolveAction`, `TransformChains.aiDecode`, `AIProvider.getConfiguredProviders`, and `caesar.reverse(text, options)` signatures to confirm wiring is correct (Caesar reverse takes `(text, options)`, chain/cycle reverse take `(text)` only — both compatible with `transform.reverse(input, opts)` call since JS ignores extra args).
+
+## Concerns / follow-ups
+
+- No automated UI test covers the 5-point manual checklist (encode/decode/AI-decode/AI-missing/live-typing) — recommend a quick manual pass or a future browser-based test.
+- Pre-existing minor quirk (not introduced by this task): the `transformInput` Vue watcher and the `@input="autoTransform"` handler on the textarea can both fire on the same keystroke, causing two generation-bumped calls; harmless (later one wins) but worth a look in a future cleanup, out of scope here.
+
+## Files changed
+
+- `js/tools/TransformTool.js`
+- `templates/transforms.html`
+- `css/style.css`
+
+## Commit
+
+`374e017` — feat: apply transforms in Encode/Decode mode with shared output path
+
+---
+
+## Final-review fixes
+
+Addresses the Critical/Important findings from the final whole-branch review (`ed-final-review.md`).
+
+### Critical 1 — AI decode fired from live typing / watchers / tab refresh
+
+`js/tools/TransformTool.js` — `applyActiveTransformOutput(options)`:
+
+- Added `allowAiDecode = !!(options && (options.allowAiDecode || options.copyOnSuccess))`.
+- Right after `action` is resolved and before the `try` block: `if (action === 'ai_decode' && !allowAiDecode) return { applied: false };` — no AI call, no error toast, existing output left untouched.
+- `applyTransform` now passes `{ copyOnSuccess: true, allowAiDecode: true }` (explicit click, and the mode-flip re-apply in `setTransformIoMode` which calls `applyTransform`). The other four call sites (`autoTransform` `@input`, the `transformInput` watcher, `commitTransformOptions` options-save, `refreshCustomSpellingTransforms` tab-refresh) pass no flag, so `ai_decode` now short-circuits for all of them.
+
+### Critical 2 — recipe/cycle AI decode prompt degraded to the display name
+
+`js/tools/TransformTool.js` — `buildTransformsFromWindow()` mapping now also copies `isChain: !!transform.isChain`, `isCycle: !!transform.isCycle`, `cycleId: transform.cycleId || null`, `description: transform.description || ''`, `canDecode: transform.canDecode !== false` onto the Vue-facing transform object (this also fixes Important #I2 from the review — `canDecode` was previously dropped, making `resolveAction`'s guard dead). `describeForAiDecode` in `js/core/transformApplyMode.js` was already correct; the bug was entirely in the mapping.
+
+`tests/test_transform_apply_mode.js` — added:
+- A stub-`chainsApi` test proving `describeForAiDecode` calls `describeRecipe` (not the name fallback) when `isChain`/`chainId` or `isCycle`/`cycleId` are present, and a companion assertion that the pre-fix shape (`chainId` without `isChain`) falls back to the bare name — pins the exact regression.
+- A full integration test loading the real `transformRecipeStages.js` + `transformChains.js` + `transformApplyMode.js` in one `vm` context: saves a staged recipe with a translate stage, calls `describeForAiDecode({ isChain: true, chainId })`, and asserts the result contains `Caesar` and `Latin` (not just the recipe's name) — also exercises the Important fix below. Same pattern for a cycle.
+
+### Important — `chainIsReversible` / `describeChain` ignored Translate & Carrier stages
+
+`js/core/transformChains.js`:
+
+- Added `stagedChainHasOneWayStage(chain)` — true when `chain.kind === 'staged'` and `stages.translate` or `stages.carrier` is set.
+- `chainIsReversible` now returns `false` immediately when `stagedChainHasOneWayStage(chain)` is true, before falling through to the existing node-by-node check. This also makes `registerChain`'s `canDecode`/`reverse` correct (both flow from `chainIsReversible`), so `resolveAction` now routes Translate/Carrier recipes to `ai_decode` instead of a silently-wrong mechanical `reverse`.
+- Added `describeStagedNode(node)` to describe non-transform staged nodes (`translate` → `"Translate to <language> [translate]"`, `qr` → `"QR code carrier [qr]"`, `emoji_stego` → `"Emoji steganography carrier [emoji_stego]"`).
+- `describeChain` now walks the full `getStagedNodes(chain)` list (not the transform-only `getRunnableChainNodes`) for staged recipes, using `describeStagedNode`, so the AI decode hint built by `describeRecipe`/`buildDecodePrompt` includes every stage.
+
+`tests/test_transform_recipes.js` — added:
+- Baseline: a plain cipher+encoding staged recipe (with real `reverse` functions added to the `caesar`/`base64` stubs) still reports `chainIsReversible === true`.
+- A staged recipe with a `translate` stage: `chainIsReversible === false`, the registered `chain_<id>.canDecode === false` and `.reverse === null`, and `describeChain` output matches `/Translate/` and `/Latin/i` while still including the transform-backed `Theban` stage.
+- A staged recipe with a `qr` carrier stage: `chainIsReversible === false`, `.reverse === null`, and `describeChain` output matches `/QR/` and still includes `Caesar`.
+
+### Optional docs
+
+`README.md:281` reworded — presents clicking the tile in Decode mode as the primary AI-decode path and the manager panel as the secondary/testing tool, replacing the stale "use AI decode in the manager" phrasing.
+
+### Verification
+
+```
+node tests/test_transform_apply_mode.js   # OK
+node tests/test_transform_recipes.js      # OK
+npm run test:all                          # exit 0 — all 7 suites (universal, steg, lexeme,
+                                           # lexeme-ui, chains, recipes, apply-mode) OK
+```
+
+`ReadLints` on all four edited source/test files — no errors.
+
+### Files changed
+
+- `js/tools/TransformTool.js`
+- `js/core/transformChains.js`
+- `tests/test_transform_apply_mode.js`
+- `tests/test_transform_recipes.js`
+- `README.md`
+
+### Concerns / remaining
+
+- Important #I3 (interactive browser smoke test for the DOM restructure) is out of scope for this pass — no automated UI harness exists in this suite; still recommended before merge.
+- Minor findings #4–10 (dead image-without-text toast, CSS spacing rule, `aria-pressed`, `setTransformIoMode` hard fail-safe, transform-name-less error toast, `docs/TOOL_ARCHITECTURE.md` "demoted" wording, `.gitignore` hygiene) were left untouched — explicitly out of the Critical/Important scope for this pass, and the `.gitignore` change predates this session and was left as-is (not committed).
diff --git a/README.md b/README.md
index 64ef38a..5d5828c 100644
--- a/README.md
+++ b/README.md
@@ -271,21 +271,21 @@ Tabs appear in **UI order** below. AI-backed tools use whichever **AI provider**
 
 ### Recipes & Cycles (on the Transform tab)
 
 - **Recipe** — a typed, whole-input pipeline arranged on the fixed rail **Normalize → Translate → Obfuscate → Present → Conceal → Carrier**. Obfuscate requires at least one step; the other stages are optional, and each transform picker only offers transforms suited to that stage.
 - **Templates** — **Cipher → Base64**, **Translate → Theban**, and **Cipher → Base64 → QR** are editable shortcuts that prefill the same staged recipe builder; they are not separate execution modes.
 - **Translate** — optionally runs through your configured AI provider and model. Recipes that include it show an AI badge and require a working provider key when applied.
 - **Carriers** — optionally wrap the final result as a QR image or emoji-steganography text. Carrier is always terminal; QR output is shown as an image preview.
 - **Free-form (legacy)** — the original unrestricted whole-input chain builder remains available as an escape hatch and existing `transform-chains-v1` saves continue to load.
 - **Cycle** — rotates saved recipes across words (word 1 → recipe A, word 2 → recipe B, wrap). The default **word-safe** mode rejects recipes such as Base64, Translate, or Carrier pipelines that cannot safely operate and reverse one word at a time. Enable **one-way** to allow them; that cycle is not mechanically decodable and is marked for AI decode.
 - Saved recipes and cycles appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply). Nested recipes/cycles are not allowed.
-- If a recipe cannot mechanically reverse, use **AI decode** in the manager (uses your configured AI providers).
+- If a recipe cannot mechanically reverse, click it with **Decode** selected to run AI decode inline (uses your configured AI providers). The manager's AI decode panel is a secondary tool for testing a recipe/cycle without leaving the builder.
 - Export/import JSON from the manager; copy the human-readable recipe for sharing.
 
 > **Future B:** Opaque-token cycles—preserving word boundaries by wrapping arbitrary recipe output in tokens—are a possible future design, not part of the current cycle modes.
 
 ### 🌐 **AI Translation** (AI-powered)
 
 *Lives on the **Transform** tab — not a separate tab.*
 
 - **20+ Languages**: Major world languages (Spanish, French, Chinese, Japanese, Korean, etc.)
 - **Dead & Exotic Languages**: Latin, Sanskrit, Ancient Greek, Sumerian, Akkadian, Old English, and more
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 09e7bc7..93e0483 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -356,22 +356,36 @@
         return list.reduce(function(acc, node) {
             try {
                 return reverseNode(node, acc);
             } catch (e) {
                 console.warn('Chain node "' + node.transform + '" reverse failed:', e);
                 return acc;
             }
         }, text);
     }
 
+    /**
+     * A staged recipe with a Translate or Carrier stage is not mechanically
+     * reversible: translation is lossy/AI-driven and carriers (QR, emoji
+     * steganography) change the medium of the output, not just its text.
+     * These stages have no `transform` key so `getRunnableChainNodes` can't
+     * see them — check the full staged node list explicitly.
+     */
+    function stagedChainHasOneWayStage(chain) {
+        if (!chain || chain.kind !== 'staged') return false;
+        var stages = chain.stages || {};
+        return !!(stages.translate || stages.carrier);
+    }
+
     /** A chain round-trips only if every one of its nodes does. */
     function chainIsReversible(chain) {
+        if (stagedChainHasOneWayStage(chain)) return false;
         var nodes = getRunnableChainNodes(chain);
         if (!nodes.length) return false;
         return nodes.every(function(node) {
             return nodeIsValid(node) && nodeCanReverse(node);
         });
     }
 
     // ---- word splitting ---------------------------------------------------
 
     /**
@@ -446,22 +460,52 @@
     }
 
     /** One node as "Name [key] {options}" so recipes can tell Caesar shift 3 from 7. */
     function describeNode(node) {
         var key = (node && typeof node.transform === 'string' && node.transform) || '?';
         var t = lookupTransform(key);
         var label = t ? (t.name + ' [' + key + ']') : key;
         return label + ' ' + serializeNodeOptions(node && node.options);
     }
 
+    /** Describe a single flattened staged node, including non-transform stages. */
+    function describeStagedNode(node) {
+        if (node && typeof node.transform === 'string') {
+            return describeNode(node);
+        }
+        if (node && node.type === 'translate') {
+            var stagesApi = global.TransformRecipeStages;
+            var language = stagesApi && typeof stagesApi.resolveTranslateLanguage === 'function'
+                ? stagesApi.resolveTranslateLanguage(node.lang)
+                : { name: String(node.lang || ''), code: String(node.lang || '') };
+            return 'Translate to ' + (language.name || node.lang || '?') + ' [translate]';
+        }
+        if (node && node.type === 'qr') {
+            return 'QR code carrier [qr]';
+        }
+        if (node && node.type === 'emoji_stego') {
+            return 'Emoji steganography carrier [emoji_stego]';
+        }
+        return (node && node.type) || '?';
+    }
+
+    /**
+     * Human-readable, ordered description of every step a chain/recipe runs,
+     * used both as the registered transform's tooltip and as the AI decode
+     * hint. For staged recipes this must walk the full flattened node list
+     * (`getStagedNodes`), not just the transform-backed subset, or Translate
+     * and Carrier stages silently vanish from the description.
+     */
     function describeChain(chain) {
-        var names = getRunnableChainNodes(chain).map(describeNode);
+        var nodes = (chain && chain.kind === 'staged') ? getStagedNodes(chain) : getRunnableChainNodes(chain);
+        var describe = (chain && chain.kind === 'staged') ? describeStagedNode : describeNode;
+        var names = nodes.map(describe);
         return names.join(' → ') || 'empty chain';
     }
 
     function registerChain(chain) {
         var nodes = getRunnableChainNodes(chain);
         var reversible = chainIsReversible(chain);
         var isStaged = chain.kind === 'staged';
         global.transforms[CHAIN_PREFIX + chain.id] = {
             name: chain.name,
             category: CATEGORY,
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index e361a1f..d8c51e7 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -122,20 +122,25 @@ class TransformTool extends Tool {
                 if (!transform || !transform.name || !transform.func) {
                     console.warn(`Transform "${key}" is missing required properties (name or func)`, transform);
                     return false;
                 }
                 return true;
             })
             .map(([key, transform]) => ({
                 transformKey: key,
                 customSpellingId: transform.customSpellingId || null,
                 chainId: transform.chainId || null,
+                isChain: !!transform.isChain,
+                isCycle: !!transform.isCycle,
+                cycleId: transform.cycleId || null,
+                description: transform.description || '',
+                canDecode: transform.canDecode !== false,
                 name: transform.name,
                 func: transform.func.bind(transform),
                 preview: transform.preview ? transform.preview.bind(transform) : function() { return '[preview]'; },
                 reverse: transform.reverse ? transform.reverse.bind(transform) : null,
                 category: transform.category || 'special',
                 configurableOptions: transform.configurableOptions || [],
                 hasConfigurableOptions: Array.isArray(transform.configurableOptions) && transform.configurableOptions.length > 0,
                 inputKind: transform.inputKind === 'text' ? 'text' : 'textarea'
             }));
     }
@@ -1114,34 +1119,43 @@ class TransformTool extends Tool {
             stagedRecipeNeedsAsync: function(recipe) {
                 const stages = recipe && recipe.stages;
                 return !!(stages && (stages.translate || stages.carrier));
             },
             applyActiveTransformOutput: async function(options) {
                 const generation = ++this.transformApplyGeneration;
                 const transform = this.activeTransform;
                 const input = this.transformInput;
                 const preserveEmojis = !!(options && options.preserveEmojis);
                 const copyOnSuccess = !!(options && options.copyOnSuccess);
+                // AI decode bills a live API call, so it must only run for an explicit
+                // user gesture (click, or mode-flip re-apply via applyTransform) — never
+                // from @input typing, the transformInput watcher, options save, or a tab
+                // refresh, all of which call this method with neither flag set.
+                const allowAiDecode = !!(options && (options.allowAiDecode || options.copyOnSuccess));
 
                 if (!transform || !input || this.activeTab !== 'transforms') {
                     this.transformOutputKind = 'text';
                     this.transformOutput = '';
                     this.transformOutputImage = '';
                     return { applied: false };
                 }
 
                 const opts = this.getMergedOptionsForTransform(transform.name);
                 const stagedRecipe = this.stagedRecipeForTransform(transform);
                 const action = window.TransformApplyMode
                     ? window.TransformApplyMode.resolveAction(transform, this.transformIoMode)
                     : 'encode';
 
+                if (action === 'ai_decode' && !allowAiDecode) {
+                    return { applied: false };
+                }
+
                 try {
                     let result = { kind: 'text', value: '' };
 
                     if (action === 'ai_decode') {
                         if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
                             || !window.AIProvider.getConfiguredProviders().length) {
                             throw new Error('Configure an AI provider in Settings to decode this transform.');
                         }
                         const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
                         const text = await window.TransformChains.aiDecode(recipe, input, {
@@ -1223,21 +1237,21 @@ class TransformTool extends Tool {
                     const inputBox = document.querySelector('#transform-input');
                     if (inputBox) {
                         this.focusWithoutScroll(inputBox);
                     }
                     return;
                 }
 
                 // Track last used
                 this.saveLastUsedTransform(transform.name);
                 
-                const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
+                const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true, allowAiDecode: true });
                 if (!outcome.applied) {
                     return;
                 }
 
                 if (transform.name === 'Random Mix') {
                     const transformInfo = window.transforms.randomizer.getLastTransformInfo();
                     if (transformInfo.length > 0) {
                         const transformsList = transformInfo.map(t => t.transformName).join(', ');
                         this.showNotification(`Mixed with: ${transformsList}`, 'success', 'fas fa-random');
                     }
diff --git a/tests/test_transform_apply_mode.js b/tests/test_transform_apply_mode.js
index e2ab410..6fc9ff5 100644
--- a/tests/test_transform_apply_mode.js
+++ b/tests/test_transform_apply_mode.js
@@ -32,11 +32,105 @@ assert.strictEqual(M.loadMode(storage), 'decode');
 
 const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
 const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
 assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
 assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
 assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
 assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');
 
 assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);
 
+// describeForAiDecode chain/cycle branches (regression guard for Critical 2 —
+// buildTransformsFromWindow must forward isChain/isCycle/chainId/cycleId or
+// these branches are skipped and only the bare display name reaches the AI
+// decode prompt). Exercised against a minimal stub chainsApi first, then
+// against the real TransformChains + TransformRecipeStages modules so the
+// recipe string produced is the actual step-by-step recipe, not the name.
+const stubChainsApi = {
+    loadChains: () => [{ id: 'c1', name: 'Secret Sauce', kind: 'staged', stages: {} }],
+    loadCycles: () => [{ id: 'cy1', name: 'My Cycle', chainIds: ['c1'] }],
+    describeRecipe: (entity, kind) => 'RECIPE[' + kind + ':' + entity.id + ']'
+};
+assert.strictEqual(
+    M.describeForAiDecode({ name: 'Secret Sauce', isChain: true, chainId: 'c1' }, stubChainsApi),
+    'RECIPE[chain:c1]',
+    'chain branch must call describeRecipe rather than returning the bare name'
+);
+assert.strictEqual(
+    M.describeForAiDecode({ name: 'My Cycle', isCycle: true, cycleId: 'cy1' }, stubChainsApi),
+    'RECIPE[cycle:cy1]',
+    'cycle branch must call describeRecipe rather than returning the bare name'
+);
+// Without isChain/isCycle (the pre-fix shape buildTransformsFromWindow produced),
+// both branches must be skipped and the name-only fallback used instead.
+assert.strictEqual(
+    M.describeForAiDecode({ name: 'Secret Sauce', chainId: 'c1' }, stubChainsApi),
+    'Secret Sauce'
+);
+
+function loadIntoFullContext(rels) {
+    const store = Object.create(null);
+    const fullCtx = {
+        window: null,
+        console,
+        localStorage: {
+            getItem: (k) => (k in store ? store[k] : null),
+            setItem: (k, v) => { store[k] = String(v); },
+            _store: store
+        }
+    };
+    fullCtx.window = fullCtx;
+    vm.createContext(fullCtx);
+    fullCtx.transforms = {
+        caesar: { name: 'Caesar', category: 'cipher', canDecode: true, func: (t) => t, reverse: (t) => t }
+    };
+    rels.forEach((rel) => {
+        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), fullCtx, { filename: rel });
+    });
+    return fullCtx;
+}
+
+const fullCtx = loadIntoFullContext([
+    'js/core/transformRecipeStages.js',
+    'js/core/transformChains.js',
+    'js/core/transformApplyMode.js'
+]);
+const FTC = fullCtx.TransformChains;
+const FM = fullCtx.TransformApplyMode;
+
+const recipeId = FTC.saveRecipe({
+    name: 'Secret Sauce',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: { type: 'translate', lang: 'la', model: '' },
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: null,
+        conceal: null,
+        carrier: null
+    }
+});
+assert.ok(recipeId, 'staged recipe with a translate stage saved');
+
+const recipeDescribed = FM.describeForAiDecode(
+    { name: 'Secret Sauce', isChain: true, chainId: recipeId },
+    FTC
+);
+assert.notStrictEqual(recipeDescribed, 'Secret Sauce', 'must not fall back to the bare display name');
+assert.match(recipeDescribed, /Caesar/, 'recipe description names the obfuscate step');
+assert.match(recipeDescribed, /Latin/i, 'recipe description includes the translate stage the mapping used to drop');
+
+const freeformId = FTC.saveChain({
+    name: 'Freeform',
+    nodes: [{ transform: 'caesar', options: { shift: 3 } }]
+});
+const cycleId = FTC.saveCycle({ name: 'My Cycle', chainIds: [freeformId], mode: 'one_way' });
+assert.ok(cycleId, 'cycle saved');
+const cycleDescribed = FM.describeForAiDecode(
+    { name: 'My Cycle', isCycle: true, cycleId: cycleId },
+    FTC
+);
+assert.notStrictEqual(cycleDescribed, 'My Cycle');
+assert.match(cycleDescribed, /Per-word cycle/);
+assert.match(cycleDescribed, /Caesar/);
+
 console.log('test_transform_apply_mode: OK');
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index deadd48..aba79b8 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -153,21 +153,23 @@ assert.strictEqual(TC.saveRecipe({
     }
 }), null);
 
 ctx.transforms.caesar.func = (t, o) => {
     const shift = (o && o.shift) || 3;
     return t.replace(/[a-zA-Z]/g, (ch) => {
         const base = ch <= 'Z' ? 65 : 97;
         return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
     });
 };
+ctx.transforms.caesar.reverse = (t, o) => ctx.transforms.caesar.func(t, { shift: -((o && o.shift) || 3) });
 ctx.transforms.base64.func = (t) => Buffer.from(t, 'utf8').toString('base64');
+ctx.transforms.base64.reverse = (t) => Buffer.from(t, 'base64').toString('utf8');
 
 const syncId = TC.saveRecipe({
     name: 'Caesar Base64',
     kind: 'staged',
     stages: {
         normalize: null,
         translate: null,
         obfuscate: [
             { transform: 'caesar', options: { shift: 3 } },
             { transform: 'base64', options: {} }
@@ -177,20 +179,82 @@ const syncId = TC.saveRecipe({
         carrier: null
     }
 });
 const syncRecipe = TC.loadChains().filter(c => c.id === syncId)[0];
 const syncInput = 'Hello';
 const caesarOut = ctx.transforms.caesar.func(syncInput, { shift: 3 });
 const syncExpected = ctx.transforms.base64.func(caesarOut);
 assert.strictEqual(TC.runStagedRecipeSync(syncRecipe, syncInput), syncExpected);
 assert.strictEqual(ctx.transforms[`chain_${syncId}`].func(syncInput), syncExpected);
 
+// chainIsReversible / describeChain must account for Translate and Carrier
+// stages (Important finding): these have no `transform` key, so a naive
+// transform-only check wrongly reports mechanical reversibility and a
+// naive transform-only description silently drops them from the AI hint.
+assert.strictEqual(TC.chainIsReversible(syncRecipe), true, 'a plain cipher+encoding recipe is still reversible');
+
+const translateRecipeId = TC.saveRecipe({
+    name: 'Translate Then Theban',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: { type: 'translate', lang: 'la', model: '' },
+        obfuscate: null,
+        present: [{ transform: 'theban', options: {} }],
+        conceal: null,
+        carrier: null
+    }
+});
+const translateRecipe = TC.loadChains().filter(c => c.id === translateRecipeId)[0];
+assert.strictEqual(
+    TC.chainIsReversible(translateRecipe),
+    false,
+    'a recipe with a translate stage must not register as mechanically reversible'
+);
+assert.strictEqual(
+    ctx.transforms[`chain_${translateRecipeId}`].canDecode,
+    false,
+    'the registered transform must inherit the non-reversible verdict'
+);
+assert.strictEqual(
+    ctx.transforms[`chain_${translateRecipeId}`].reverse,
+    null,
+    'no reverse function should be exposed for a one-way recipe'
+);
+const translateDescription = TC.describeChain(translateRecipe);
+assert.match(translateDescription, /Translate/, 'description must mention the translate stage');
+assert.match(translateDescription, /Latin/i, 'description must name the target language');
+assert.match(translateDescription, /Theban/, 'description must still include the transform-backed stage');
+
+const carrierRecipeId = TC.saveRecipe({
+    name: 'Caesar Then QR',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: null,
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: null,
+        conceal: null,
+        carrier: { type: 'qr', options: {} }
+    }
+});
+const carrierRecipe = TC.loadChains().filter(c => c.id === carrierRecipeId)[0];
+assert.strictEqual(
+    TC.chainIsReversible(carrierRecipe),
+    false,
+    'a recipe ending in a QR carrier must not register as mechanically reversible'
+);
+assert.strictEqual(ctx.transforms[`chain_${carrierRecipeId}`].reverse, null);
+const carrierDescription = TC.describeChain(carrierRecipe);
+assert.match(carrierDescription, /QR/, 'description must mention the carrier stage');
+assert.match(carrierDescription, /Caesar/, 'description must still include the transform-backed stage');
+
 const translateCalls = [];
 ctx.AIProvider = {
     chatCompletion: (messages, opts) => {
         translateCalls.push({ messages, opts });
         return Promise.resolve({
             choices: [{ message: { content: '[LA]' + messages[messages.length - 1].content.split('\n\n').pop() } }]
         });
     }
 };
 
