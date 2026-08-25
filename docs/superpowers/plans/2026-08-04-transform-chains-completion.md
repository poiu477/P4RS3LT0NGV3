# Transform Chains Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the transform chain/cycle system to production quality: fix remaining correctness gaps, add validation/tests/docs, and satisfy CONTRIBUTING.md’s submit checklist.

**Architecture:** Keep business logic in `js/core/transformChains.js` and UI in `TransformTool.js` + `templates/transforms.html`. After every CRUD mutation, rebuild the Vue `transforms` list and rematch `activeTransform` by stable `transformKey` (`chain_<id>` / `cycle_<id>`). Storage failures already return `null`/`false` from core; Vue must surface them. Docs and a Node `vm`-based test file mirror existing custom-spelling tests.

**Tech Stack:** Vanilla JS + Vue 2 (existing app), `localStorage`, Node `vm` tests (no new frameworks), static `dist/` build via `npm run build`.

## Global Constraints

- Do not nest saved chains/cycles inside chains (already rejected in core).
- Prefer rematching by `transformKey`, not display `name`.
- Keep changes minimal; no new tab — Chains stay on the Transform tab.
- Follow CONTRIBUTING: core in `js/core/`, UI in tools/templates, script already in `index.template.html`.
- Conventional commits (`fix`, `feat`, `test`, `docs`).
- After template edits: `npm run build:templates` (or full `npm run build`) before claiming done.

## File Map

| File | Responsibility |
|------|----------------|
| `js/core/transformChains.js` | Cycle save validation; expose clear validation errors; keep CRUD write failure semantics |
| `js/tools/TransformTool.js` | Remap `activeTransform`; honor save/delete failures; favorites prune; prefs on node add; export/import/copy; decode-model wiring |
| `templates/transforms.html` | Export/import/copy UI; decode-model select if added on Transform surface |
| `index.template.html` | Optional Settings control for `chain-decode-model` (or Transform AI-decode panel) |
| `css/style.css` | Minimal styles for new chain-manager actions if needed |
| `tests/test_transform_chains.js` | Unit tests for sanitize, nesting, write fail/rollback, describe options, cycle validation |
| `package.json` | Wire `test:chains` into `test:all` |
| `README.md` | User-facing Chains & Cycles section |
| `CONTRIBUTING.md` | Add `transformChains.js` to structure tree; brief note under core |
| `docs/TOOL_ARCHITECTURE.md` | Short architecture note (storage keys, no nesting, AI decode) |

---

### Task 1: Remap `activeTransform` after transform-list refresh

**Files:**
- Modify: `js/tools/TransformTool.js` (`refreshCustomSpellingTransforms`, ~1006–1027; optionally `refreshChainsTransforms`)

**Interfaces:**
- Consumes: `this.activeTransform.transformKey` (already set when mapping from `window.transforms` in `buildTransformsFromWindow`)
- Produces: After rebuild, `activeTransform` is either the same logical transform with fresh `func`/`preview`/`reverse`, or `null` if deleted

- [ ] **Step 1: Confirm `transformKey` is present on Vue transform objects**

In `buildTransformsFromWindow`, the mapped object already includes `transformKey: key`. Verify with a quick read; do not change the shape unless missing.

- [ ] **Step 2: After assigning `this.transforms`, rematch active**

Replace the end of `refreshCustomSpellingTransforms` so it rematches:

```javascript
refreshCustomSpellingTransforms: function() {
    const transformTool = window.toolRegistry && window.toolRegistry.get('transforms');
    if (!transformTool || typeof transformTool.buildTransformsFromWindow !== 'function') {
        return;
    }

    const previousCustomCount = (this.transforms || []).filter(function(t) {
        return t.category === 'custom_spelling';
    }).length;

    const previousKey = this.activeTransform && this.activeTransform.transformKey
        ? this.activeTransform.transformKey
        : null;

    this.transforms = transformTool.buildTransformsFromWindow();
    const categories = transformTool.rebuildTransformCategories(this.transforms);
    this.legendCategories = categories.legendCategories;
    this.categories = categories.sectionCategories;

    const nextCustomCount = this.transforms.filter(function(t) {
        return t.category === 'custom_spelling';
    }).length;
    if (nextCustomCount !== previousCustomCount) {
        this.saveCategoryOrder(this.categories);
    }

    if (!previousKey) {
        this.activeTransform = null;
    } else {
        const match = this.transforms.find(function(t) {
            return t.transformKey === previousKey;
        });
        this.activeTransform = match || null;
        if (match && this.transformInput && this.activeTab === 'transforms') {
            const opts = this.getMergedOptionsForTransform(match.name);
            this.transformOutput = match.func(this.transformInput, opts);
        } else if (!match) {
            this.transformOutput = '';
        }
    }
},
```

- [ ] **Step 3: Manual check**

Build, open Transform tab, apply a saved chain, edit/delete it from the Chains manager, confirm output clears or updates and no stale function runs.

- [ ] **Step 4: Commit**

```bash
git add js/tools/TransformTool.js
git commit -m "fix: rematch activeTransform after transform list refresh"
```

---

### Task 2: Surface save/delete storage failures in Vue CRUD

**Files:**
- Modify: `js/core/transformChains.js` (`validateChainForSave` — already returns string; add `getLastSaveError` or return structured result)
- Modify: `js/tools/TransformTool.js` (`saveChainDraft`, `saveCycleDraft`, `deleteSavedChain`, `deleteSavedCycle`)

**Interfaces:**
- Consumes: `TransformChains.saveChain` → `string|null`; `deleteChain`/`deleteCycle` → `boolean`
- Produces: Distinct UI errors for validation vs storage; no success toast on failure

- [ ] **Step 1: Expose last validation/storage reason from core (minimal)**

In `transformChains.js`, keep a module-level `var lastMutationError = ''` and set it in `saveChain` / `saveCycle` / `deleteChain` / `deleteCycle`:

```javascript
var lastMutationError = '';

function getLastMutationError() {
    return lastMutationError || '';
}

// in saveChain rejection / writeList failure:
lastMutationError = rejection || 'Could not write chains to browser storage.';
return null;

// on success:
lastMutationError = '';
```

Export `getLastMutationError` on `window.TransformChains`.

- [ ] **Step 2: Update Vue save handlers**

```javascript
const id = window.TransformChains.saveChain({ id: this.chainBuilderEditId, name, nodes: this.chainDraftNodes });
if (!id) {
    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
        'Could not save chain.';
    return;
}
```

Same pattern for `saveCycleDraft`.

- [ ] **Step 3: Update Vue delete handlers**

```javascript
deleteSavedChain: function(chain) {
    if (!window.confirm('Delete chain "' + chain.name + '"? Any cycle using it will drop the reference.')) return;
    const ok = window.TransformChains.deleteChain(chain.id);
    if (!ok) {
        this.showNotification(
            window.TransformChains.getLastMutationError() || 'Could not delete chain.',
            'error',
            'fas fa-exclamation-triangle'
        );
        return;
    }
    this.refreshChainsTransforms();
    this.pruneFavoritesForMissingTransforms(); // added in Task 4; stub call only if Task 4 not yet done — implement prune in Task 4 first or inline a no-op until then
    this.showNotification('Chain deleted', 'success', 'fas fa-trash');
},
```

Mirror for `deleteSavedCycle`.

**Ordering note:** If implementing Task 2 before Task 4, omit the `pruneFavoritesForMissingTransforms` call until Task 4; then add it.

- [ ] **Step 4: Commit**

```bash
git add js/core/transformChains.js js/tools/TransformTool.js
git commit -m "fix: surface chain/cycle storage and validation failures in UI"
```

---

### Task 3: `validateCycleForSave`

**Files:**
- Modify: `js/core/transformChains.js`
- Test: `tests/test_transform_chains.js` (created in Task 7; add cases there or write failing cases first if Task 7 already started)

**Interfaces:**
- Produces: `validateCycleForSave(cycle) -> string|null` (null = ok)
- Consumed by: `saveCycle`

- [ ] **Step 1: Add validator**

```javascript
function validateCycleForSave(cycle) {
    if (!cycle || typeof cycle !== 'object') {
        return 'Invalid cycle.';
    }
    if (typeof cycle.name !== 'string' || !cycle.name.trim()) {
        return 'Cycle name is required.';
    }
    if (!Array.isArray(cycle.chainIds) || !cycle.chainIds.length) {
        return 'Add at least one chain to the cycle.';
    }
    var known = {};
    loadChains().forEach(function(c) { known[c.id] = true; });
    for (var i = 0; i < cycle.chainIds.length; i++) {
        var cid = cycle.chainIds[i];
        if (typeof cid !== 'string' || !cid) {
            return 'Cycle contains an invalid chain reference.';
        }
        if (!known[cid]) {
            return 'Cycle references a missing chain (' + cid + ').';
        }
    }
    return null;
}
```

Call it at the start of `saveCycle` like `validateChainForSave` in `saveChain`. Set `lastMutationError` on rejection.

- [ ] **Step 2: Commit**

```bash
git add js/core/transformChains.js
git commit -m "feat: validate cycles before save"
```

---

### Task 4: Prune favorites when transforms disappear

**Files:**
- Modify: `js/tools/TransformTool.js`

**Interfaces:**
- Produces: `pruneFavoritesForMissingTransforms()` method on Vue
- Called from: `refreshCustomSpellingTransforms` and/or after successful chain/cycle delete/save rename paths

- [ ] **Step 1: Implement prune**

Favorites for normal transforms are plain name strings. After rebuild:

```javascript
pruneFavoritesForMissingTransforms: function() {
    if (!Array.isArray(this.favorites) || !this.favorites.length) return;
    const names = {};
    (this.transforms || []).forEach(function(t) {
        if (t && t.name) names[t.name] = true;
    });
    const next = this.favorites.filter(function(f) {
        if (typeof f === 'string') return !!names[f];
        return true; // keep translate favorites objects
    });
    if (next.length !== this.favorites.length) {
        this.favorites = next;
        this.showFavorites = next.length > 0;
        this.saveFavorites(next);
    }
},
```

Call at end of `refreshCustomSpellingTransforms` after rematch.

- [ ] **Step 2: Commit**

```bash
git add js/tools/TransformTool.js
git commit -m "fix: drop orphan transform favorites after list refresh"
```

---

### Task 5: Keep chains out of blind decoder auto-guess

**Files:**
- Modify: `js/core/decoder.js` (or wherever the blind reverse loop filters candidates)
- Modify: `js/core/transformChains.js` registration comment if it claims “never auto-guessed”

**Interfaces:**
- Produces: Blind decode skips `isChain` / `isCycle` / `category === 'chains'` unless that transform is the user’s active selection

- [ ] **Step 1: Locate blind reverse candidate filter in `decoder.js`**

Search for where transforms are iterated for reverse attempts. Add:

```javascript
if (transform.isChain || transform.isCycle || transform.category === 'chains') {
    continue; // only via explicit user selection / AI recipe decode
}
```

Do **not** block Decode-tab reverse when the user has that chain active (active path is separate).

- [ ] **Step 2: Align comment in `registerChain`**

Ensure the `priority: 0` comment matches behavior: excluded from blind auto-guess; still reversible when selected.

- [ ] **Step 3: Commit**

```bash
git add js/core/decoder.js js/core/transformChains.js
git commit -m "fix: exclude saved chains/cycles from blind decoder auto-guess"
```

---

### Task 6: Chain decode model selection + node option prefs + export/import/copy

**Files:**
- Modify: `js/tools/TransformTool.js`
- Modify: `templates/transforms.html`
- Modify: `css/style.css` (only if new buttons need layout)

**Interfaces:**
- `localStorage['chain-decode-model']` already read by `TransformChains.aiDecode`
- Node add should seed options from `getMergedOptionsForTransform(t.name)` when possible

- [ ] **Step 1: Seed node options from current prefs**

In `chainAddNode`:

```javascript
chainAddNode: function(key) {
    const t = window.transforms[key];
    if (!t) return;
    const options = {};
    const prefs = typeof this.getMergedOptionsForTransform === 'function'
        ? this.getMergedOptionsForTransform(t.name)
        : {};
    (t.configurableOptions || []).forEach(opt => {
        options[opt.id] = (prefs && prefs[opt.id] != null) ? prefs[opt.id] : opt.default;
    });
    this.chainDraftNodes.push({ transform: key, options });
    this.chainNodePickerQuery = '';
},
```

- [ ] **Step 2: Decode-model select on AI decode panel**

In Vue data, add `chainDecodeModel: localStorage.getItem('chain-decode-model') || localStorage.getItem('translate-model') || ''`.

In `chainRunAiDecode`, pass `model: this.chainDecodeModel` and persist:

```javascript
if (this.chainDecodeModel) {
    localStorage.setItem('chain-decode-model', this.chainDecodeModel);
}
```

In `templates/transforms.html` AI-decode boxes, reuse `<openrouter-model-select v-model="chainDecodeModel" label="Decode model">` (or the same component already used elsewhere).

- [ ] **Step 3: Copy recipe key**

```javascript
chainCopyRecipe: function(entity, kind) {
    const recipe = window.TransformChains.describeRecipe(entity, kind);
    this.copyToClipboard(recipe);
    this.showNotification('Recipe copied', 'success', 'fas fa-copy');
},
```

Add a small “Copy recipe” button on each chain/cycle card in the manager.

- [ ] **Step 4: Export / import JSON**

```javascript
chainExportAll: function() {
    const payload = {
        version: 1,
        chains: window.TransformChains.loadChains(),
        cycles: window.TransformChains.loadCycles()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'p4rs3ltongv3-chains.json';
    a.click();
    URL.revokeObjectURL(url);
},
chainImportAll: function(file) {
    const reader = new FileReader();
    const self = this;
    reader.onload = function() {
        try {
            const data = JSON.parse(reader.result);
            (data.chains || []).forEach(function(c) {
                window.TransformChains.saveChain({
                    id: c.id,
                    name: c.name,
                    nodes: c.nodes
                });
            });
            (data.cycles || []).forEach(function(cy) {
                window.TransformChains.saveCycle({
                    id: cy.id,
                    name: cy.name,
                    chainIds: cy.chainIds
                });
            });
            self.refreshChainsTransforms();
            self.showNotification('Chains imported', 'success', 'fas fa-file-import');
        } catch (e) {
            self.showNotification('Import failed: ' + (e.message || 'invalid file'), 'error');
        }
    };
    reader.readAsText(file);
},
```

UI: Export button + hidden file input for Import in the Chains manager header.

- [ ] **Step 5: Commit**

```bash
git add js/tools/TransformTool.js templates/transforms.html css/style.css
git commit -m "feat: chain decode model, prefs-seeded nodes, export/import and copy recipe"
```

---

### Task 7: Automated tests for TransformChains

**Files:**
- Create: `tests/test_transform_chains.js`
- Modify: `package.json` (`test:chains`, include in `test:all`)

**Interfaces:**
- Follow `tests/test_custom_spelling_transforms.js` pattern: `vm` context + `localStorage` mock + load scripts

- [ ] **Step 1: Write the test file**

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function createContext() {
    const store = Object.create(null);
    let quotaBlocked = false;
    const ctx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
                if (quotaBlocked) {
                    const err = new Error('quota');
                    throw err;
                }
                store[k] = String(v);
            },
            _block: (b) => { quotaBlocked = !!b; },
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
    base64: {
        name: 'Base64',
        category: 'encoding',
        func: (t) => Buffer.from(t, 'utf8').toString('base64'),
        reverse: (t) => Buffer.from(t, 'base64').toString('utf8'),
        canDecode: true
    },
    caesar: {
        name: 'Caesar Cipher',
        category: 'cipher',
        configurableOptions: [{ id: 'shift', default: 3 }],
        func: (t, o) => t, // stub
        reverse: (t, o) => t,
        canDecode: true
    }
};
load(ctx, 'js/core/transformChains.js');
const TC = ctx.TransformChains;
assert.ok(TC, 'TransformChains global');

// sanitize / null filtering via save+load
const id = TC.saveChain({
    name: 'Demo',
    nodes: [
        { transform: 'caesar', options: { shift: 3 } },
        null,
        { transform: 'base64', options: {} }
    ]
});
assert.ok(id);
const chains = TC.loadChains();
assert.strictEqual(chains.length, 1);
assert.strictEqual(chains[0].nodes.length, 2);

// nesting reject
TC.syncTransforms();
const nested = TC.saveChain({
    name: 'Bad',
    nodes: [{ transform: 'chain_' + id, options: {} }]
});
assert.strictEqual(nested, null);

// describe includes options
const recipe = TC.describeChain(chains[0]);
assert.ok(recipe.indexOf('caesar') !== -1);
assert.ok(recipe.indexOf('"shift":3') !== -1 || recipe.indexOf('"shift": 3') !== -1);

// cycle validation
assert.strictEqual(TC.saveCycle({ name: 'C', chainIds: [] }), null);
const cyId = TC.saveCycle({ name: 'C', chainIds: [id] });
assert.ok(cyId);

// write failure rollback on deleteChain
const beforeChains = JSON.stringify(TC.loadChains());
const beforeCycles = JSON.stringify(TC.loadCycles());
ctx.localStorage._block(true);
// First write may throw inside writeList and return false — depending on implementation,
// unblock after forcing failure path. Prefer stubbing by temporarily replacing setItem mid-delete:
ctx.localStorage._block(false);
let calls = 0;
const realSet = ctx.localStorage.setItem.bind(ctx.localStorage);
ctx.localStorage.setItem = (k, v) => {
    calls += 1;
    if (calls === 2) throw new Error('fail cycle write');
    return realSet(k, v);
};
const deleted = TC.deleteChain(id);
assert.strictEqual(deleted, false);
ctx.localStorage.setItem = realSet;
assert.strictEqual(JSON.stringify(TC.loadChains()), beforeChains);
assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeCycles);

console.log('test_transform_chains: OK');
```

Adjust the rollback test if `writeList` catches throws (it does — `setItem` throw → `false`). For the second-write failure simulation, wrap so the first `setItem` succeeds and the second throws.

- [ ] **Step 2: Wire package scripts**

```json
"test:chains": "node tests/test_transform_chains.js",
"test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains"
```

- [ ] **Step 3: Run tests**

```bash
node tests/test_transform_chains.js
npm run test:chains
```

Expected: `test_transform_chains: OK`

- [ ] **Step 4: Commit**

```bash
git add tests/test_transform_chains.js package.json
git commit -m "test: add TransformChains unit coverage"
```

---

### Task 8: Documentation (README, CONTRIBUTING, architecture)

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/TOOL_ARCHITECTURE.md`

- [ ] **Step 1: README — add under Tools / Transform**

Add a short subsection after the Transform bullets:

```markdown
### Chains & Cycles (on the Transform tab)

- **Chain** — an ordered pipeline of transforms applied to the whole input; each node snapshots its own options (e.g. Caesar shift 3 then shift 7).
- **Cycle** — rotate a list of chains across words (word 1 → chain A, word 2 → chain B, wrap).
- Saved entities appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply).
- Nested chains/cycles are not allowed.
- If a recipe cannot mechanically reverse, use **AI decode** in the Chains manager (uses your configured AI providers).
- Export/import JSON from the Chains manager; copy the human-readable recipe for sharing.
```

Fix any remaining heading-anchor links only if still wrong (`#-getting-started`, `#-ai-providers--api-keys`).

- [ ] **Step 2: CONTRIBUTING — structure tree**

Under `js/core/`, add:

```text
│   │   ├── transformChains.js # Saved transform chains & per-word cycles
```

Mention in Core vs Tools that chains are core logic registered into `window.transforms`, with UI on TransformTool.

- [ ] **Step 3: TOOL_ARCHITECTURE — short note**

Add a subsection:

```markdown
## Transform chains & cycles

- Module: `js/core/transformChains.js` (`window.TransformChains`)
- Storage: `localStorage` keys `transform-chains-v1`, `transform-cycles-v1`
- Registration: `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`
- No nesting of saved chains/cycles inside chain nodes
- Mechanical reverse when every node (and cycle probe) allows it; otherwise AI recipe decode via `aiDecode`
- UI: Transform tab Chains manager (`templates/transforms.html`, methods on `TransformTool`)
```

- [ ] **Step 4: Commit**

```bash
git add README.md CONTRIBUTING.md docs/TOOL_ARCHITECTURE.md
git commit -m "docs: document transform chains and cycles"
```

---

### Task 9: Build, browser verify, CONTRIBUTING checklist

**Files:** none new (verification only)

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: exit 0; `dist/index.html` includes chain manager markup; `dist/js/core/transformChains.js` present.

- [ ] **Step 2: Run all tests**

```bash
npm run test:all
```

Expected: all suites OK including `test:chains`.

- [ ] **Step 3: Browser checklist**

Using `npm start` → http://localhost:8080 (or deploy to prox1 if desired):

1. Create chain with Caesar shift 3 then Base64; apply from category **chains**.
2. Search finds it; favorite it; rename via edit; favorite still valid or pruned cleanly.
3. Create cycle over two chains; preview words alternate.
4. Attempt to add a chain as a node → save rejected with clear message.
5. Delete chain used by a cycle → cycle refs drop; delete failure path only if you can simulate (optional).
6. AI decode panel: pick model, decode a non-reversible recipe.
7. Export JSON, clear site data for chain keys (or delete all), import JSON back.
8. Console: no errors on Transform tab.

- [ ] **Step 4: Final commit only if verify found small fixes**

Otherwise stop; branch is complete.

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Remap/clear `activeTransform` after CRUD | Task 1 |
| Honor delete/save failure in Vue | Task 2 |
| Differentiate save failure messages | Task 2 |
| `validateCycleForSave` | Task 3 |
| Favorites orphans | Task 4 |
| Decoder blind auto-guess | Task 5 |
| `chain-decode-model` UI | Task 6 |
| Export/import / copy recipe | Task 6 |
| Node options from global prefs | Task 6 |
| Automated tests | Task 7 |
| README / CONTRIBUTING / architecture docs | Task 8 |
| Build + browser verify (CONTRIBUTING checklist) | Task 9 |
| Picker cap | Already done (no task) |
| Core writeList + deleteChain rollback | Already done (no task) |

**Placeholder scan:** none intentional.  
**Type consistency:** `transformKey`, `getLastMutationError`, `validateCycleForSave`, `pruneFavoritesForMissingTransforms`, `chainExportAll` / `chainImportAll` / `chainCopyRecipe` used consistently across tasks.
