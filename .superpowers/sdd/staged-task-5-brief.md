### Task 5: Carrier stage (QR + emoji stego)

**Files:**
- Modify: `js/core/transformChains.js`
- Modify: `js/tools/TransformTool.js` (preview helpers only if needed)
- Test: mock `QRCode.toDataURL` and `steganography.encodeEmoji`

**Interfaces:**
- `applyCarrier(carrierNode, text) → Promise<{ kind:'text'|'image', value:string }>`
  - `qr`: `window.QRCode.toDataURL(text, {…})` → `{ kind:'image', value: dataUrl }`
  - `emoji_stego`: `window.steganography.encodeEmoji(text, carrierEmoji, …)` → `{ kind:'text', value }`
- `runStagedRecipeAsync` returns string for text carriers; for QR returns data URL string and sets `recipeLastOutputKind` or returns `{ kind, value }` — **pick one and use consistently in UI**: prefer return object `{ kind, value }` from async runner; Vue sets `transformOutput` / image preview accordingly.

- [ ] **Step 1: Failing tests with mocks**

- [ ] **Step 2: Implement adapters matching `CodesTool` / `EmojiTool` call signatures** (read those files during implementation)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: QR and emoji-stego carrier stages"
```

---

