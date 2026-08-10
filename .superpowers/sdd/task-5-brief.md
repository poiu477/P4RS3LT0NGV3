### Task 5: Keep chains out of blind decoder auto-guess

**Files:**
- Modify: `js/core/decoder.js` (or wherever the blind reverse loop filters candidates)
- Modify: `js/core/transformChains.js` registration comment if it claims “never auto-guessed”

**Interfaces:**
- Produces: Blind decode skips `isChain` / `isCycle` / `category === 'chains'` unless that transform is the user’s active selection

- [ ] **Step 1: Locate blind reverse candidate filter in `decoder.js`**

Search for where transforms are iterated for reverse attempts. Add:

```javascript
if (transform.isChain || transform.isCycle || transform.category === 'chains') {
    continue; // only via explicit user selection / AI recipe decode
}
```

Do **not** block Decode-tab reverse when the user has that chain active (active path is separate).

- [ ] **Step 2: Align comment in `registerChain`**

Ensure the `priority: 0` comment matches behavior: excluded from blind auto-guess; still reversible when selected.

- [ ] **Step 3: Commit**

```bash
git add js/core/decoder.js js/core/transformChains.js
git commit -m "fix: exclude saved chains/cycles from blind decoder auto-guess"
```

---

