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

