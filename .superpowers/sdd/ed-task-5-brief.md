### Task 5: Docs + final verification

**Files:**
- Modify: `README.md` (short Transforms note: Encode/Decode switch, Output under input, recipes click like other methods)
- Modify: `docs/TOOL_ARCHITECTURE.md` only if it documents transform apply flow

- [ ] **Step 1: Document user-facing behavior**

Add a short README bullet under Transforms:

```markdown
- **Encode / Decode** toggle above the input: every transform and saved recipe runs in that mode. Results show in the Output field under the input and are copied to the clipboard (Copy History). Irreversible methods use AI decode when Decode is selected.
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test:all`  
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add README.md docs/TOOL_ARCHITECTURE.md
git commit -m "$(cat <<'EOF'
docs: document Encode/Decode transform mode

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Global Encode/Decode near input + persist | Task 1 + 3 |
| Click transform/recipe → Output + clipboard | Task 4 |
| Output under Input | Task 3 |
| Text always in Output | Task 4 |
| Decode + reverse | Task 1 resolve + Task 4 |
| Decode + AI fallback | Task 4 |
| AI missing → Settings toast | Task 4 |
| Mode flip re-run | Task 3 `setTransformIoMode` |
| Live typing respects mode, Output only | Task 4 `autoTransform` without copy |
| QR image + underlying text | Task 2 + 4 |
| Demote manager Apply | Task 4 |
| Recipes same as other methods | Task 4 (shared `applyTransform`) |

## Placeholder / consistency self-review

- No TBD steps; script load path must mirror `transformRecipeStages.js` exactly in Task 1.
- `transformOutputImage` introduced in Task 4; Task 3 template may temporarily use existing fields then align in Task 4.
- `copyOnSuccess` distinguishes click/mode-flip from auto-transform.
- `resolveAction` / `describeForAiDecode` names consistent across tasks.
