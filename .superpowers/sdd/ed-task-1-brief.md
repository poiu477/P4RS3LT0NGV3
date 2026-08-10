### Task 1: Pure mode helper + tests

**Files:**
- Create: `js/core/transformApplyMode.js`
- Create: `tests/test_transform_apply_mode.js`
- Modify: `package.json` (scripts)
- Modify: `index.template.html` (add `<script src="js/core/transformApplyMode.js"></script>` immediately before `transformRecipeStages.js`)

**Interfaces:**
- Consumes: none (pure)
- Produces:
  - `TransformApplyMode.STORAGE_KEY` → `'transform-encode-decode-mode'`
  - `TransformApplyMode.normalizeMode(value)` → `'encode' | 'decode'`
  - `TransformApplyMode.loadMode(storage)` → `'encode' | 'decode'`
  - `TransformApplyMode.saveMode(storage, mode)` → void
  - `TransformApplyMode.resolveAction(transform, mode)` → `'encode' | 'reverse' | 'ai_decode'`
  - `TransformApplyMode.describeForAiDecode(transform, chainsApi)` → `string`

- [ ] **Step 1: Write the failing test**

Create `tests/test_transform_apply_mode.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function load(rel) {
    const ctx = { console, window: null };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), ctx, { filename: rel });
    return ctx;
}

const ctx = load('js/core/transformApplyMode.js');
const M = ctx.TransformApplyMode;
assert.ok(M, 'TransformApplyMode global');

assert.strictEqual(M.normalizeMode('decode'), 'decode');
assert.strictEqual(M.normalizeMode('ENCODE'), 'encode');
assert.strictEqual(M.normalizeMode('nope'), 'encode');

const store = Object.create(null);
const storage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
};
assert.strictEqual(M.loadMode(storage), 'encode');
M.saveMode(storage, 'decode');
assert.strictEqual(store[M.STORAGE_KEY], 'decode');
assert.strictEqual(M.loadMode(storage), 'decode');

const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');

assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);

console.log('test_transform_apply_mode: OK');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_transform_apply_mode.js`  
Expected: FAIL (cannot find module / TransformApplyMode undefined)

- [ ] **Step 3: Write minimal implementation**

Create `js/core/transformApplyMode.js`:

```javascript
(function(global) {
    var STORAGE_KEY = 'transform-encode-decode-mode';

    function normalizeMode(value) {
        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
    }

    function loadMode(storage) {
        try {
            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
        } catch (e) {
            return 'encode';
        }
    }

    function saveMode(storage, mode) {
        try {
            if (storage && typeof storage.setItem === 'function') {
                storage.setItem(STORAGE_KEY, normalizeMode(mode));
            }
        } catch (e) { /* ignore quota */ }
    }

    function isMechanicallyReversible(transform) {
        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
    }

    /**
     * @returns {'encode'|'reverse'|'ai_decode'}
     */
    function resolveAction(transform, mode) {
        if (!transform) return 'encode';
        if (normalizeMode(mode) !== 'decode') return 'encode';
        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
    }

    function describeForAiDecode(transform, chainsApi) {
        if (!transform) return 'Unknown transform';
        if (chainsApi && transform.isChain && transform.chainId) {
            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
                .filter(function(c) { return c.id === transform.chainId; })[0];
            if (chain && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(chain, 'chain');
            }
        }
        if (chainsApi && transform.isCycle && transform.cycleId) {
            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
                .filter(function(c) { return c.id === transform.cycleId; })[0];
            if (cycle && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(cycle, 'cycle');
            }
        }
        var bits = [transform.name || 'Transform'];
        if (transform.description) bits.push(transform.description);
        return bits.join(' — ');
    }

    global.TransformApplyMode = {
        STORAGE_KEY: STORAGE_KEY,
        normalizeMode: normalizeMode,
        loadMode: loadMode,
        saveMode: saveMode,
        resolveAction: resolveAction,
        describeForAiDecode: describeForAiDecode
    };
})(typeof window !== 'undefined' ? window : this);
```

In `index.template.html`, add before the recipe/chains scripts:

```html
<script src="js/core/transformApplyMode.js"></script>
<script src="js/core/transformRecipeStages.js"></script>
<script src="js/core/transformChains.js"></script>
```

Add to `package.json`:

```json
"test:apply-mode": "node tests/test_transform_apply_mode.js",
"test:all": "... existing ... && npm run test:apply-mode"
```

(Keep existing `test:all` segments; append `&& npm run test:apply-mode`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/test_transform_apply_mode.js`  
Expected: `test_transform_apply_mode: OK`

Run: `npm run test:all`  
Expected: exit 0 (or at least apply-mode + recipes/chains still OK)

- [ ] **Step 5: Commit**

```bash
git add js/core/transformApplyMode.js tests/test_transform_apply_mode.js package.json index.template.html
git commit -m "$(cat <<'EOF'
feat: add transform encode/decode mode helper

EOF
)"
```

---

