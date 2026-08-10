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
