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
}, ctx.transforms) != null, true, 'theban not allowed in obfuscate');

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

load(ctx, 'js/core/transformChains.js');
const TC = ctx.TransformChains;

const rid = TC.saveRecipe({
    name: 'Staged Demo',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        conceal: null,
        carrier: null
    }
});
assert.ok(rid);
const loaded = TC.loadChains().filter(c => c.id === rid)[0];
assert.strictEqual(loaded.kind, 'staged');
assert.strictEqual(loaded.stages.obfuscate[0].transform, 'caesar');

const persisted = JSON.parse(ctx.localStorage._store['transform-chains-v1']);
persisted.push({
    id: 'legacy-demo',
    name: 'Legacy Demo',
    nodes: [{ transform: 'base64', options: {} }]
});
ctx.localStorage.setItem('transform-chains-v1', JSON.stringify(persisted));
const legacy = TC.loadChains().filter(c => c.id === 'legacy-demo')[0];
assert.strictEqual(legacy.kind, 'freeform');
assert.deepStrictEqual(Array.from(TC.loadRecipes(), c => c.id), [rid]);
assert.ok(ctx.transforms[`chain_${rid}`], 'staged recipe registered as a transform');
assert.match(ctx.transforms[`chain_${rid}`].description, /Caesar \[caesar\].*Theban \[theban\]/);

assert.strictEqual(TC.saveRecipe({
    name: 'Bad',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'theban', options: {} }],
        present: null,
        translate: null,
        normalize: null,
        conceal: null,
        carrier: null
    }
}), null);

console.log('test_transform_recipes: OK');
