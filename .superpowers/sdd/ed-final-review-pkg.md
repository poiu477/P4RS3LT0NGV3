# Review package: 9c041cfdcbd94499f26e7e153510c0e8f949daca..HEAD

## Commits
fa59b7a docs: document Encode/Decode transform mode
374e017 feat: apply transforms in Encode/Decode mode with shared output path
caee482 feat: add Encode/Decode switch and move output under input
715fa06 feat: include underlying text with QR carrier results
009047f feat: add transform encode/decode mode helper

## Files changed
 README.md                                          |   1 +
 css/style.css                                      |  34 +
 docs/TOOL_ARCHITECTURE.md                          |   8 +
 .../plans/2026-08-04-encode-decode-mode.md         | 694 +++++++++++++++++++++
 .../specs/2026-08-04-encode-decode-mode-design.md  | 118 ++++
 index.template.html                                |   1 +
 js/core/transformApplyMode.js                      |  66 ++
 js/core/transformChains.js                         |   2 +-
 js/tools/TransformTool.js                          | 116 ++--
 package.json                                       |   3 +-
 templates/transforms.html                          |  85 +--
 tests/test_transform_apply_mode.js                 |  42 ++
 tests/test_transform_recipes.js                    |  30 +-
 13 files changed, 1114 insertions(+), 86 deletions(-)

## Diff
diff --git a/README.md b/README.md
index 2219ea7..64ef38a 100644
--- a/README.md
+++ b/README.md
@@ -260,20 +260,21 @@ Categories match the Transform tab and the folders under `src/transformers/` (ea
 
 Tabs appear in **UI order** below. AI-backed tools use whichever **AI provider** you've configured in **Advanced Settings** — you can pick any model across every provider you've added a key for — see [AI Providers & API Keys](#-ai-providers--api-keys) below.
 
 ### 🔤 **Transform**
 
 - **222 Transforms**: Encodings, ciphers, Unicode styles, formats, and more (full catalog above).
 - **Categories**: Grouped sections you can **reorder**; quick-jump legend; **randomizer** last.
 - **Favorites & last used**: Pin transforms and recall recent picks.
 - **Per-transform options**: Gear icon where a transform exposes settings.
 - **Keyboard shortcut**: **T** (shown in the tab title).
+- **Encode / Decode** toggle above the input: every transform and saved recipe runs in that mode. Results show in the Output field under the input and are copied to the clipboard (Copy History). Irreversible methods use AI decode when Decode is selected.
 
 ### Recipes & Cycles (on the Transform tab)
 
 - **Recipe** — a typed, whole-input pipeline arranged on the fixed rail **Normalize → Translate → Obfuscate → Present → Conceal → Carrier**. Obfuscate requires at least one step; the other stages are optional, and each transform picker only offers transforms suited to that stage.
 - **Templates** — **Cipher → Base64**, **Translate → Theban**, and **Cipher → Base64 → QR** are editable shortcuts that prefill the same staged recipe builder; they are not separate execution modes.
 - **Translate** — optionally runs through your configured AI provider and model. Recipes that include it show an AI badge and require a working provider key when applied.
 - **Carriers** — optionally wrap the final result as a QR image or emoji-steganography text. Carrier is always terminal; QR output is shown as an image preview.
 - **Free-form (legacy)** — the original unrestricted whole-input chain builder remains available as an escape hatch and existing `transform-chains-v1` saves continue to load.
 - **Cycle** — rotates saved recipes across words (word 1 → recipe A, word 2 → recipe B, wrap). The default **word-safe** mode rejects recipes such as Base64, Translate, or Carrier pipelines that cannot safely operate and reverse one word at a time. Enable **one-way** to allow them; that cycle is not mechanically decodable and is marked for AI decode.
 - Saved recipes and cycles appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply). Nested recipes/cycles are not allowed.
diff --git a/css/style.css b/css/style.css
index ce33cc4..3078150 100644
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
@@ -5085,20 +5111,28 @@ body.transform-options-modal-open {
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
diff --git a/docs/TOOL_ARCHITECTURE.md b/docs/TOOL_ARCHITECTURE.md
index f345e08..45eeb9d 100644
--- a/docs/TOOL_ARCHITECTURE.md
+++ b/docs/TOOL_ARCHITECTURE.md
@@ -97,20 +97,28 @@ Transform-backed stages run synchronously in rail order. A Translate node uses t
 
 ### Persistence and registration
 
 - Storage remains at `localStorage` keys `transform-chains-v1` and `transform-cycles-v1`; upgrades do not wipe either v1 key.
 - Staged recipes and free-form chains share `transform-chains-v1`. Staged records keep `kind: 'staged'` and `stages`; old node-list records are normalized to `kind: 'freeform'`.
 - The unrestricted **Free-form (legacy)** builder and `saveChain` path remain available behind explicit `LEGACY_FREEFORM_*` / `@legacy` markers for compatibility and possible later removal.
 - Registration uses `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`.
 - Mechanical reverse is available only when every relevant node supports it; otherwise the manager offers AI recipe decode through `aiDecode`.
 - UI: `templates/transforms.html`, with builder and apply/preview methods on `TransformTool`.
 
+### Encode / Decode apply mode
+
+- Mode helpers: `js/core/transformApplyMode.js` (`window.TransformApplyMode`); persisted in `localStorage` key `transform-encode-decode-mode` (default `encode`).
+- UI: segmented **Encode | Decode** switch above the input in `templates/transforms.html`; Output field sits directly under Input.
+- Click path: registered transforms and saved recipes/cycles share `TransformTool.applyTransform` → `applyActiveTransformOutput({ copyOnSuccess: true })`. `TransformApplyMode.resolveAction` picks `encode`, mechanical `reverse`, or `ai_decode` (irreversible decode → `TransformChains.aiDecode` with `describeForAiDecode`).
+- Destinations: text always in Output; image carriers (e.g. QR) preview in Output with underlying text when present; explicit apply/click also copies text to clipboard (Copy History). Live `@input` auto-transform updates Output only (no clipboard).
+- Manager **Apply** on recipe list is demoted; chains run like other transform tiles via the shared click path.
+
 ### Cycle modes
 
 - `word_safe` is the default, including for records saved before cycle modes existed. Validation rejects recipes that are unsafe per word, including Base64-like transforms and staged Translate or Carrier nodes, and registration keeps mechanical reverse only after its round-trip probe succeeds.
 - `one_way` permits those recipes, but registers the cycle with `canDecode: false` and no mechanical `reverse`; the UI marks it for AI decode.
 - **Future B (documented only):** opaque-token cycles could preserve word boundaries around arbitrary recipe output. No opaque-token schema, execution path, or UI exists today.
 
 ## Adding a New Tool
 
 ### Step 1: Create Tool Class
 
diff --git a/docs/superpowers/plans/2026-08-04-encode-decode-mode.md b/docs/superpowers/plans/2026-08-04-encode-decode-mode.md
new file mode 100644
index 0000000..147b45a
--- /dev/null
+++ b/docs/superpowers/plans/2026-08-04-encode-decode-mode.md
@@ -0,0 +1,694 @@
+# Encode/Decode Mode + Output Destinations Implementation Plan
+
+> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+
+**Goal:** Add a global Encode/Decode switch by the Transforms input so every transform and recipe click runs in that mode, shows text in an Output field under the Input, and copies text to the clipboard (Copy History).
+
+**Architecture:** Keep apply logic centralized in `TransformTool.applyActiveTransformOutput` / `applyTransform`. Add a tiny pure helper for mode → action resolution (`encode` | `reverse` | `ai_decode`). Move the existing output UI under the input; extend carrier results so QR can return image **and** underlying text. AI fallback reuses `TransformChains.aiDecode` with a recipe description for chains/cycles or a single-transform description.
+
+**Tech Stack:** Vanilla JS + Vue 2 (existing), `localStorage`, Node `vm` tests, `npm run build` / `build:templates`.
+
+## Global Constraints
+
+- Spec: `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md`
+- Recipes must use the same click path as other transforms (category tiles).
+- Text results always appear in Output under Input **and** are copied to clipboard on explicit apply/click (not on every keystroke of auto-transform).
+- Decode + irreversible → AI decode into Output + clipboard; missing AI → Settings toast.
+- Live `@input` auto-transform updates Output only (no clipboard spam).
+- Conventional commits (`feat`, `fix`, `test`, `docs`).
+- After template edits: `npm run build:templates` or full `npm run build`.
+- Do not redesign Copy History panel UI.
+
+## File Map
+
+| File | Responsibility |
+|------|----------------|
+| `js/core/transformApplyMode.js` | Pure helpers: load/save mode, resolve apply action, describe transform for AI decode |
+| `js/core/transformChains.js` | QR carrier returns `{ kind:'image', value, text }`; export helpers if needed |
+| `js/tools/TransformTool.js` | Mode state, apply encode/reverse/ai paths, output text+image fields, mode-flip recompute |
+| `templates/transforms.html` | Encode/Decode switch, Output under Input, demote manager Apply |
+| `css/style.css` | Mode switch + under-input output styles |
+| `tests/test_transform_apply_mode.js` | Mode resolve + carrier text payload |
+| `package.json` | Wire `test:apply-mode` into `test:all` |
+| `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md` | Already approved; link from README if transforms docs mention usage |
+
+---
+
+### Task 1: Pure mode helper + tests
+
+**Files:**
+- Create: `js/core/transformApplyMode.js`
+- Create: `tests/test_transform_apply_mode.js`
+- Modify: `package.json` (scripts)
+- Modify: `index.template.html` (add `<script src="js/core/transformApplyMode.js"></script>` immediately before `transformRecipeStages.js`)
+
+**Interfaces:**
+- Consumes: none (pure)
+- Produces:
+  - `TransformApplyMode.STORAGE_KEY` → `'transform-encode-decode-mode'`
+  - `TransformApplyMode.normalizeMode(value)` → `'encode' | 'decode'`
+  - `TransformApplyMode.loadMode(storage)` → `'encode' | 'decode'`
+  - `TransformApplyMode.saveMode(storage, mode)` → void
+  - `TransformApplyMode.resolveAction(transform, mode)` → `'encode' | 'reverse' | 'ai_decode'`
+  - `TransformApplyMode.describeForAiDecode(transform, chainsApi)` → `string`
+
+- [ ] **Step 1: Write the failing test**
+
+Create `tests/test_transform_apply_mode.js`:
+
+```javascript
+#!/usr/bin/env node
+const assert = require('assert');
+const path = require('path');
+const fs = require('fs');
+const vm = require('vm');
+
+function load(rel) {
+    const ctx = { console, window: null };
+    ctx.window = ctx;
+    vm.createContext(ctx);
+    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), ctx, { filename: rel });
+    return ctx;
+}
+
+const ctx = load('js/core/transformApplyMode.js');
+const M = ctx.TransformApplyMode;
+assert.ok(M, 'TransformApplyMode global');
+
+assert.strictEqual(M.normalizeMode('decode'), 'decode');
+assert.strictEqual(M.normalizeMode('ENCODE'), 'encode');
+assert.strictEqual(M.normalizeMode('nope'), 'encode');
+
+const store = Object.create(null);
+const storage = {
+    getItem: (k) => (k in store ? store[k] : null),
+    setItem: (k, v) => { store[k] = String(v); }
+};
+assert.strictEqual(M.loadMode(storage), 'encode');
+M.saveMode(storage, 'decode');
+assert.strictEqual(store[M.STORAGE_KEY], 'decode');
+assert.strictEqual(M.loadMode(storage), 'decode');
+
+const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
+const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
+assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
+assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
+assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
+assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');
+
+assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);
+
+console.log('test_transform_apply_mode: OK');
+```
+
+- [ ] **Step 2: Run test to verify it fails**
+
+Run: `node tests/test_transform_apply_mode.js`  
+Expected: FAIL (cannot find module / TransformApplyMode undefined)
+
+- [ ] **Step 3: Write minimal implementation**
+
+Create `js/core/transformApplyMode.js`:
+
+```javascript
+(function(global) {
+    var STORAGE_KEY = 'transform-encode-decode-mode';
+
+    function normalizeMode(value) {
+        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
+    }
+
+    function loadMode(storage) {
+        try {
+            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
+        } catch (e) {
+            return 'encode';
+        }
+    }
+
+    function saveMode(storage, mode) {
+        try {
+            if (storage && typeof storage.setItem === 'function') {
+                storage.setItem(STORAGE_KEY, normalizeMode(mode));
+            }
+        } catch (e) { /* ignore quota */ }
+    }
+
+    function isMechanicallyReversible(transform) {
+        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
+    }
+
+    /**
+     * @returns {'encode'|'reverse'|'ai_decode'}
+     */
+    function resolveAction(transform, mode) {
+        if (!transform) return 'encode';
+        if (normalizeMode(mode) !== 'decode') return 'encode';
+        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
+    }
+
+    function describeForAiDecode(transform, chainsApi) {
+        if (!transform) return 'Unknown transform';
+        if (chainsApi && transform.isChain && transform.chainId) {
+            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
+                .filter(function(c) { return c.id === transform.chainId; })[0];
+            if (chain && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(chain, 'chain');
+            }
+        }
+        if (chainsApi && transform.isCycle && transform.cycleId) {
+            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
+                .filter(function(c) { return c.id === transform.cycleId; })[0];
+            if (cycle && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(cycle, 'cycle');
+            }
+        }
+        var bits = [transform.name || 'Transform'];
+        if (transform.description) bits.push(transform.description);
+        return bits.join(' — ');
+    }
+
+    global.TransformApplyMode = {
+        STORAGE_KEY: STORAGE_KEY,
+        normalizeMode: normalizeMode,
+        loadMode: loadMode,
+        saveMode: saveMode,
+        resolveAction: resolveAction,
+        describeForAiDecode: describeForAiDecode
+    };
+})(typeof window !== 'undefined' ? window : this);
+```
+
+In `index.template.html`, add before the recipe/chains scripts:
+
+```html
+<script src="js/core/transformApplyMode.js"></script>
+<script src="js/core/transformRecipeStages.js"></script>
+<script src="js/core/transformChains.js"></script>
+```
+
+Add to `package.json`:
+
+```json
+"test:apply-mode": "node tests/test_transform_apply_mode.js",
+"test:all": "... existing ... && npm run test:apply-mode"
+```
+
+(Keep existing `test:all` segments; append `&& npm run test:apply-mode`.)
+
+- [ ] **Step 4: Run tests to verify they pass**
+
+Run: `node tests/test_transform_apply_mode.js`  
+Expected: `test_transform_apply_mode: OK`
+
+Run: `npm run test:all`  
+Expected: exit 0 (or at least apply-mode + recipes/chains still OK)
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add js/core/transformApplyMode.js tests/test_transform_apply_mode.js package.json index.template.html
+git commit -m "$(cat <<'EOF'
+feat: add transform encode/decode mode helper
+
+EOF
+)"
+```
+
+---
+
+### Task 2: Carrier results include underlying text
+
+**Files:**
+- Modify: `js/core/transformChains.js` (`applyCarrier` QR return)
+- Modify: `tests/test_transform_recipes.js` (assert QR-shaped result includes `text` when tested; if no QR lib in vm, unit-test a small exported shape helper **or** assert documentation via a focused assert on `applyCarrier` with stubbed `QRCode`)
+
+**Interfaces:**
+- Consumes: existing `applyCarrier(carrierNode, text)`
+- Produces: QR success → `{ kind: 'image', value: dataUrl, text: String(text) }`; emoji stego unchanged `{ kind:'text', value }`
+
+- [ ] **Step 1: Extend recipe tests with stubbed QR**
+
+In `tests/test_transform_recipes.js`, after chains load, add:
+
+```javascript
+ctx.QRCode = {
+    toDataURL: function(text) {
+        return Promise.resolve('data:image/png;base64,STUB');
+    }
+};
+const recipeWithQr = {
+    name: 'QR Demo',
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: null,
+        obfuscate: [{ transform: 'base64', options: {} }],
+        present: null,
+        conceal: null,
+        carrier: { type: 'qr', options: {} }
+    }
+};
+// save + run async
+return TC.runStagedRecipeAsync(
+    TC.loadChains().filter(c => c.name === 'QR Demo')[0] || recipeWithQr,
+    'hi'
+).then(function(result) {
+    assert.strictEqual(result.kind, 'image');
+    assert.ok(result.value.indexOf('data:image') === 0);
+    assert.strictEqual(result.text, 'aGk='); // base64 of "hi" — adjust if encode differs
+    console.log('test_transform_recipes: OK');
+});
+```
+
+If the file is currently sync-only at the end, convert the QR assertion block to the final async section **or** save the recipe first with `TC.saveRecipe` then `runStagedRecipeAsync` on the loaded record. Match existing base64 encoding used by `ctx.transforms.base64` in that test file (stub `func` if needed).
+
+If `base64` in the test harness is only a stub without `func`, set:
+
+```javascript
+ctx.transforms.base64.func = function(text) {
+    return Buffer.from(String(text), 'utf8').toString('base64');
+};
+```
+
+before the async run.
+
+- [ ] **Step 2: Run test to verify it fails**
+
+Run: `node tests/test_transform_recipes.js`  
+Expected: FAIL on missing `result.text` (or recipe save / async path)
+
+- [ ] **Step 3: Implement QR text payload**
+
+In `js/core/transformChains.js` `applyCarrier`, change the QR `.then` to:
+
+```javascript
+.then(function(dataUrl) {
+    return { kind: 'image', value: dataUrl, text: String(text) };
+});
+```
+
+- [ ] **Step 4: Run tests**
+
+Run: `node tests/test_transform_recipes.js`  
+Expected: pass including QR text assertion
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add js/core/transformChains.js tests/test_transform_recipes.js
+git commit -m "$(cat <<'EOF'
+feat: include underlying text with QR carrier results
+
+EOF
+)"
+```
+
+---
+
+### Task 3: Encode/Decode switch UI + Output under Input
+
+**Files:**
+- Modify: `js/tools/TransformTool.js` (data: `transformIoMode`, init from `TransformApplyMode.loadMode`)
+- Modify: `templates/transforms.html` (switch + move output block)
+- Modify: `css/style.css`
+
+**Interfaces:**
+- Consumes: `TransformApplyMode.loadMode` / `saveMode` / `normalizeMode`
+- Produces: Vue state `transformIoMode: 'encode'|'decode'`; method `setTransformIoMode(mode)`
+
+- [ ] **Step 1: Add state + setter in TransformTool data/methods**
+
+In the tool’s `data()` (or equivalent initial state object), add:
+
+```javascript
+transformIoMode: (window.TransformApplyMode
+    ? window.TransformApplyMode.loadMode(localStorage)
+    : 'encode'),
+transformOutputText: '', // optional alias — see Step 3 if keeping transformOutput
+```
+
+Add methods:
+
+```javascript
+setTransformIoMode: function(mode) {
+    if (!window.TransformApplyMode) return;
+    const next = window.TransformApplyMode.normalizeMode(mode);
+    if (next === this.transformIoMode) return;
+    this.transformIoMode = next;
+    window.TransformApplyMode.saveMode(localStorage, next);
+    if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
+        this.applyTransform(this.activeTransform);
+    }
+},
+```
+
+(Mode flip uses full `applyTransform` so clipboard updates on intentional mode change with active selection.)
+
+- [ ] **Step 2: Template — switch above input; Output directly under input**
+
+Near the top of `templates/transforms.html`, inside `.input-section` (or wrapping it), add:
+
+```html
+<div class="transform-io-mode" role="group" aria-label="Encode or decode">
+    <button
+        type="button"
+        class="transform-io-mode-btn"
+        :class="{ active: transformIoMode === 'encode' }"
+        @click="setTransformIoMode('encode')"
+    >Encode</button>
+    <button
+        type="button"
+        class="transform-io-mode-btn"
+        :class="{ active: transformIoMode === 'decode' }"
+        @click="setTransformIoMode('decode')"
+    >Decode</button>
+</div>
+```
+
+Update input placeholders:
+
+```html
+:placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
+```
+
+**Move** the existing `.output-section` block (currently below the transform button grid) to sit **immediately under** the input control(s), still inside the left column / `.transform-layout` flow before filters/buttons.
+
+Output section should show:
+
+- Textarea bound to text output when present
+- Image when `transformOutputKind === 'image'`
+- **Both** when image + text: show image and the text textarea (`v-if` text when `transformOutput` text non-empty OR dedicated `transformOutputText`)
+
+Suggested binding after Task 4 wiring:
+
+```html
+<div class="output-section" v-if="transformOutput || transformOutputKind === 'image'">
+  <div class="output-heading">
+    <h4>
+      <i class="fas fa-check-circle"></i>
+      {{ transformIoMode === 'decode' ? 'Decoded' : 'Transformed' }} Message
+      <small v-if="activeTransform">({{ activeTransform.name }})</small>
+    </h4>
+  </div>
+  <div class="output-container">
+    <img v-if="transformOutputKind === 'image' && transformOutputImage" :src="transformOutputImage" class="transform-image-output" alt="" />
+    <textarea v-if="transformOutput" readonly v-model="transformOutput" aria-label="Transform output text"></textarea>
+    <button v-if="transformOutput" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
+      <i class="fas fa-copy"></i>
+    </button>
+  </div>
+</div>
+```
+
+Until Task 4 lands image split fields, keep current `transformOutput`/`transformOutputKind` behavior but **relocate** the markup.
+
+- [ ] **Step 3: CSS for mode switch**
+
+Add minimal styles reusing existing button tokens:
+
+```css
+.transform-io-mode {
+    display: inline-flex;
+    margin-bottom: 0.5rem;
+    border: 1px solid var(--input-border);
+    border-radius: 8px;
+    overflow: hidden;
+}
+.transform-io-mode-btn {
+    border: 0;
+    background: transparent;
+    color: var(--text-color);
+    padding: 0.4rem 0.9rem;
+    cursor: pointer;
+}
+.transform-io-mode-btn.active {
+    background: rgba(52, 152, 219, 0.2);
+    color: #3498db;
+    font-weight: 600;
+}
+.transform-layout .input-section + .output-section {
+    margin-top: 0.75rem;
+}
+```
+
+- [ ] **Step 4: Build templates and smoke-check**
+
+Run: `npm run build:templates`  
+Expected: success
+
+Manually open Transforms tab: switch visible above input; output block under input (may be empty until a transform runs).
+
+- [ ] **Step 5: Commit**
+
+```bash
+git add js/tools/TransformTool.js templates/transforms.html css/style.css
+git commit -m "$(cat <<'EOF'
+feat: add Encode/Decode switch and move output under input
+
+EOF
+)"
+```
+
+---
+
+### Task 4: Apply path — encode / reverse / AI decode + clipboard
+
+**Files:**
+- Modify: `js/tools/TransformTool.js` (`applyActiveTransformOutput`, `applyTransform`, remove/demote empty-input recipe-only messaging)
+
+**Interfaces:**
+- Consumes: `TransformApplyMode.resolveAction`, `describeForAiDecode`, `TransformChains.aiDecode`, `transform.reverse`, staged async encode
+- Produces: filled `transformOutput` (text), optional `transformOutputImage`, clipboard via `forceCopyToClipboard` on click/mode-flip apply only
+
+- [ ] **Step 1: Extend output state fields**
+
+Add to tool state:
+
+```javascript
+transformOutputImage: '',
+```
+
+When applying results:
+
+```javascript
+// text always in transformOutput when available
+// images in transformOutputImage; transformOutputKind 'image' | 'text'
+```
+
+- [ ] **Step 2: Rewrite `applyActiveTransformOutput` action switch**
+
+Core logic (integrate into existing generation/stale guards):
+
+```javascript
+applyActiveTransformOutput: async function(options) {
+    const generation = ++this.transformApplyGeneration;
+    const transform = this.activeTransform;
+    const input = this.transformInput;
+    const preserveEmojis = !!(options && options.preserveEmojis);
+    const copyOnSuccess = !!(options && options.copyOnSuccess);
+
+    if (!transform || !input || this.activeTab !== 'transforms') {
+        this.transformOutputKind = 'text';
+        this.transformOutput = '';
+        this.transformOutputImage = '';
+        return { applied: false };
+    }
+
+    const opts = this.getMergedOptionsForTransform(transform.name);
+    const stagedRecipe = this.stagedRecipeForTransform(transform);
+    const action = window.TransformApplyMode
+        ? window.TransformApplyMode.resolveAction(transform, this.transformIoMode)
+        : 'encode';
+
+    try {
+        let result = { kind: 'text', value: '' };
+
+        if (action === 'ai_decode') {
+            if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
+                || !window.AIProvider.getConfiguredProviders().length) {
+                throw new Error('Configure an AI provider in Settings to decode this transform.');
+            }
+            const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
+            const text = await window.TransformChains.aiDecode(recipe, input, {
+                model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
+            });
+            result = { kind: 'text', value: text };
+        } else if (action === 'reverse') {
+            if (typeof transform.reverse !== 'function') {
+                throw new Error('No reverse function available.');
+            }
+            result = { kind: 'text', value: String(transform.reverse(input, opts) || '') };
+        } else if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
+            result = await window.TransformChains.runStagedRecipeAsync(stagedRecipe, input, opts);
+        } else if (preserveEmojis) {
+            // existing emoji-preserving encode path using transform.func
+            const segments = window.EmojiUtils.splitEmojis(input);
+            const value = window.EmojiUtils.joinEmojis(segments.map(segment => {
+                if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
+                    return segment;
+                }
+                return transform.func(segment, opts);
+            }));
+            result = { kind: 'text', value };
+        } else {
+            result = { kind: 'text', value: transform.func(input, opts) };
+        }
+
+        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
+            return { applied: false, stale: true };
+        }
+
+        if (result && result.kind === 'image') {
+            this.transformOutputKind = 'image';
+            this.transformOutputImage = result.value != null ? String(result.value) : '';
+            this.transformOutput = result.text != null ? String(result.text) : '';
+        } else {
+            this.transformOutputKind = 'text';
+            this.transformOutputImage = '';
+            this.transformOutput = result && result.value != null ? String(result.value) : '';
+        }
+
+        if (copyOnSuccess && this.transformOutput) {
+            this.isTransformCopy = true;
+            this.forceCopyToClipboard(this.transformOutput);
+        }
+
+        return { applied: true, kind: this.transformOutputKind };
+    } catch (e) {
+        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
+            return { applied: false, stale: true };
+        }
+        this.transformOutputKind = 'text';
+        this.transformOutput = '';
+        this.transformOutputImage = '';
+        this.showNotification(
+            (e && e.message) ? e.message : (transform.name + ' failed.'),
+            'error',
+            'fas fa-exclamation-triangle'
+        );
+        return { applied: false, error: e };
+    }
+},
+```
+
+- [ ] **Step 3: Update `applyTransform` to always use shared path**
+
+```javascript
+applyTransform: async function(transform, event) {
+    event && event.preventDefault();
+    event && event.stopPropagation();
+    if (transform && transform.name === 'Random Mix') {
+        this.triggerRandomizerChaos();
+    }
+    if (!transform) return;
+
+    this.activeTransform = transform;
+
+    if (!this.transformInput) {
+        this.showNotification('Enter text in the input box, then click the transform again.', 'info', 'fas fa-keyboard');
+        const inputBox = document.querySelector('#transform-input');
+        if (inputBox) this.focusWithoutScroll(inputBox);
+        return;
+    }
+
+    this.saveLastUsedTransform(transform.name);
+    const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
+    if (!outcome.applied) return;
+
+    // Keep existing Random Mix / success toast behavior for non-AI failures already handled
+    if (transform.name !== 'Random Mix') {
+        const message = this.transformOutputKind === 'image' && !this.transformOutput
+            ? transform.name + ' image preview ready!'
+            : transform.name + (this.transformIoMode === 'decode' ? ' decoded and copied!' : ' applied and copied!');
+        this.showNotification(message, 'success', 'fas fa-check');
+    }
+
+    // existing focus / active-button cleanup
+},
+```
+
+Ensure `autoTransform` calls `applyActiveTransformOutput({ preserveEmojis: true })` **without** `copyOnSuccess`.
+
+- [ ] **Step 4: Demote manager Apply**
+
+In `templates/transforms.html` recipe list actions: remove the prominent Apply button **or** keep a quiet icon that calls `applySavedChain` → `applyTransform` (same path). Prefer remove to avoid two primary verbs.
+
+Update leftover copy that says “use Apply on the list”.
+
+- [ ] **Step 5: Manual verification checklist + commit**
+
+Verify locally after `npm run build:templates`:
+
+1. Encode + Caesar click → Output under input + Copy History entry  
+2. Decode + Caesar click on cipher text → plaintext in Output + history  
+3. Decode + irreversible recipe with AI configured → AI result in Output + history  
+4. Decode + irreversible without AI → Settings toast  
+5. Typing with active transform updates Output only (no history flood)
+
+```bash
+git add js/tools/TransformTool.js templates/transforms.html
+git commit -m "$(cat <<'EOF'
+feat: apply transforms in Encode/Decode mode with shared output path
+
+EOF
+)"
+```
+
+---
+
+### Task 5: Docs + final verification
+
+**Files:**
+- Modify: `README.md` (short Transforms note: Encode/Decode switch, Output under input, recipes click like other methods)
+- Modify: `docs/TOOL_ARCHITECTURE.md` only if it documents transform apply flow
+
+- [ ] **Step 1: Document user-facing behavior**
+
+Add a short README bullet under Transforms:
+
+```markdown
+- **Encode / Decode** toggle above the input: every transform and saved recipe runs in that mode. Results show in the Output field under the input and are copied to the clipboard (Copy History). Irreversible methods use AI decode when Decode is selected.
+```
+
+- [ ] **Step 2: Run full test suite**
+
+Run: `npm run test:all`  
+Expected: exit 0
+
+- [ ] **Step 3: Commit**
+
+```bash
+git add README.md docs/TOOL_ARCHITECTURE.md
+git commit -m "$(cat <<'EOF'
+docs: document Encode/Decode transform mode
+
+EOF
+)"
+```
+
+---
+
+## Spec coverage checklist
+
+| Spec requirement | Task |
+|------------------|------|
+| Global Encode/Decode near input + persist | Task 1 + 3 |
+| Click transform/recipe → Output + clipboard | Task 4 |
+| Output under Input | Task 3 |
+| Text always in Output | Task 4 |
+| Decode + reverse | Task 1 resolve + Task 4 |
+| Decode + AI fallback | Task 4 |
+| AI missing → Settings toast | Task 4 |
+| Mode flip re-run | Task 3 `setTransformIoMode` |
+| Live typing respects mode, Output only | Task 4 `autoTransform` without copy |
+| QR image + underlying text | Task 2 + 4 |
+| Demote manager Apply | Task 4 |
+| Recipes same as other methods | Task 4 (shared `applyTransform`) |
+
+## Placeholder / consistency self-review
+
+- No TBD steps; script load path must mirror `transformRecipeStages.js` exactly in Task 1.
+- `transformOutputImage` introduced in Task 4; Task 3 template may temporarily use existing fields then align in Task 4.
+- `copyOnSuccess` distinguishes click/mode-flip from auto-transform.
+- `resolveAction` / `describeForAiDecode` names consistent across tasks.
diff --git a/docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md b/docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md
new file mode 100644
index 0000000..cf3464e
--- /dev/null
+++ b/docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md
@@ -0,0 +1,118 @@
+# Encode/Decode Mode + Transform Output Destinations
+
+**Date:** 2026-08-04  
+**Status:** Approved for planning  
+**Scope:** Transforms tab — global Encode/Decode mode, unified click behavior for transforms and recipes, Output field under Input, clipboard/Copy History
+
+## Problem
+
+Recipes feel different from other transform methods: users expect clicking a recipe tile to run against the top input and produce a visible result. “Right output” in product language means **Copy History** (clipboard-driven), while long results also need an on-page **Output** field near the input. Decode today is split across mechanical `reverse` and a separate AI-decode panel for irreversible chains.
+
+## Goals
+
+1. One global **Encode | Decode** control near the top input drives every transform/recipe click.
+2. Clicking a transform **or** saved recipe tile behaves the same: run in current mode → show result → copy text to clipboard (Copy History).
+3. An **Output** field sits directly under the Input for reading long results (especially decoded text).
+4. Decode + non-reversible methods auto-run the existing AI decode path into those same destinations.
+
+## Non-goals
+
+- Redesigning Copy History UI or tabs.
+- Changing stage-rail recipe builder validation (min two steps, etc.).
+- Removing AI-decode power tools from the Recipes manager entirely (they may remain as secondary tools).
+- Building a separate Decoder tab workflow.
+
+## Decisions (locked)
+
+| Topic | Decision |
+| --- | --- |
+| Mode control | Global segmented **Encode \| Decode** near input (Approach 1) |
+| Default | Encode |
+| Persistence | `localStorage` |
+| Irreversible in Decode | **B** — auto AI decode into Output + clipboard |
+| Primary destinations | Output under Input **and** clipboard → Copy History |
+| Text results | Always shown in Output (not clipboard-only) |
+| Image carriers (e.g. QR) | Preview in Output; if underlying text exists, show that text in Output too and copy the text |
+| Recipes | Same click path as other transforms; manager Apply demoted/removed |
+
+## UI layout
+
+```
+[ Encode | Decode ]
+[ Input ……………………………… ]
+[ Output …………………………… ]   ← under input; readonly + copy control
+[ search / category filters … ]
+[ Recipes & chains manager … ]
+[ transform / recipe buttons … ]
+```
+
+- Placeholder reflects mode: transform vs decode.
+- Existing output block that currently sits below the button grid moves up under Input (or is replaced by this field so there is a single Output).
+
+## Click behavior
+
+1. User enters text in Input (optional first).
+2. User clicks any transform or recipe button.
+3. App sets `activeTransform` and runs according to mode (see below).
+4. **Text** result → Output field + clipboard (`forceCopyToClipboard` / equivalent) → Copy History entry labeled with the transform/recipe name.
+5. Empty Input → select the method, focus Input; do not treat as a hard error.
+
+Recipes must appear and work as category tiles (existing `chains` registration). Manager list keeps Edit / Delete / Copy recipe; separate Apply is redundant for the primary path.
+
+## Mode semantics
+
+### Encode
+
+- Call `func` / staged async encode (`runStagedRecipeAsync` when needed).
+- Result → Output + clipboard when text.
+
+### Decode + mechanically reversible (`canDecode` / `reverse`)
+
+- Call `reverse` (chains/cycles use existing reverse path).
+- Result → Output + clipboard.
+
+### Decode + not reversible
+
+- Run existing AI-assisted decode (same provider/model prefs as chain AI decode, e.g. `chain-decode-model` / Settings).
+- Result → Output + clipboard.
+- If AI is not configured: toast pointing to Settings; leave Output empty; do not silently fail.
+
+### Mode flip
+
+- When Encode ↔ Decode changes and a transform is already selected with non-empty Input, re-run immediately in the new mode.
+
+### Live typing
+
+- Existing `@input` auto-transform continues and respects the current Encode/Decode mode.
+
+## Carriers / non-text
+
+- QR (and similar image outputs): show image preview in Output.
+- If an underlying text payload exists, also show that text in Output and copy the text to clipboard.
+- If there is no sensible text payload: show image only; toast that clipboard was skipped (optional, keep short).
+
+## Recipes manager
+
+- Remains the place to create/edit/delete recipes and cycles.
+- Primary “run” path is the recipe tile among transforms, not a manager-only Apply.
+- Optional: keep a small Apply affordance that calls the same shared apply path (must not be the only way to run).
+
+## Persistence & copy labeling
+
+- Mode key: e.g. `transform-encode-decode-mode` → `encode` | `decode`.
+- Copy History should continue to attribute the entry to the active transform/recipe name (Encode vs Decode may be reflected in label if easy; not required for v1).
+
+## Success criteria
+
+- [ ] Encode/Decode switch visible next to/above Input and persists across reload.
+- [ ] Clicking Base64 (or similar) and a saved recipe both fill Output under Input and create a Copy History entry when the result is text.
+- [ ] Decode + reversible recipe/transform reverses into Output + clipboard.
+- [ ] Decode + irreversible recipe triggers AI decode into Output + clipboard when AI is configured.
+- [ ] Decode without AI configured surfaces a clear Settings toast.
+- [ ] Long decoded text is readable in the under-input Output without opening Copy History.
+
+## Out of scope / later
+
+- Filtering or dimming irreversible tiles while in Decode.
+- Per-tile Encode/Decode dual buttons.
+- Changing upstream Pages deploy branch policy (manual workflow_dispatch on feature branch remains operational concern).
diff --git a/index.template.html b/index.template.html
index f3c1310..eb3a9fd 100644
--- a/index.template.html
+++ b/index.template.html
@@ -538,20 +538,21 @@
 
     <!-- Load JavaScript files after Vue template -->
     <!-- Data files (generated/static data) -->
     <script src="js/data/emojiData.js"></script>
     <script src="js/data/emojiCompatibility.js"></script>
     
     <!-- Generated bundles -->
     <script src="js/bundles/transforms-bundle.js"></script>
     <script src="js/core/spellingAlphabetTransform.js"></script>
     <script src="js/core/customSpellingAlphabets.js"></script>
+    <script src="js/core/transformApplyMode.js"></script>
     <script src="js/core/transformRecipeStages.js"></script>
     <script src="js/core/transformChains.js"></script>
     
     <!-- Glitch Tokens Data -->
     <script src="js/data/glitchTokens.js"></script>
     <script src="js/data/endSequences.js"></script>
     <script src="js/data/openrouterModels.js"></script>
     <script src="js/data/anticlassifierPrompt.js"></script>
     <script src="js/data/latinAffixPolicies.js"></script>
     
diff --git a/js/core/transformApplyMode.js b/js/core/transformApplyMode.js
new file mode 100644
index 0000000..372ab2b
--- /dev/null
+++ b/js/core/transformApplyMode.js
@@ -0,0 +1,66 @@
+(function(global) {
+    var STORAGE_KEY = 'transform-encode-decode-mode';
+
+    function normalizeMode(value) {
+        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
+    }
+
+    function loadMode(storage) {
+        try {
+            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
+        } catch (e) {
+            return 'encode';
+        }
+    }
+
+    function saveMode(storage, mode) {
+        try {
+            if (storage && typeof storage.setItem === 'function') {
+                storage.setItem(STORAGE_KEY, normalizeMode(mode));
+            }
+        } catch (e) { /* ignore quota */ }
+    }
+
+    function isMechanicallyReversible(transform) {
+        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
+    }
+
+    /**
+     * @returns {'encode'|'reverse'|'ai_decode'}
+     */
+    function resolveAction(transform, mode) {
+        if (!transform) return 'encode';
+        if (normalizeMode(mode) !== 'decode') return 'encode';
+        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
+    }
+
+    function describeForAiDecode(transform, chainsApi) {
+        if (!transform) return 'Unknown transform';
+        if (chainsApi && transform.isChain && transform.chainId) {
+            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
+                .filter(function(c) { return c.id === transform.chainId; })[0];
+            if (chain && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(chain, 'chain');
+            }
+        }
+        if (chainsApi && transform.isCycle && transform.cycleId) {
+            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
+                .filter(function(c) { return c.id === transform.cycleId; })[0];
+            if (cycle && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(cycle, 'cycle');
+            }
+        }
+        var bits = [transform.name || 'Transform'];
+        if (transform.description) bits.push(transform.description);
+        return bits.join(' — ');
+    }
+
+    global.TransformApplyMode = {
+        STORAGE_KEY: STORAGE_KEY,
+        normalizeMode: normalizeMode,
+        loadMode: loadMode,
+        saveMode: saveMode,
+        resolveAction: resolveAction,
+        describeForAiDecode: describeForAiDecode
+    };
+})(typeof window !== 'undefined' ? window : this);
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 13e1f76..09e7bc7 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -297,21 +297,21 @@
             if (!global.QRCode || typeof global.QRCode.toDataURL !== 'function') {
                 return Promise.reject(new Error('QR library not loaded. Rebuild the app (npm run build).'));
             }
             var widthValue = options.width != null ? options.width : options.size;
             var marginValue = options.margin != null ? options.margin : 2;
             return global.QRCode.toDataURL(String(text), {
                 width: clampNumber(widthValue, 256, 128, 1024),
                 margin: clampNumber(marginValue, 2, 0, 20),
                 errorCorrectionLevel: options.errorCorrectionLevel || options.ecl || 'M'
             }).then(function(dataUrl) {
-                return { kind: 'image', value: dataUrl };
+                return { kind: 'image', value: dataUrl, text: String(text) };
             });
         }
         if (carrierNode.type === 'emoji_stego') {
             if (!global.steganography || typeof global.steganography.encodeEmoji !== 'function') {
                 return Promise.reject(new Error('Emoji steganography library not loaded.'));
             }
             var carrierEmoji = options.carrierEmoji || options.carrier || carrierNode.carrierEmoji || '🐍';
             return Promise.resolve().then(function() {
                 return {
                     kind: 'text',
diff --git a/js/tools/TransformTool.js b/js/tools/TransformTool.js
index c4a7d9c..e361a1f 100644
--- a/js/tools/TransformTool.js
+++ b/js/tools/TransformTool.js
@@ -36,21 +36,25 @@ class TransformTool extends Tool {
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
@@ -548,35 +552,21 @@ class TransformTool extends Tool {
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
@@ -889,20 +879,30 @@ class TransformTool extends Tool {
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
@@ -1113,124 +1113,147 @@ class TransformTool extends Tool {
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
                         }
+                        const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
+                        const text = await window.TransformChains.aiDecode(recipe, input, {
+                            model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
+                        });
+                        result = { kind: 'text', value: text };
+                    } else if (action === 'reverse') {
+                        if (typeof transform.reverse !== 'function') {
+                            throw new Error('No reverse function available.');
+                        }
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
@@ -1481,20 +1504,21 @@ class TransformTool extends Tool {
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
diff --git a/package.json b/package.json
index 057e39f..63cc11a 100644
--- a/package.json
+++ b/package.json
@@ -14,21 +14,22 @@
     "build": "npm run build:tools && npm run build:codes-vendor && npm run build:copy && npm run build:index && npm run build:transforms && npm run build:emoji && npm run build:templates",
     "start": "serve dist -l 8080",
     "preview": "npm run build && serve dist -l 8080",
     "test": "node tests/test_universal.js",
     "test:lexeme": "node tests/test_lexeme_analysis.js",
     "test:lexeme-ui": "node tests/test_lexeme_ui_surface.js",
     "test:universal": "node tests/test_universal.js",
     "test:steg": "node tests/test_steganography_options.js",
     "test:chains": "node tests/test_transform_chains.js",
     "test:recipes": "node tests/test_transform_recipes.js",
-    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes",
+    "test:apply-mode": "node tests/test_transform_apply_mode.js",
+    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes && npm run test:apply-mode",
     "precommit": "npm run test:all"
   },
   "repository": {
     "type": "git",
     "url": "."
   },
   "keywords": [
     "encoder",
     "decoder",
     "steganography",
diff --git a/templates/transforms.html b/templates/transforms.html
index a7b9115..76e44de 100644
--- a/templates/transforms.html
+++ b/templates/transforms.html
@@ -1,33 +1,79 @@
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
 
+                    <div class="output-section" v-if="transformOutput || transformOutputImage">
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
+                                :src="transformOutputImage"
+                                :alt="activeTransform ? activeTransform.name + ' image output' : 'Transformed image output'"
+                                class="transform-image-output"
+                            >
+                            <textarea
+                                v-if="transformOutputKind !== 'image'"
+                                readonly
+                                v-model="transformOutput"
+                                aria-label="Transform output text"
+                            ></textarea>
+                            <p v-else-if="transformOutput" class="transform-image-output-text">{{ transformOutput }}</p>
+                            <button v-if="transformOutput" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
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
@@ -139,35 +185,32 @@
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
@@ -708,50 +751,20 @@
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
diff --git a/tests/test_transform_apply_mode.js b/tests/test_transform_apply_mode.js
new file mode 100644
index 0000000..e2ab410
--- /dev/null
+++ b/tests/test_transform_apply_mode.js
@@ -0,0 +1,42 @@
+#!/usr/bin/env node
+const assert = require('assert');
+const path = require('path');
+const fs = require('fs');
+const vm = require('vm');
+
+function load(rel) {
+    const ctx = { console, window: null };
+    ctx.window = ctx;
+    vm.createContext(ctx);
+    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), ctx, { filename: rel });
+    return ctx;
+}
+
+const ctx = load('js/core/transformApplyMode.js');
+const M = ctx.TransformApplyMode;
+assert.ok(M, 'TransformApplyMode global');
+
+assert.strictEqual(M.normalizeMode('decode'), 'decode');
+assert.strictEqual(M.normalizeMode('ENCODE'), 'encode');
+assert.strictEqual(M.normalizeMode('nope'), 'encode');
+
+const store = Object.create(null);
+const storage = {
+    getItem: (k) => (k in store ? store[k] : null),
+    setItem: (k, v) => { store[k] = String(v); }
+};
+assert.strictEqual(M.loadMode(storage), 'encode');
+M.saveMode(storage, 'decode');
+assert.strictEqual(store[M.STORAGE_KEY], 'decode');
+assert.strictEqual(M.loadMode(storage), 'decode');
+
+const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
+const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
+assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
+assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
+assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
+assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');
+
+assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);
+
+console.log('test_transform_apply_mode: OK');
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index def276f..deadd48 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -225,21 +225,21 @@ TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
             qrCalls.push({ text, options });
             return Promise.resolve('data:image/png;base64,mocked');
         }
     };
     return TC.applyCarrier({
         type: 'qr',
         options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
     }, 'secret').then((qrResult) => {
         assert.deepStrictEqual(
             JSON.parse(JSON.stringify(qrResult)),
-            { kind: 'image', value: 'data:image/png;base64,mocked' }
+            { kind: 'image', value: 'data:image/png;base64,mocked', text: 'secret' }
         );
         assert.deepStrictEqual(
             JSON.parse(JSON.stringify(qrCalls)),
             [{
                 text: 'secret',
                 options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
             }]
         );
 
         const emojiCalls = [];
@@ -275,26 +275,52 @@ TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
             };
             return TC.runStagedRecipeAsync(qrRecipe, 'Hello').then((result) => ({
                 result,
                 qrCalls
             }));
         });
     });
 }).then(({ result, qrCalls }) => {
     assert.deepStrictEqual(
         JSON.parse(JSON.stringify(result)),
-        { kind: 'image', value: 'data:image/png;base64,mocked' },
+        { kind: 'image', value: 'data:image/png;base64,mocked', text: 'Khoor' },
         'runner applies the carrier after text transforms'
     );
     assert.deepStrictEqual(
         JSON.parse(JSON.stringify(qrCalls[1])),
         {
             text: 'Khoor',
             options: { width: 256, margin: 2, errorCorrectionLevel: 'M' }
         },
         'QR receives transformed text and CodesTool defaults'
     );
+    ctx.QRCode = {
+        toDataURL: function(text) {
+            return Promise.resolve('data:image/png;base64,STUB');
+        }
+    };
+    const recipeWithQr = {
+        name: 'QR Demo',
+        kind: 'staged',
+        stages: {
+            normalize: null,
+            translate: null,
+            obfuscate: [{ transform: 'base64', options: {} }],
+            present: null,
+            conceal: null,
+            carrier: { type: 'qr', options: {} }
+        }
+    };
+    TC.saveRecipe(recipeWithQr);
+    return TC.runStagedRecipeAsync(
+        TC.loadChains().filter(c => c.name === 'QR Demo')[0] || recipeWithQr,
+        'hi'
+    );
+}).then(function(result) {
+    assert.strictEqual(result.kind, 'image');
+    assert.ok(result.value.indexOf('data:image') === 0);
+    assert.strictEqual(result.text, 'aGk=');
     console.log('test_transform_recipes: OK');
 }).catch((err) => {
     console.error(err);
     process.exitCode = 1;
 });
