const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'js', 'core', 'transformChains.js'), 'utf8');
const values = {};
let failingKey = '';
const context = {
    console,
    crypto: { randomUUID: () => 'test-id-0000' },
    localStorage: {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
        },
        setItem(key, value) {
            if (key === failingKey) throw new Error('storage unavailable');
            values[key] = value;
        }
    },
    transforms: {
        upper: {
            name: 'Upper',
            func: value => value.toUpperCase(),
            reverse: value => value.toLowerCase()
        }
    }
};
context.window = context;
vm.runInNewContext(source, context);

const chains = context.TransformChains;
assert.strictEqual(typeof chains.getLastMutationError, 'function');

assert.strictEqual(chains.saveChain({
    name: 'Nested',
    nodes: [{ transform: 'chain_other', options: {} }]
}), null);
assert.strictEqual(chains.getLastMutationError(), 'Chains cannot nest other saved chains or cycles.');

failingKey = 'transform-chains-v1';
assert.strictEqual(chains.saveChain({
    name: 'Storage failure',
    nodes: [{ transform: 'upper', options: {} }]
}), null);
assert.strictEqual(chains.getLastMutationError(), 'Could not write chains to browser storage.');
assert.strictEqual(chains.deleteChain('missing'), false);
assert.strictEqual(chains.getLastMutationError(), 'Could not write chains to browser storage.');

failingKey = 'transform-cycles-v1';
assert.strictEqual(chains.saveCycle({ name: 'Storage failure', chainIds: ['one'] }), null);
assert.strictEqual(chains.getLastMutationError(), 'Could not write cycles to browser storage.');
assert.strictEqual(chains.deleteCycle('missing'), false);
assert.strictEqual(chains.getLastMutationError(), 'Could not write cycles to browser storage.');

failingKey = '';
assert.ok(chains.saveChain({
    name: 'Works',
    nodes: [{ transform: 'upper', options: {} }]
}));
assert.strictEqual(chains.getLastMutationError(), '');

console.log('Task 2 focused checks passed');
