# Staged Transform Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-form-first Transform Chains UX with typed stage-rail recipes (templates as shortcuts), optional Translate + Carrier stages, cycle word-safe vs one-way modes, while keeping free-form as a marked legacy escape hatch.

**Architecture:** Keep persistence/registration patterns from `js/core/transformChains.js`. Add staged recipe schema (`kind: "staged"`) with stage allowlists and runners in core; wire Translate via AIProvider and Carrier via existing QR / `steganography.js` adapters. Vue UI in `TransformTool.js` + `templates/transforms.html` defaults to staged builder; free-form behind `LEGACY_FREEFORM_BUILDER`.

**Tech Stack:** Vanilla JS + Vue 2 (existing), `localStorage`, Node `vm` tests, static `dist/` via `npm run build`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-staged-transform-recipes-design.md`
- No new app tab — Recipes/Chains stay on the Transform tab.
- Do not nest saved chains/cycles/recipes inside Obfuscate/Present nodes.
- Prefer rematching by `transformKey`, not display `name`.
- Do not wipe `transform-chains-v1` / `transform-cycles-v1`.
- Opaque-token cycles (Future B) are out of scope — document only.
- Mark free-form paths `@legacy` / `LEGACY_FREEFORM_*` for possible removal.
- Conventional commits (`feat`, `fix`, `test`, `docs`).
- After template edits: `npm run build:templates` or full `npm run build`.
- Carrier is terminal; never offer a stage after Carrier in the staged builder.

## File Map

| File | Responsibility |
|------|----------------|
| `js/core/transformRecipeStages.js` | Stage ids, allowlists, `validateStagedRecipe`, `flattenStagedToNodes`, template defs |
| `js/core/transformChains.js` | CRUD for staged+legacy, run pipeline hooks, cycle `mode`, registration, describe/AI decode extensions, `@legacy` markers |
| `js/tools/TransformTool.js` | Staged builder state/methods, templates, legacy toggle, cycle mode checkbox, carrier preview |
| `templates/transforms.html` | Stage rail UI, template chips, legacy toggle, cycle mode |
| `css/style.css` | Minimal stage-rail styles reusing chain-* patterns |
| `tests/test_transform_recipes.js` | Stage validation, flatten/run order, cycle modes, legacy load |
| `package.json` | Wire `test:recipes` into `test:all` |
| `README.md` / `docs/TOOL_ARCHITECTURE.md` | User + architecture notes for staged recipes |

---

### Task 1: Stage taxonomy module (allowlists + validation)

**Files:**
- Create: `js/core/transformRecipeStages.js`
- Test: `tests/test_transform_recipes.js`
- Modify: `package.json` (add `test:recipes`; append to `test:all`)
- Modify: `index.template.html` (script tag for `transformRecipeStages.js` **before** `transformChains.js`)

**Interfaces:**
- Produces:
  - `window.TransformRecipeStages.STAGE_ORDER` = `['normalize','translate','obfuscate','present','conceal','carrier']`
  - `isTransformAllowedInStage(stageId, transformKey, transformsMap) → boolean`
  - `validateStagedRecipe(recipe, transformsMap) → string|null` (error message or null if ok)
  - `flattenStagedToNodes(recipe) → Array<{transform, options}|{type:'translate',...}|{type:'qr'|'emoji_stego',...}>`
  - `TEMPLATES` — array of `{ id, name, stages }`

- [ ] **Step 1: Write failing tests**

Create `tests/test_transform_recipes.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function createContext() {
    const store = Object.create(null);
    const ctx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            _store: store
        }
    };
    ctx.window = ctx;
    return ctx;
}

function load(ctx, rel) {
    const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
}

const ctx = createContext();
vm.createContext(ctx);
ctx.transforms = {
    caesar: { name: 'Caesar', category: 'cipher', canDecode: true },
    base64: { name: 'Base64', category: 'encoding', canDecode: true },
    theban: { name: 'Theban', category: 'symbol', canDecode: true },
    bold: { name: 'Bold', category: 'unicode', canDecode: true },
    zero_width: { name: 'Zero-Width', category: 'concealment', canDecode: true },
    title_case: { name: 'Title Case', category: 'case', canDecode: true }
};
load(ctx, 'js/core/transformRecipeStages.js');
const S = ctx.TransformRecipeStages;
assert.ok(S, 'TransformRecipeStages global');

assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'caesar', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'theban', ctx.transforms), false);
assert.strictEqual(S.isTransformAllowedInStage('present', 'theban', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('normalize', 'title_case', ctx.transforms), true);

assert.strictEqual(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: { obfuscate: [], present: null, translate: null, normalize: null, conceal: null, carrier: null }
}, ctx.transforms), 'Add at least one obfuscate step.');

assert.strictEqual(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'theban', options: {} }],
        present: null, translate: null, normalize: null, conceal: null, carrier: null
    }
}, ctx.transforms) != null, 'theban not allowed in obfuscate');

assert.strictEqual(S.validateStagedRecipe({
    name: 'Good',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        translate: null, normalize: null, conceal: null,
        carrier: { type: 'qr', options: {} }
    }
}, ctx.transforms), null);

const flat = S.flattenStagedToNodes({
    stages: {
        translate: { type: 'translate', lang: 'la', model: 'm' },
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null, normalize: null, conceal: null,
        carrier: { type: 'emoji_stego', options: { carrier: '😀' } }
    }
});
assert.strictEqual(flat[0].type, 'translate');
assert.strictEqual(flat[1].transform, 'caesar');
assert.strictEqual(flat[flat.length - 1].type, 'emoji_stego');

console.log('test_transform_recipes: OK');
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
node tests/test_transform_recipes.js
```

Expected: cannot find module / `TransformRecipeStages` undefined.

- [ ] **Step 3: Implement `js/core/transformRecipeStages.js`**

```javascript
(function(global) {
    'use strict';

    var STAGE_ORDER = ['normalize', 'translate', 'obfuscate', 'present', 'conceal', 'carrier'];

    // Categories / keys allowed per stage (extend carefully; prefer category buckets).
    var STAGE_TRANSFORM_CATEGORIES = {
        normalize: ['case', 'format'],
        obfuscate: ['cipher', 'encoding', 'technical'],
        present: ['symbol', 'unicode', 'visual', 'custom_spelling', 'signwriting'],
        conceal: ['concealment']
    };

    // Deny-list inside otherwise-allowed categories (lossy / unsuitable for recipes).
    var STAGE_DENY_KEYS = {
        normalize: { random_mix: true, shuffle_words: true },
        obfuscate: { random_mix: true },
        present: { random_mix: true },
        conceal: {}
    };

    // Extra allow keys even if category differs (empty initially).
    var STAGE_ALLOW_KEYS = {
        normalize: {},
        obfuscate: {},
        present: {},
        conceal: {}
    };

    function isRecord(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function isTransformAllowedInStage(stageId, transformKey, transformsMap) {
        if (stageId === 'translate' || stageId === 'carrier') return false;
        if (typeof transformKey !== 'string' || !transformKey) return false;
        if (transformKey.indexOf('chain_') === 0 || transformKey.indexOf('cycle_') === 0) return false;
        var t = transformsMap && transformsMap[transformKey];
        if (!t) return false;
        if (STAGE_DENY_KEYS[stageId] && STAGE_DENY_KEYS[stageId][transformKey]) return false;
        if (STAGE_ALLOW_KEYS[stageId] && STAGE_ALLOW_KEYS[stageId][transformKey]) return true;
        var cats = STAGE_TRANSFORM_CATEGORIES[stageId] || [];
        var cat = t.category || '';
        return cats.indexOf(cat) !== -1;
    }

    function validateStagedRecipe(recipe, transformsMap) {
        if (!isRecord(recipe) || typeof recipe.name !== 'string' || !recipe.name.trim()) {
            return 'Name is required.';
        }
        var stages = recipe.stages;
        if (!isRecord(stages)) return 'Invalid stages.';
        var ob = stages.obfuscate;
        if (!Array.isArray(ob) || ob.length === 0) {
            return 'Add at least one obfuscate step.';
        }
        var i;
        for (i = 0; i < ob.length; i++) {
            if (!isTransformAllowedInStage('obfuscate', ob[i] && ob[i].transform, transformsMap)) {
                return 'Transform not allowed in Obfuscate: ' + ((ob[i] && ob[i].transform) || '?');
            }
        }
        var multi = ['normalize', 'present', 'conceal'];
        for (i = 0; i < multi.length; i++) {
            var sid = multi[i];
            var nodes = stages[sid];
            if (nodes == null) continue;
            if (!Array.isArray(nodes)) return 'Invalid ' + sid + ' stage.';
            for (var j = 0; j < nodes.length; j++) {
                if (!isTransformAllowedInStage(sid, nodes[j] && nodes[j].transform, transformsMap)) {
                    return 'Transform not allowed in ' + sid + ': ' + ((nodes[j] && nodes[j].transform) || '?');
                }
            }
        }
        if (stages.translate != null) {
            if (!isRecord(stages.translate) || stages.translate.type !== 'translate') {
                return 'Invalid translate stage.';
            }
            if (!stages.translate.lang) return 'Translate stage needs a language.';
        }
        if (stages.carrier != null) {
            if (!isRecord(stages.carrier)) return 'Invalid carrier stage.';
            if (stages.carrier.type !== 'qr' && stages.carrier.type !== 'emoji_stego') {
                return 'Carrier must be qr or emoji_stego.';
            }
        }
        return null;
    }

    function flattenStagedToNodes(recipe) {
        var stages = (recipe && recipe.stages) || {};
        var out = [];
        function pushNodes(arr) {
            if (!Array.isArray(arr)) return;
            for (var i = 0; i < arr.length; i++) out.push(arr[i]);
        }
        pushNodes(stages.normalize);
        if (stages.translate) out.push(stages.translate);
        pushNodes(stages.obfuscate);
        pushNodes(stages.present);
        pushNodes(stages.conceal);
        if (stages.carrier) out.push(stages.carrier);
        return out;
    }

    var TEMPLATES = [
        {
            id: 'cipher-base64',
            name: 'Cipher → Base64',
            stages: {
                normalize: null,
                translate: null,
                obfuscate: [
                    { transform: 'caesar', options: { shift: 3 } },
                    { transform: 'base64', options: {} }
                ],
                present: null,
                conceal: null,
                carrier: null
            }
        },
        {
            id: 'translate-theban',
            name: 'Translate → Theban',
            stages: {
                normalize: null,
                translate: { type: 'translate', lang: 'la', model: '' },
                obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
                present: [{ transform: 'theban', options: {} }],
                conceal: null,
                carrier: null
            }
        },
        {
            id: 'cipher-qr',
            name: 'Cipher → Base64 → QR',
            stages: {
                normalize: null,
                translate: null,
                obfuscate: [
                    { transform: 'caesar', options: { shift: 3 } },
                    { transform: 'base64', options: {} }
                ],
                present: null,
                conceal: null,
                carrier: { type: 'qr', options: {} }
            }
        }
    ];

    global.TransformRecipeStages = {
        STAGE_ORDER: STAGE_ORDER,
        STAGE_TRANSFORM_CATEGORIES: STAGE_TRANSFORM_CATEGORIES,
        isTransformAllowedInStage: isTransformAllowedInStage,
        validateStagedRecipe: validateStagedRecipe,
        flattenStagedToNodes: flattenStagedToNodes,
        TEMPLATES: TEMPLATES
    };
})(typeof window !== 'undefined' ? window : this);
```

Tune allowlists if a category mapping is wrong for a specific key (add to `STAGE_ALLOW_KEYS` / `STAGE_DENY_KEYS`). Ensure `rot13` exists or change the translate-theban template obfuscate node to `caesar` if needed for tests.

- [ ] **Step 4: Wire script + npm**

In `index.template.html`, add before `transformChains.js`:

```html
<script src="js/core/transformRecipeStages.js"></script>
```

In `package.json`:

```json
"test:recipes": "node tests/test_transform_recipes.js",
"test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes"
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm run test:recipes
```

Expected: `test_transform_recipes: OK`

- [ ] **Step 6: Commit**

```bash
git add js/core/transformRecipeStages.js tests/test_transform_recipes.js package.json index.template.html
git commit -m "feat: add staged recipe stage taxonomy and validation"
```

---

### Task 2: Persist & register staged recipes in TransformChains

**Files:**
- Modify: `js/core/transformChains.js`
- Modify: `tests/test_transform_recipes.js` (add save/load/register cases)
- Keep: free-form `saveChain` marked `@legacy`

**Interfaces:**
- Consumes: `TransformRecipeStages.validateStagedRecipe`, `flattenStagedToNodes`
- Produces:
  - `saveRecipe(recipe) → id|null` where recipe has `kind:'staged'` and `stages`
  - `loadRecipes()` — returns staged recipes (may filter `kind==='staged'` from chain storage or dedicated key)
  - Storage strategy: **store staged recipes in `transform-chains-v1` with `kind:'staged'` and `stages` (no `nodes` required)**; legacy free-form keep `nodes` without kind or `kind:'freeform'`
  - `sanitizeChainRecord` updated to accept either shape
  - `registerChain` / sync: if staged, flatten + run via new runner (Task 3); for now flatten transform-only nodes for sync registration description

- [ ] **Step 1: Extend tests**

Append to `tests/test_transform_recipes.js` after loading both stage module and `transformChains.js`:

```javascript
load(ctx, 'js/core/transformChains.js');
const TC = ctx.TransformChains;

const rid = TC.saveRecipe({
    name: 'Staged Demo',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        conceal: null,
        carrier: null
    }
});
assert.ok(rid);
const loaded = TC.loadChains().filter(c => c.id === rid)[0];
assert.strictEqual(loaded.kind, 'staged');
assert.strictEqual(loaded.stages.obfuscate[0].transform, 'caesar');

assert.strictEqual(TC.saveRecipe({
    name: 'Bad',
    kind: 'staged',
    stages: { obfuscate: [{ transform: 'theban', options: {} }], present: null, translate: null, normalize: null, conceal: null, carrier: null }
}), null);
```

- [ ] **Step 2: Run — expect FAIL** on missing `saveRecipe`

- [ ] **Step 3: Implement `saveRecipe` / sanitize**

In `transformChains.js`:

```javascript
function sanitizeChainRecord(chain) {
    if (!isRecord(chain)) return null;
    if (typeof chain.id !== 'string' || !chain.id) return null;
    if (typeof chain.name !== 'string') return null;
    if (chain.kind === 'staged') {
        if (!isRecord(chain.stages)) return null;
        return Object.assign({}, chain, { kind: 'staged', stages: chain.stages });
    }
    // @legacy free-form
    if (!Array.isArray(chain.nodes)) return null;
    return Object.assign({}, chain, {
        kind: chain.kind || 'freeform',
        nodes: chain.nodes.filter(isValidPersistedNode)
    });
}

function saveRecipe(input) {
    lastMutationError = '';
    var stagesApi = global.TransformRecipeStages;
    if (!stagesApi) {
        lastMutationError = 'Staged recipes unavailable.';
        return null;
    }
    var rejection = stagesApi.validateStagedRecipe(input, global.transforms || {});
    if (rejection) {
        lastMutationError = rejection;
        return null;
    }
    var list = loadChains();
    var id = (input && input.id) || genId();
    var record = {
        id: id,
        name: String(input.name).trim(),
        kind: 'staged',
        stages: input.stages,
        createdAt: (input && input.createdAt) || Date.now(),
        updatedAt: Date.now()
    };
    var idx = list.findIndex(function(c) { return c.id === id; });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], record);
    else list.push(record);
    if (!writeList(CHAIN_STORAGE_KEY, list)) {
        lastMutationError = 'Could not write chains to browser storage.';
        return null;
    }
    syncTransforms();
    return id;
}
```

Export `saveRecipe` on `window.TransformChains`. Update `validateChainForSave` callers so free-form path is explicitly `@legacy`.

- [ ] **Step 4: Tests PASS**

```bash
npm run test:recipes
```

- [ ] **Step 5: Commit**

```bash
git add js/core/transformChains.js tests/test_transform_recipes.js
git commit -m "feat: persist staged recipes alongside legacy free-form chains"
```

---

### Task 3: Run staged pipeline (sync transform nodes)

**Files:**
- Modify: `js/core/transformChains.js` (`runStagedRecipe`, registration `func`)
- Modify: `tests/test_transform_recipes.js`

**Interfaces:**
- Produces: `runStagedRecipe(recipe, text, options) → string`  
  - Applies normalize/obfuscate/present/conceal via existing `runChainNodes`  
  - If translate or carrier present: **skip** those in sync path and leave markers for Tasks 4–5 OR throw/return partial with `options.phase`  
  - For registration preview: run sync-only stages; document that full apply with Translate/Carrier is async from UI

Recommended approach for apply UX (Task 6/7): Vue calls `runStagedRecipeAsync` (Task 4–5). For Task 3:

```javascript
function runStagedRecipeSync(recipe, text) {
    var flat = global.TransformRecipeStages.flattenStagedToNodes(recipe);
    var transformNodes = flat.filter(function(n) {
        return n && typeof n.transform === 'string';
    });
    return runChainNodes(transformNodes, text);
}
```

Registration: if staged, `func` uses sync runner (Translate/Carrier ignored until async wrapper in later task — badge `Carrier`/`AI` set in Task 4–5).

- [ ] **Step 1: Test** — save staged caesar→base64 with real base64 in ctx; `runStagedRecipeSync` yields expected encoding of caesar output.

- [ ] **Step 2: Implement + PASS + Commit**

```bash
git commit -m "feat: run sync stages for staged recipes"
```

---

### Task 4: Translate stage (async)

**Files:**
- Modify: `js/core/transformChains.js`
- Modify: `tests/test_transform_recipes.js` (mock `AIProvider.chatCompletion`)

**Interfaces:**
- Produces: `runStagedRecipeAsync(recipe, text, opts) → Promise<string>`
- Translate node uses same prompt pattern as `TranslateTool.translateBuildPrompt` (extract shared helper **or** duplicate minimal prompt string in core to avoid Vue dependency — prefer small shared `js/utils/translatePrompt.js` only if needed; otherwise inline TranslateGemma-style user prompt in core).

```javascript
function runTranslateNode(node, text) {
    if (!global.AIProvider || typeof global.AIProvider.chatCompletion !== 'function') {
        return Promise.reject(new Error('Configure an AI provider in Settings.'));
    }
    var model = node.model || global.localStorage.getItem('translate-model') || '';
    var lang = node.lang;
    var prompt = 'Please translate the following English text into ' + lang + ':\n\n' + text;
    return global.AIProvider.chatCompletion({
        model: model,
        messages: [{ role: 'user', content: prompt }]
    }).then(function(res) {
        // mirror AIProvider response shape used elsewhere
        return (res && res.content) || (res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
    });
}
```

Inspect actual `AIProvider.chatCompletion` return shape in `js/utils/aiProvider.js` and match it exactly in the plan implementation (do not guess in code — read file during task).

- [ ] **Step 1: Test with mock provider** — translate node prepends `[LA]` in mock; assert async pipeline order translate then caesar.

- [ ] **Step 2: Implement async runner that walks flatten order**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: async Translate stage for staged recipes"
```

---

### Task 5: Carrier stage (QR + emoji stego)

**Files:**
- Modify: `js/core/transformChains.js`
- Modify: `js/tools/TransformTool.js` (preview helpers only if needed)
- Test: mock `QRCode.toDataURL` and `steganography.encodeEmoji`

**Interfaces:**
- `applyCarrier(carrierNode, text) → Promise<{ kind:'text'|'image', value:string }>`
  - `qr`: `window.QRCode.toDataURL(text, {…})` → `{ kind:'image', value: dataUrl }`
  - `emoji_stego`: `window.steganography.encodeEmoji(text, carrierEmoji, …)` → `{ kind:'text', value }`
- `runStagedRecipeAsync` returns string for text carriers; for QR returns data URL string and sets `recipeLastOutputKind` or returns `{ kind, value }` — **pick one and use consistently in UI**: prefer return object `{ kind, value }` from async runner; Vue sets `transformOutput` / image preview accordingly.

- [ ] **Step 1: Failing tests with mocks**

- [ ] **Step 2: Implement adapters matching `CodesTool` / `EmojiTool` call signatures** (read those files during implementation)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: QR and emoji-stego carrier stages"
```

---

### Task 6: Cycle modes `word_safe` | `one_way`

**Files:**
- Modify: `js/core/transformChains.js` (`sanitizeCycleRecord`, `validateCycleForSave`, `registerCycle`, `cycleRoundTripsCleanly`)
- Modify: `tests/test_transform_recipes.js` and/or `tests/test_transform_chains.js`

**Interfaces:**
- Cycle record: `{ mode: 'word_safe' | 'one_way' }` default `word_safe`
- Word-safe: reject if any referenced chain/recipe fails `cycleRoundTripsCleanly` **or** contains known bad keys (`base64`, `base64url`, …) — implement `recipeIsWordSafe(chainOrRecipe) → boolean`
- One-way: skip word-safe rejection; `canDecode: false`; `reverse: null`

```javascript
var WORD_UNSAFE_KEYS = { base64: true, base64url: true /* extend */ };

function recipeIsWordSafe(chain) {
    if (!chain) return false;
    var nodes = chain.kind === 'staged'
        ? (global.TransformRecipeStages.flattenStagedToNodes(chain) || []).filter(function(n) { return n.transform; })
        : (chain.nodes || []);
    for (var i = 0; i < nodes.length; i++) {
        if (WORD_UNSAFE_KEYS[nodes[i].transform]) return false;
        if (nodes[i].type === 'translate' || nodes[i].type === 'qr' || nodes[i].type === 'emoji_stego') return false;
    }
    return cycleRoundTripsCleanly([chain]); // existing probe against resolved chains
}
```

Adjust probe API to accept chain records as today’s `resolveCycleChains` expects.

- [ ] **Step 1: Tests** — word_safe rejects base64 chain; one_way saves and registers without reverse

- [ ] **Step 2: Implement + Commit**

```bash
git commit -m "feat: cycle word_safe vs one_way modes"
```

---

### Task 7: Staged builder UI + templates + legacy toggle

**Files:**
- Modify: `js/tools/TransformTool.js`
- Modify: `templates/transforms.html`
- Modify: `css/style.css`
- Run: `npm run build:templates`

**Interfaces:**
- Vue data: `recipeBuilderMode: 'staged' | 'legacy'`, `stagedDraft`, `recipeTemplateId`
- Methods: `openRecipeBuilder`, `applyRecipeTemplate`, `stagedAddNode(stageId, key)`, `saveStagedRecipe`, `setLegacyFreeformBuilder(true)` with `LEGACY_FREEFORM_BUILDER` comment
- Manager CTA: **New recipe**; legacy: **Free-form (legacy)**
- Cycle builder: checkbox bound to `cycleDraftMode`

UI structure (original design):
- Template chips row
- Stage rail / stacked stage rows with `STAGE_ORDER`
- Filtered picker using `TransformRecipeStages.isTransformAllowedInStage`
- Translate fields: lang + model select (`openrouter-model-select`)
- Carrier: radio qr | emoji_stego + emoji picker field if stego

- [ ] **Step 1: Markup + methods** (no full browser automation required in CI; manual checklist in Task 9)

- [ ] **Step 2: `npm run build:templates`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: staged recipe builder UI with templates and legacy toggle"
```

---

### Task 8: Apply/preview wiring for async + carrier output

**Files:**
- Modify: `js/tools/TransformTool.js` (apply active staged recipe, preview image)
- Modify: `templates/transforms.html` (optional `<img>` when output is QR data URL)

When user clicks a registered staged recipe:
- If only sync stages → existing `func`
- If translate/carrier → Vue path calls `runStagedRecipeAsync` and updates output / image

Registration `func` may remain sync-best-effort; primary apply path in Vue should detect `kind==='staged'` and use async runner.

- [ ] **Step 1: Implement Vue apply branch**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: apply staged recipes with async translate and carrier preview"
```

---

### Task 9: Docs + verify

**Files:**
- Modify: `README.md` (Chains & Cycles → Recipes section)
- Modify: `docs/TOOL_ARCHITECTURE.md`
- Modify: `CONTRIBUTING.md` if tree lists `transformRecipeStages.js`

- [ ] **Step 1: Update docs** — staged rail, templates, legacy free-form, cycle modes, carriers, Future B note

- [ ] **Step 2: `npm run build` && `npm run test:all`**

- [ ] **Step 3: Browser checklist** (local `dist` on a free port — not SearXNG :8080)
  1. Template Cipher→Base64 applies
  2. Translate→Present path shows AI badge; runs with key
  3. Carrier QR preview
  4. Cycle word_safe rejects base64 recipe
  5. Cycle one-way checkbox allows it with AI-decode badge
  6. Legacy free-form still saves
  7. No console errors on Transform tab

- [ ] **Step 4: Commit docs** (and any small fixes)

```bash
git commit -m "docs: document staged transform recipes"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Typed stage rail + allowlists | Task 1 |
| validate empty Obfuscate / bad stage membership | Task 1 |
| Templates as shortcuts | Task 1 (data) + Task 7 (UI) |
| Persist staged + legacy free-form | Task 2 |
| Sync stage execution | Task 3 |
| Optional Translate stage | Task 4 |
| Carrier QR / emoji stego | Task 5 |
| Cycle word_safe + one_way checkbox | Task 6 + Task 7 |
| Staged UI + legacy toggle | Task 7 |
| Async apply / carrier preview | Task 8 |
| Docs + build/test/browser | Task 9 |
| No wipe v1 / no new tab / no opaque tokens | Global + Task 9 docs |
| `@legacy` markers | Task 2, 7 |

**Placeholder scan:** none intentional.  
**Type consistency:** `kind:'staged'`, `stages.*`, `mode:'word_safe'|'one_way'`, `saveRecipe`, `runStagedRecipeAsync`, `TransformRecipeStages.*` used consistently.

---

## Execution note

Prefer a dedicated worktree/branch for this plan if `feat/transform-chains` is already shared for the prior completion work; otherwise continue on `feat/transform-chains` with clear commits.
