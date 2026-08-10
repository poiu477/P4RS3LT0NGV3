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

