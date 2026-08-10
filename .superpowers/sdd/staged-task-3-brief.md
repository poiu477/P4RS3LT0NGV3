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

