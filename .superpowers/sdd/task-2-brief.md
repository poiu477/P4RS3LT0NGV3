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

