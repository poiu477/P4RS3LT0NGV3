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

