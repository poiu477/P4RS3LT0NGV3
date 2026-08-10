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

