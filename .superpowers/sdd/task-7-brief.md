### Task 7: Automated tests for TransformChains

**Files:**
- Create: `tests/test_transform_chains.js`
- Modify: `package.json` (`test:chains`, include in `test:all`)

**Interfaces:**
- Follow `tests/test_custom_spelling_transforms.js` pattern: `vm` context + `localStorage` mock + load scripts

- [ ] **Step 1: Write the test file**

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function createContext() {
    const store = Object.create(null);
    let quotaBlocked = false;
    const ctx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
                if (quotaBlocked) {
                    const err = new Error('quota');
                    throw err;
                }
                store[k] = String(v);
            },
            _block: (b) => { quotaBlocked = !!b; },
            _store: store
        }
    };
    ctx.window = ctx;
    return ctx;
}

function load(ctx, rel) {
    const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
}

const ctx = createContext();
vm.createContext(ctx);
ctx.transforms = {
    base64: {
        name: 'Base64',
        category: 'encoding',
        func: (t) => Buffer.from(t, 'utf8').toString('base64'),
        reverse: (t) => Buffer.from(t, 'base64').toString('utf8'),
        canDecode: true
    },
    caesar: {
        name: 'Caesar Cipher',
        category: 'cipher',
        configurableOptions: [{ id: 'shift', default: 3 }],
        func: (t, o) => t, // stub
        reverse: (t, o) => t,
        canDecode: true
    }
};
load(ctx, 'js/core/transformChains.js');
const TC = ctx.TransformChains;
assert.ok(TC, 'TransformChains global');

// sanitize / null filtering via save+load
const id = TC.saveChain({
    name: 'Demo',
    nodes: [
        { transform: 'caesar', options: { shift: 3 } },
        null,
        { transform: 'base64', options: {} }
    ]
});
assert.ok(id);
const chains = TC.loadChains();
assert.strictEqual(chains.length, 1);
assert.strictEqual(chains[0].nodes.length, 2);

// nesting reject
TC.syncTransforms();
const nested = TC.saveChain({
    name: 'Bad',
    nodes: [{ transform: 'chain_' + id, options: {} }]
});
assert.strictEqual(nested, null);

// describe includes options
const recipe = TC.describeChain(chains[0]);
assert.ok(recipe.indexOf('caesar') !== -1);
assert.ok(recipe.indexOf('"shift":3') !== -1 || recipe.indexOf('"shift": 3') !== -1);

// cycle validation
assert.strictEqual(TC.saveCycle({ name: 'C', chainIds: [] }), null);
const cyId = TC.saveCycle({ name: 'C', chainIds: [id] });
assert.ok(cyId);

// write failure rollback on deleteChain
const beforeChains = JSON.stringify(TC.loadChains());
const beforeCycles = JSON.stringify(TC.loadCycles());
ctx.localStorage._block(true);
// First write may throw inside writeList and return false — depending on implementation,
// unblock after forcing failure path. Prefer stubbing by temporarily replacing setItem mid-delete:
ctx.localStorage._block(false);
let calls = 0;
const realSet = ctx.localStorage.setItem.bind(ctx.localStorage);
ctx.localStorage.setItem = (k, v) => {
    calls += 1;
    if (calls === 2) throw new Error('fail cycle write');
    return realSet(k, v);
};
const deleted = TC.deleteChain(id);
assert.strictEqual(deleted, false);
ctx.localStorage.setItem = realSet;
assert.strictEqual(JSON.stringify(TC.loadChains()), beforeChains);
assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeCycles);

console.log('test_transform_chains: OK');
```

Adjust the rollback test if `writeList` catches throws (it does — `setItem` throw → `false`). For the second-write failure simulation, wrap so the first `setItem` succeeds and the second throws.

- [ ] **Step 2: Wire package scripts**

```json
"test:chains": "node tests/test_transform_chains.js",
"test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains"
```

- [ ] **Step 3: Run tests**

```bash
node tests/test_transform_chains.js
npm run test:chains
```

Expected: `test_transform_chains: OK`

- [ ] **Step 4: Commit**

```bash
git add tests/test_transform_chains.js package.json
git commit -m "test: add TransformChains unit coverage"
```

---

