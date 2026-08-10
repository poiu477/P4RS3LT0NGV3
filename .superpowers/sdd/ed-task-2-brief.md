### Task 2: Carrier results include underlying text

**Files:**
- Modify: `js/core/transformChains.js` (`applyCarrier` QR return)
- Modify: `tests/test_transform_recipes.js` (assert QR-shaped result includes `text` when tested; if no QR lib in vm, unit-test a small exported shape helper **or** assert documentation via a focused assert on `applyCarrier` with stubbed `QRCode`)

**Interfaces:**
- Consumes: existing `applyCarrier(carrierNode, text)`
- Produces: QR success → `{ kind: 'image', value: dataUrl, text: String(text) }`; emoji stego unchanged `{ kind:'text', value }`

- [ ] **Step 1: Extend recipe tests with stubbed QR**

In `tests/test_transform_recipes.js`, after chains load, add:

```javascript
ctx.QRCode = {
    toDataURL: function(text) {
        return Promise.resolve('data:image/png;base64,STUB');
    }
};
const recipeWithQr = {
    name: 'QR Demo',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [{ transform: 'base64', options: {} }],
        present: null,
        conceal: null,
        carrier: { type: 'qr', options: {} }
    }
};
// save + run async
return TC.runStagedRecipeAsync(
    TC.loadChains().filter(c => c.name === 'QR Demo')[0] || recipeWithQr,
    'hi'
).then(function(result) {
    assert.strictEqual(result.kind, 'image');
    assert.ok(result.value.indexOf('data:image') === 0);
    assert.strictEqual(result.text, 'aGk='); // base64 of "hi" — adjust if encode differs
    console.log('test_transform_recipes: OK');
});
```

If the file is currently sync-only at the end, convert the QR assertion block to the final async section **or** save the recipe first with `TC.saveRecipe` then `runStagedRecipeAsync` on the loaded record. Match existing base64 encoding used by `ctx.transforms.base64` in that test file (stub `func` if needed).

If `base64` in the test harness is only a stub without `func`, set:

```javascript
ctx.transforms.base64.func = function(text) {
    return Buffer.from(String(text), 'utf8').toString('base64');
};
```

before the async run.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_transform_recipes.js`  
Expected: FAIL on missing `result.text` (or recipe save / async path)

- [ ] **Step 3: Implement QR text payload**

In `js/core/transformChains.js` `applyCarrier`, change the QR `.then` to:

```javascript
.then(function(dataUrl) {
    return { kind: 'image', value: dataUrl, text: String(text) };
});
```

- [ ] **Step 4: Run tests**

Run: `node tests/test_transform_recipes.js`  
Expected: pass including QR text assertion

- [ ] **Step 5: Commit**

```bash
git add js/core/transformChains.js tests/test_transform_recipes.js
git commit -m "$(cat <<'EOF'
feat: include underlying text with QR carrier results

EOF
)"
```

---

