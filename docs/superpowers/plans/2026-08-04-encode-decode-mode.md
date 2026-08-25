# Encode/Decode Mode + Output Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Encode/Decode switch by the Transforms input so every transform and recipe click runs in that mode, shows text in an Output field under the Input, and copies text to the clipboard (Copy History).

**Architecture:** Keep apply logic centralized in `TransformTool.applyActiveTransformOutput` / `applyTransform`. Add a tiny pure helper for mode → action resolution (`encode` | `reverse` | `ai_decode`). Move the existing output UI under the input; extend carrier results so QR can return image **and** underlying text. AI fallback reuses `TransformChains.aiDecode` with a recipe description for chains/cycles or a single-transform description.

**Tech Stack:** Vanilla JS + Vue 2 (existing), `localStorage`, Node `vm` tests, `npm run build` / `build:templates`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md`
- Recipes must use the same click path as other transforms (category tiles).
- Text results always appear in Output under Input **and** are copied to clipboard on explicit apply/click (not on every keystroke of auto-transform).
- Decode + irreversible → AI decode into Output + clipboard; missing AI → Settings toast.
- Live `@input` auto-transform updates Output only (no clipboard spam).
- Conventional commits (`feat`, `fix`, `test`, `docs`).
- After template edits: `npm run build:templates` or full `npm run build`.
- Do not redesign Copy History panel UI.

## File Map

| File | Responsibility |
|------|----------------|
| `js/core/transformApplyMode.js` | Pure helpers: load/save mode, resolve apply action, describe transform for AI decode |
| `js/core/transformChains.js` | QR carrier returns `{ kind:'image', value, text }`; export helpers if needed |
| `js/tools/TransformTool.js` | Mode state, apply encode/reverse/ai paths, output text+image fields, mode-flip recompute |
| `templates/transforms.html` | Encode/Decode switch, Output under Input, demote manager Apply |
| `css/style.css` | Mode switch + under-input output styles |
| `tests/test_transform_apply_mode.js` | Mode resolve + carrier text payload |
| `package.json` | Wire `test:apply-mode` into `test:all` |
| `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md` | Already approved; link from README if transforms docs mention usage |

---

### Task 1: Pure mode helper + tests

**Files:**
- Create: `js/core/transformApplyMode.js`
- Create: `tests/test_transform_apply_mode.js`
- Modify: `package.json` (scripts)
- Modify: `index.template.html` (add `<script src="js/core/transformApplyMode.js"></script>` immediately before `transformRecipeStages.js`)

**Interfaces:**
- Consumes: none (pure)
- Produces:
  - `TransformApplyMode.STORAGE_KEY` → `'transform-encode-decode-mode'`
  - `TransformApplyMode.normalizeMode(value)` → `'encode' | 'decode'`
  - `TransformApplyMode.loadMode(storage)` → `'encode' | 'decode'`
  - `TransformApplyMode.saveMode(storage, mode)` → void
  - `TransformApplyMode.resolveAction(transform, mode)` → `'encode' | 'reverse' | 'ai_decode'`
  - `TransformApplyMode.describeForAiDecode(transform, chainsApi)` → `string`

- [ ] **Step 1: Write the failing test**

Create `tests/test_transform_apply_mode.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function load(rel) {
    const ctx = { console, window: null };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), ctx, { filename: rel });
    return ctx;
}

const ctx = load('js/core/transformApplyMode.js');
const M = ctx.TransformApplyMode;
assert.ok(M, 'TransformApplyMode global');

assert.strictEqual(M.normalizeMode('decode'), 'decode');
assert.strictEqual(M.normalizeMode('ENCODE'), 'encode');
assert.strictEqual(M.normalizeMode('nope'), 'encode');

const store = Object.create(null);
const storage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
};
assert.strictEqual(M.loadMode(storage), 'encode');
M.saveMode(storage, 'decode');
assert.strictEqual(store[M.STORAGE_KEY], 'decode');
assert.strictEqual(M.loadMode(storage), 'decode');

const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');

assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);

console.log('test_transform_apply_mode: OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_transform_apply_mode.js`  
Expected: FAIL (cannot find module / TransformApplyMode undefined)

- [ ] **Step 3: Write minimal implementation**

Create `js/core/transformApplyMode.js`:

```javascript
(function(global) {
    var STORAGE_KEY = 'transform-encode-decode-mode';

    function normalizeMode(value) {
        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
    }

    function loadMode(storage) {
        try {
            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
        } catch (e) {
            return 'encode';
        }
    }

    function saveMode(storage, mode) {
        try {
            if (storage && typeof storage.setItem === 'function') {
                storage.setItem(STORAGE_KEY, normalizeMode(mode));
            }
        } catch (e) { /* ignore quota */ }
    }

    function isMechanicallyReversible(transform) {
        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
    }

    /**
     * @returns {'encode'|'reverse'|'ai_decode'}
     */
    function resolveAction(transform, mode) {
        if (!transform) return 'encode';
        if (normalizeMode(mode) !== 'decode') return 'encode';
        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
    }

    function describeForAiDecode(transform, chainsApi) {
        if (!transform) return 'Unknown transform';
        if (chainsApi && transform.isChain && transform.chainId) {
            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
                .filter(function(c) { return c.id === transform.chainId; })[0];
            if (chain && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(chain, 'chain');
            }
        }
        if (chainsApi && transform.isCycle && transform.cycleId) {
            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
                .filter(function(c) { return c.id === transform.cycleId; })[0];
            if (cycle && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(cycle, 'cycle');
            }
        }
        var bits = [transform.name || 'Transform'];
        if (transform.description) bits.push(transform.description);
        return bits.join(' — ');
    }

    global.TransformApplyMode = {
        STORAGE_KEY: STORAGE_KEY,
        normalizeMode: normalizeMode,
        loadMode: loadMode,
        saveMode: saveMode,
        resolveAction: resolveAction,
        describeForAiDecode: describeForAiDecode
    };
})(typeof window !== 'undefined' ? window : this);
```

In `index.template.html`, add before the recipe/chains scripts:

```html
<script src="js/core/transformApplyMode.js"></script>
<script src="js/core/transformRecipeStages.js"></script>
<script src="js/core/transformChains.js"></script>
```

Add to `package.json`:

```json
"test:apply-mode": "node tests/test_transform_apply_mode.js",
"test:all": "... existing ... && npm run test:apply-mode"
```

(Keep existing `test:all` segments; append `&& npm run test:apply-mode`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/test_transform_apply_mode.js`  
Expected: `test_transform_apply_mode: OK`

Run: `npm run test:all`  
Expected: exit 0 (or at least apply-mode + recipes/chains still OK)

- [ ] **Step 5: Commit**

```bash
git add js/core/transformApplyMode.js tests/test_transform_apply_mode.js package.json index.template.html
git commit -m "$(cat <<'EOF'
feat: add transform encode/decode mode helper

EOF
)"
```

---

### Task 2: Carrier results include underlying text

**Files:**
- Modify: `js/core/transformChains.js` (`applyCarrier` QR return)
- Modify: `tests/test_transform_recipes.js` (assert QR-shaped result includes `text` when tested; if no QR lib in vm, unit-test a small exported shape helper **or** assert documentation via a focused assert on `applyCarrier` with stubbed `QRCode`)

**Interfaces:**
- Consumes: existing `applyCarrier(carrierNode, text)`
- Produces: QR success → `{ kind: 'image', value: dataUrl, text: String(text) }`; emoji stego unchanged `{ kind:'text', value }`

- [ ] **Step 1: Extend recipe tests with stubbed QR**

In `tests/test_transform_recipes.js`, after chains load, add:

```javascript
ctx.QRCode = {
    toDataURL: function(text) {
        return Promise.resolve('data:image/png;base64,STUB');
    }
};
const recipeWithQr = {
    name: 'QR Demo',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [{ transform: 'base64', options: {} }],
        present: null,
        conceal: null,
        carrier: { type: 'qr', options: {} }
    }
};
// save + run async
return TC.runStagedRecipeAsync(
    TC.loadChains().filter(c => c.name === 'QR Demo')[0] || recipeWithQr,
    'hi'
).then(function(result) {
    assert.strictEqual(result.kind, 'image');
    assert.ok(result.value.indexOf('data:image') === 0);
    assert.strictEqual(result.text, 'aGk='); // base64 of "hi" — adjust if encode differs
    console.log('test_transform_recipes: OK');
});
```

If the file is currently sync-only at the end, convert the QR assertion block to the final async section **or** save the recipe first with `TC.saveRecipe` then `runStagedRecipeAsync` on the loaded record. Match existing base64 encoding used by `ctx.transforms.base64` in that test file (stub `func` if needed).

If `base64` in the test harness is only a stub without `func`, set:

```javascript
ctx.transforms.base64.func = function(text) {
    return Buffer.from(String(text), 'utf8').toString('base64');
};
```

before the async run.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_transform_recipes.js`  
Expected: FAIL on missing `result.text` (or recipe save / async path)

- [ ] **Step 3: Implement QR text payload**

In `js/core/transformChains.js` `applyCarrier`, change the QR `.then` to:

```javascript
.then(function(dataUrl) {
    return { kind: 'image', value: dataUrl, text: String(text) };
});
```

- [ ] **Step 4: Run tests**

Run: `node tests/test_transform_recipes.js`  
Expected: pass including QR text assertion

- [ ] **Step 5: Commit**

```bash
git add js/core/transformChains.js tests/test_transform_recipes.js
git commit -m "$(cat <<'EOF'
feat: include underlying text with QR carrier results

EOF
)"
```

---

### Task 3: Encode/Decode switch UI + Output under Input

**Files:**
- Modify: `js/tools/TransformTool.js` (data: `transformIoMode`, init from `TransformApplyMode.loadMode`)
- Modify: `templates/transforms.html` (switch + move output block)
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `TransformApplyMode.loadMode` / `saveMode` / `normalizeMode`
- Produces: Vue state `transformIoMode: 'encode'|'decode'`; method `setTransformIoMode(mode)`

- [ ] **Step 1: Add state + setter in TransformTool data/methods**

In the tool’s `data()` (or equivalent initial state object), add:

```javascript
transformIoMode: (window.TransformApplyMode
    ? window.TransformApplyMode.loadMode(localStorage)
    : 'encode'),
transformOutputText: '', // optional alias — see Step 3 if keeping transformOutput
```

Add methods:

```javascript
setTransformIoMode: function(mode) {
    if (!window.TransformApplyMode) return;
    const next = window.TransformApplyMode.normalizeMode(mode);
    if (next === this.transformIoMode) return;
    this.transformIoMode = next;
    window.TransformApplyMode.saveMode(localStorage, next);
    if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
        this.applyTransform(this.activeTransform);
    }
},
```

(Mode flip uses full `applyTransform` so clipboard updates on intentional mode change with active selection.)

- [ ] **Step 2: Template — switch above input; Output directly under input**

Near the top of `templates/transforms.html`, inside `.input-section` (or wrapping it), add:

```html
<div class="transform-io-mode" role="group" aria-label="Encode or decode">
    <button
        type="button"
        class="transform-io-mode-btn"
        :class="{ active: transformIoMode === 'encode' }"
        @click="setTransformIoMode('encode')"
    >Encode</button>
    <button
        type="button"
        class="transform-io-mode-btn"
        :class="{ active: transformIoMode === 'decode' }"
        @click="setTransformIoMode('decode')"
    >Decode</button>
</div>
```

Update input placeholders:

```html
:placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
```

**Move** the existing `.output-section` block (currently below the transform button grid) to sit **immediately under** the input control(s), still inside the left column / `.transform-layout` flow before filters/buttons.

Output section should show:

- Textarea bound to text output when present
- Image when `transformOutputKind === 'image'`
- **Both** when image + text: show image and the text textarea (`v-if` text when `transformOutput` text non-empty OR dedicated `transformOutputText`)

Suggested binding after Task 4 wiring:

```html
<div class="output-section" v-if="transformOutput || transformOutputKind === 'image'">
  <div class="output-heading">
    <h4>
      <i class="fas fa-check-circle"></i>
      {{ transformIoMode === 'decode' ? 'Decoded' : 'Transformed' }} Message
      <small v-if="activeTransform">({{ activeTransform.name }})</small>
    </h4>
  </div>
  <div class="output-container">
    <img v-if="transformOutputKind === 'image' && transformOutputImage" :src="transformOutputImage" class="transform-image-output" alt="" />
    <textarea v-if="transformOutput" readonly v-model="transformOutput" aria-label="Transform output text"></textarea>
    <button v-if="transformOutput" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
      <i class="fas fa-copy"></i>
    </button>
  </div>
</div>
```

Until Task 4 lands image split fields, keep current `transformOutput`/`transformOutputKind` behavior but **relocate** the markup.

- [ ] **Step 3: CSS for mode switch**

Add minimal styles reusing existing button tokens:

```css
.transform-io-mode {
    display: inline-flex;
    margin-bottom: 0.5rem;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    overflow: hidden;
}
.transform-io-mode-btn {
    border: 0;
    background: transparent;
    color: var(--text-color);
    padding: 0.4rem 0.9rem;
    cursor: pointer;
}
.transform-io-mode-btn.active {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
    font-weight: 600;
}
.transform-layout .input-section + .output-section {
    margin-top: 0.75rem;
}
```

- [ ] **Step 4: Build templates and smoke-check**

Run: `npm run build:templates`  
Expected: success

Manually open Transforms tab: switch visible above input; output block under input (may be empty until a transform runs).

- [ ] **Step 5: Commit**

```bash
git add js/tools/TransformTool.js templates/transforms.html css/style.css
git commit -m "$(cat <<'EOF'
feat: add Encode/Decode switch and move output under input

EOF
)"
```

---

### Task 4: Apply path — encode / reverse / AI decode + clipboard

**Files:**
- Modify: `js/tools/TransformTool.js` (`applyActiveTransformOutput`, `applyTransform`, remove/demote empty-input recipe-only messaging)

**Interfaces:**
- Consumes: `TransformApplyMode.resolveAction`, `describeForAiDecode`, `TransformChains.aiDecode`, `transform.reverse`, staged async encode
- Produces: filled `transformOutput` (text), optional `transformOutputImage`, clipboard via `forceCopyToClipboard` on click/mode-flip apply only

- [ ] **Step 1: Extend output state fields**

Add to tool state:

```javascript
transformOutputImage: '',
```

When applying results:

```javascript
// text always in transformOutput when available
// images in transformOutputImage; transformOutputKind 'image' | 'text'
```

- [ ] **Step 2: Rewrite `applyActiveTransformOutput` action switch**

Core logic (integrate into existing generation/stale guards):

```javascript
applyActiveTransformOutput: async function(options) {
    const generation = ++this.transformApplyGeneration;
    const transform = this.activeTransform;
    const input = this.transformInput;
    const preserveEmojis = !!(options && options.preserveEmojis);
    const copyOnSuccess = !!(options && options.copyOnSuccess);

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

    try {
        let result = { kind: 'text', value: '' };

        if (action === 'ai_decode') {
            if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
                || !window.AIProvider.getConfiguredProviders().length) {
                throw new Error('Configure an AI provider in Settings to decode this transform.');
            }
            const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
            const text = await window.TransformChains.aiDecode(recipe, input, {
                model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
            });
            result = { kind: 'text', value: text };
        } else if (action === 'reverse') {
            if (typeof transform.reverse !== 'function') {
                throw new Error('No reverse function available.');
            }
            result = { kind: 'text', value: String(transform.reverse(input, opts) || '') };
        } else if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
            result = await window.TransformChains.runStagedRecipeAsync(stagedRecipe, input, opts);
        } else if (preserveEmojis) {
            // existing emoji-preserving encode path using transform.func
            const segments = window.EmojiUtils.splitEmojis(input);
            const value = window.EmojiUtils.joinEmojis(segments.map(segment => {
                if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
                    return segment;
                }
                return transform.func(segment, opts);
            }));
            result = { kind: 'text', value };
        } else {
            result = { kind: 'text', value: transform.func(input, opts) };
        }

        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
            return { applied: false, stale: true };
        }

        if (result && result.kind === 'image') {
            this.transformOutputKind = 'image';
            this.transformOutputImage = result.value != null ? String(result.value) : '';
            this.transformOutput = result.text != null ? String(result.text) : '';
        } else {
            this.transformOutputKind = 'text';
            this.transformOutputImage = '';
            this.transformOutput = result && result.value != null ? String(result.value) : '';
        }

        if (copyOnSuccess && this.transformOutput) {
            this.isTransformCopy = true;
            this.forceCopyToClipboard(this.transformOutput);
        }

        return { applied: true, kind: this.transformOutputKind };
    } catch (e) {
        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
            return { applied: false, stale: true };
        }
        this.transformOutputKind = 'text';
        this.transformOutput = '';
        this.transformOutputImage = '';
        this.showNotification(
            (e && e.message) ? e.message : (transform.name + ' failed.'),
            'error',
            'fas fa-exclamation-triangle'
        );
        return { applied: false, error: e };
    }
},
```

- [ ] **Step 3: Update `applyTransform` to always use shared path**

```javascript
applyTransform: async function(transform, event) {
    event && event.preventDefault();
    event && event.stopPropagation();
    if (transform && transform.name === 'Random Mix') {
        this.triggerRandomizerChaos();
    }
    if (!transform) return;

    this.activeTransform = transform;

    if (!this.transformInput) {
        this.showNotification('Enter text in the input box, then click the transform again.', 'info', 'fas fa-keyboard');
        const inputBox = document.querySelector('#transform-input');
        if (inputBox) this.focusWithoutScroll(inputBox);
        return;
    }

    this.saveLastUsedTransform(transform.name);
    const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
    if (!outcome.applied) return;

    // Keep existing Random Mix / success toast behavior for non-AI failures already handled
    if (transform.name !== 'Random Mix') {
        const message = this.transformOutputKind === 'image' && !this.transformOutput
            ? transform.name + ' image preview ready!'
            : transform.name + (this.transformIoMode === 'decode' ? ' decoded and copied!' : ' applied and copied!');
        this.showNotification(message, 'success', 'fas fa-check');
    }

    // existing focus / active-button cleanup
},
```

Ensure `autoTransform` calls `applyActiveTransformOutput({ preserveEmojis: true })` **without** `copyOnSuccess`.

- [ ] **Step 4: Demote manager Apply**

In `templates/transforms.html` recipe list actions: remove the prominent Apply button **or** keep a quiet icon that calls `applySavedChain` → `applyTransform` (same path). Prefer remove to avoid two primary verbs.

Update leftover copy that says “use Apply on the list”.

- [ ] **Step 5: Manual verification checklist + commit**

Verify locally after `npm run build:templates`:

1. Encode + Caesar click → Output under input + Copy History entry  
2. Decode + Caesar click on cipher text → plaintext in Output + history  
3. Decode + irreversible recipe with AI configured → AI result in Output + history  
4. Decode + irreversible without AI → Settings toast  
5. Typing with active transform updates Output only (no history flood)

```bash
git add js/tools/TransformTool.js templates/transforms.html
git commit -m "$(cat <<'EOF'
feat: apply transforms in Encode/Decode mode with shared output path

EOF
)"
```

---

### Task 5: Docs + final verification

**Files:**
- Modify: `README.md` (short Transforms note: Encode/Decode switch, Output under input, recipes click like other methods)
- Modify: `docs/TOOL_ARCHITECTURE.md` only if it documents transform apply flow

- [ ] **Step 1: Document user-facing behavior**

Add a short README bullet under Transforms:

```markdown
- **Encode / Decode** toggle above the input: every transform and saved recipe runs in that mode. Results show in the Output field under the input and are copied to the clipboard (Copy History). Irreversible methods use AI decode when Decode is selected.
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test:all`  
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add README.md docs/TOOL_ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
docs: document Encode/Decode transform mode

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Global Encode/Decode near input + persist | Task 1 + 3 |
| Click transform/recipe → Output + clipboard | Task 4 |
| Output under Input | Task 3 |
| Text always in Output | Task 4 |
| Decode + reverse | Task 1 resolve + Task 4 |
| Decode + AI fallback | Task 4 |
| AI missing → Settings toast | Task 4 |
| Mode flip re-run | Task 3 `setTransformIoMode` |
| Live typing respects mode, Output only | Task 4 `autoTransform` without copy |
| QR image + underlying text | Task 2 + 4 |
| Demote manager Apply | Task 4 |
| Recipes same as other methods | Task 4 (shared `applyTransform`) |

## Placeholder / consistency self-review

- No TBD steps; script load path must mirror `transformRecipeStages.js` exactly in Task 1.
- `transformOutputImage` introduced in Task 4; Task 3 template may temporarily use existing fields then align in Task 4.
- `copyOnSuccess` distinguishes click/mode-flip from auto-transform.
- `resolveAction` / `describeForAiDecode` names consistent across tasks.
