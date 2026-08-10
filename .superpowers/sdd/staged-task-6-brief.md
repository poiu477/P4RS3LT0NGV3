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

