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
