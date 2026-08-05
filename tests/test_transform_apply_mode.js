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

// describeForAiDecode chain/cycle branches (regression guard for Critical 2 —
// buildTransformsFromWindow must forward isChain/isCycle/chainId/cycleId or
// these branches are skipped and only the bare display name reaches the AI
// decode prompt). Exercised against a minimal stub chainsApi first, then
// against the real TransformChains + TransformRecipeStages modules so the
// recipe string produced is the actual step-by-step recipe, not the name.
const stubChainsApi = {
    loadChains: () => [{ id: 'c1', name: 'Secret Sauce', kind: 'staged', stages: {} }],
    loadCycles: () => [{ id: 'cy1', name: 'My Cycle', chainIds: ['c1'] }],
    describeRecipe: (entity, kind) => 'RECIPE[' + kind + ':' + entity.id + ']'
};
assert.strictEqual(
    M.describeForAiDecode({ name: 'Secret Sauce', isChain: true, chainId: 'c1' }, stubChainsApi),
    'RECIPE[chain:c1]',
    'chain branch must call describeRecipe rather than returning the bare name'
);
assert.strictEqual(
    M.describeForAiDecode({ name: 'My Cycle', isCycle: true, cycleId: 'cy1' }, stubChainsApi),
    'RECIPE[cycle:cy1]',
    'cycle branch must call describeRecipe rather than returning the bare name'
);
// Without isChain/isCycle (the pre-fix shape buildTransformsFromWindow produced),
// both branches must be skipped and the name-only fallback used instead.
assert.strictEqual(
    M.describeForAiDecode({ name: 'Secret Sauce', chainId: 'c1' }, stubChainsApi),
    'Secret Sauce'
);

function loadIntoFullContext(rels) {
    const store = Object.create(null);
    const fullCtx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            _store: store
        }
    };
    fullCtx.window = fullCtx;
    vm.createContext(fullCtx);
    fullCtx.transforms = {
        caesar: { name: 'Caesar', category: 'cipher', canDecode: true, func: (t) => t, reverse: (t) => t }
    };
    rels.forEach((rel) => {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), fullCtx, { filename: rel });
    });
    return fullCtx;
}

const fullCtx = loadIntoFullContext([
    'js/core/transformRecipeStages.js',
    'js/core/transformChains.js',
    'js/core/transformApplyMode.js'
]);
const FTC = fullCtx.TransformChains;
const FM = fullCtx.TransformApplyMode;

const recipeId = FTC.saveRecipe({
    name: 'Secret Sauce',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: { type: 'translate', lang: 'la', model: '' },
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null,
        conceal: null,
        carrier: null
    }
});
assert.ok(recipeId, 'staged recipe with a translate stage saved');

const recipeDescribed = FM.describeForAiDecode(
    { name: 'Secret Sauce', isChain: true, chainId: recipeId },
    FTC
);
assert.notStrictEqual(recipeDescribed, 'Secret Sauce', 'must not fall back to the bare display name');
assert.match(recipeDescribed, /Caesar/, 'recipe description names the obfuscate step');
assert.match(recipeDescribed, /Latin/i, 'recipe description includes the translate stage the mapping used to drop');

const freeformId = FTC.saveChain({
    name: 'Freeform',
    nodes: [{ transform: 'caesar', options: { shift: 3 } }]
});
const cycleId = FTC.saveCycle({ name: 'My Cycle', chainIds: [freeformId], mode: 'one_way' });
assert.ok(cycleId, 'cycle saved');
const cycleDescribed = FM.describeForAiDecode(
    { name: 'My Cycle', isCycle: true, cycleId: cycleId },
    FTC
);
assert.notStrictEqual(cycleDescribed, 'My Cycle');
assert.match(cycleDescribed, /Per-word cycle/);
assert.match(cycleDescribed, /Caesar/);

console.log('test_transform_apply_mode: OK');
