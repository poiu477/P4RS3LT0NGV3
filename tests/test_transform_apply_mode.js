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
