### Task 1: Stage taxonomy module (allowlists + validation)

**Files:**
- Create: `js/core/transformRecipeStages.js`
- Test: `tests/test_transform_recipes.js`
- Modify: `package.json` (add `test:recipes`; append to `test:all`)
- Modify: `index.template.html` (script tag for `transformRecipeStages.js` **before** `transformChains.js`)

**Interfaces:**
- Produces:
  - `window.TransformRecipeStages.STAGE_ORDER` = `['normalize','translate','obfuscate','present','conceal','carrier']`
  - `isTransformAllowedInStage(stageId, transformKey, transformsMap) → boolean`
  - `validateStagedRecipe(recipe, transformsMap) → string|null` (error message or null if ok)
  - `flattenStagedToNodes(recipe) → Array<{transform, options}|{type:'translate',...}|{type:'qr'|'emoji_stego',...}>`
  - `TEMPLATES` — array of `{ id, name, stages }`

- [ ] **Step 1: Write failing tests**

Create `tests/test_transform_recipes.js`:

```javascript
#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function createContext() {
    const store = Object.create(null);
    const ctx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
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
    caesar: { name: 'Caesar', category: 'cipher', canDecode: true },
    base64: { name: 'Base64', category: 'encoding', canDecode: true },
    theban: { name: 'Theban', category: 'symbol', canDecode: true },
    bold: { name: 'Bold', category: 'unicode', canDecode: true },
    zero_width: { name: 'Zero-Width', category: 'concealment', canDecode: true },
    title_case: { name: 'Title Case', category: 'case', canDecode: true }
};
load(ctx, 'js/core/transformRecipeStages.js');
const S = ctx.TransformRecipeStages;
assert.ok(S, 'TransformRecipeStages global');

assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'caesar', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'theban', ctx.transforms), false);
assert.strictEqual(S.isTransformAllowedInStage('present', 'theban', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('normalize', 'title_case', ctx.transforms), true);

assert.strictEqual(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: { obfuscate: [], present: null, translate: null, normalize: null, conceal: null, carrier: null }
}, ctx.transforms), 'Add at least one obfuscate step.');

assert.strictEqual(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'theban', options: {} }],
        present: null, translate: null, normalize: null, conceal: null, carrier: null
    }
}, ctx.transforms) != null, 'theban not allowed in obfuscate');

assert.strictEqual(S.validateStagedRecipe({
    name: 'Good',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        translate: null, normalize: null, conceal: null,
        carrier: { type: 'qr', options: {} }
    }
}, ctx.transforms), null);

const flat = S.flattenStagedToNodes({
    stages: {
        translate: { type: 'translate', lang: 'la', model: 'm' },
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null, normalize: null, conceal: null,
        carrier: { type: 'emoji_stego', options: { carrier: '😀' } }
    }
});
assert.strictEqual(flat[0].type, 'translate');
assert.strictEqual(flat[1].transform, 'caesar');
assert.strictEqual(flat[flat.length - 1].type, 'emoji_stego');

console.log('test_transform_recipes: OK');
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
node tests/test_transform_recipes.js
```

Expected: cannot find module / `TransformRecipeStages` undefined.

- [ ] **Step 3: Implement `js/core/transformRecipeStages.js`**

```javascript
(function(global) {
    'use strict';

    var STAGE_ORDER = ['normalize', 'translate', 'obfuscate', 'present', 'conceal', 'carrier'];

    // Categories / keys allowed per stage (extend carefully; prefer category buckets).
    var STAGE_TRANSFORM_CATEGORIES = {
        normalize: ['case', 'format'],
        obfuscate: ['cipher', 'encoding', 'technical'],
        present: ['symbol', 'unicode', 'visual', 'custom_spelling', 'signwriting'],
        conceal: ['concealment']
    };

    // Deny-list inside otherwise-allowed categories (lossy / unsuitable for recipes).
    var STAGE_DENY_KEYS = {
        normalize: { random_mix: true, shuffle_words: true },
        obfuscate: { random_mix: true },
        present: { random_mix: true },
        conceal: {}
    };

    // Extra allow keys even if category differs (empty initially).
    var STAGE_ALLOW_KEYS = {
        normalize: {},
        obfuscate: {},
        present: {},
        conceal: {}
    };

    function isRecord(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function isTransformAllowedInStage(stageId, transformKey, transformsMap) {
        if (stageId === 'translate' || stageId === 'carrier') return false;
        if (typeof transformKey !== 'string' || !transformKey) return false;
        if (transformKey.indexOf('chain_') === 0 || transformKey.indexOf('cycle_') === 0) return false;
        var t = transformsMap && transformsMap[transformKey];
        if (!t) return false;
        if (STAGE_DENY_KEYS[stageId] && STAGE_DENY_KEYS[stageId][transformKey]) return false;
        if (STAGE_ALLOW_KEYS[stageId] && STAGE_ALLOW_KEYS[stageId][transformKey]) return true;
        var cats = STAGE_TRANSFORM_CATEGORIES[stageId] || [];
        var cat = t.category || '';
        return cats.indexOf(cat) !== -1;
    }

    function validateStagedRecipe(recipe, transformsMap) {
        if (!isRecord(recipe) || typeof recipe.name !== 'string' || !recipe.name.trim()) {
            return 'Name is required.';
        }
        var stages = recipe.stages;
        if (!isRecord(stages)) return 'Invalid stages.';
        var ob = stages.obfuscate;
        if (!Array.isArray(ob) || ob.length === 0) {
            return 'Add at least one obfuscate step.';
        }
        var i;
        for (i = 0; i < ob.length; i++) {
            if (!isTransformAllowedInStage('obfuscate', ob[i] && ob[i].transform, transformsMap)) {
                return 'Transform not allowed in Obfuscate: ' + ((ob[i] && ob[i].transform) || '?');
            }
        }
        var multi = ['normalize', 'present', 'conceal'];
        for (i = 0; i < multi.length; i++) {
            var sid = multi[i];
            var nodes = stages[sid];
            if (nodes == null) continue;
            if (!Array.isArray(nodes)) return 'Invalid ' + sid + ' stage.';
            for (var j = 0; j < nodes.length; j++) {
                if (!isTransformAllowedInStage(sid, nodes[j] && nodes[j].transform, transformsMap)) {
                    return 'Transform not allowed in ' + sid + ': ' + ((nodes[j] && nodes[j].transform) || '?');
                }
            }
        }
        if (stages.translate != null) {
            if (!isRecord(stages.translate) || stages.translate.type !== 'translate') {
                return 'Invalid translate stage.';
            }
            if (!stages.translate.lang) return 'Translate stage needs a language.';
        }
        if (stages.carrier != null) {
            if (!isRecord(stages.carrier)) return 'Invalid carrier stage.';
            if (stages.carrier.type !== 'qr' && stages.carrier.type !== 'emoji_stego') {
                return 'Carrier must be qr or emoji_stego.';
            }
        }
        return null;
    }

    function flattenStagedToNodes(recipe) {
        var stages = (recipe && recipe.stages) || {};
        var out = [];
        function pushNodes(arr) {
            if (!Array.isArray(arr)) return;
            for (var i = 0; i < arr.length; i++) out.push(arr[i]);
        }
        pushNodes(stages.normalize);
        if (stages.translate) out.push(stages.translate);
        pushNodes(stages.obfuscate);
        pushNodes(stages.present);
        pushNodes(stages.conceal);
        if (stages.carrier) out.push(stages.carrier);
        return out;
    }

    var TEMPLATES = [
        {
            id: 'cipher-base64',
            name: 'Cipher → Base64',
            stages: {
                normalize: null,
                translate: null,
                obfuscate: [
                    { transform: 'caesar', options: { shift: 3 } },
                    { transform: 'base64', options: {} }
                ],
                present: null,
                conceal: null,
                carrier: null
            }
        },
        {
            id: 'translate-theban',
            name: 'Translate → Theban',
            stages: {
                normalize: null,
                translate: { type: 'translate', lang: 'la', model: '' },
                obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
                present: [{ transform: 'theban', options: {} }],
                conceal: null,
                carrier: null
            }
        },
        {
            id: 'cipher-qr',
            name: 'Cipher → Base64 → QR',
            stages: {
                normalize: null,
                translate: null,
                obfuscate: [
                    { transform: 'caesar', options: { shift: 3 } },
                    { transform: 'base64', options: {} }
                ],
                present: null,
                conceal: null,
                carrier: { type: 'qr', options: {} }
            }
        }
    ];

    global.TransformRecipeStages = {
        STAGE_ORDER: STAGE_ORDER,
        STAGE_TRANSFORM_CATEGORIES: STAGE_TRANSFORM_CATEGORIES,
        isTransformAllowedInStage: isTransformAllowedInStage,
        validateStagedRecipe: validateStagedRecipe,
        flattenStagedToNodes: flattenStagedToNodes,
        TEMPLATES: TEMPLATES
    };
})(typeof window !== 'undefined' ? window : this);
```

Tune allowlists if a category mapping is wrong for a specific key (add to `STAGE_ALLOW_KEYS` / `STAGE_DENY_KEYS`). Ensure `rot13` exists or change the translate-theban template obfuscate node to `caesar` if needed for tests.

- [ ] **Step 4: Wire script + npm**

In `index.template.html`, add before `transformChains.js`:

```html
<script src="js/core/transformRecipeStages.js"></script>
```

In `package.json`:

```json
"test:recipes": "node tests/test_transform_recipes.js",
"test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes"
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm run test:recipes
```

Expected: `test_transform_recipes: OK`

- [ ] **Step 6: Commit**

```bash
git add js/core/transformRecipeStages.js tests/test_transform_recipes.js package.json index.template.html
git commit -m "feat: add staged recipe stage taxonomy and validation"
```

---

