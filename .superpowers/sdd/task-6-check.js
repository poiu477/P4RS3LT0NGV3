#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');
const transformTool = fs.readFileSync(path.join(projectRoot, 'js', 'tools', 'TransformTool.js'), 'utf8');
const transformsTemplate = fs.readFileSync(path.join(projectRoot, 'templates', 'transforms.html'), 'utf8');

assert.ok(
    transformTool.includes("chainDecodeModel: localStorage.getItem('chain-decode-model') || localStorage.getItem('translate-model') || ''"),
    'decode model should initialize from chain preference, then translation preference'
);
assert.ok(
    transformTool.includes("this.getMergedOptionsForTransform(t.name)"),
    'new chain nodes should seed options from current transform preferences'
);
assert.ok(
    transformTool.includes("window.TransformChains.aiDecode(recipe, this.chainDecodeInput, { model: this.chainDecodeModel })"),
    'AI chain decode should pass the selected model'
);
assert.ok(
    transformTool.includes("localStorage.setItem('chain-decode-model', this.chainDecodeModel)"),
    'AI chain decode should persist the selected model'
);
assert.ok(transformTool.includes('chainCopyRecipe: function(entity, kind)'), 'recipe copy method should exist');
assert.ok(transformTool.includes('chainExportAll: function()'), 'chain export method should exist');
assert.ok(transformTool.includes('chainImportAll: function(file)'), 'chain import method should exist');

assert.strictEqual(
    (transformsTemplate.match(/<openrouter-model-select v-model="chainDecodeModel" label="Decode model"><\/openrouter-model-select>/g) || []).length,
    2,
    'both AI decode panels should expose the decode model selector'
);
assert.strictEqual(
    (transformsTemplate.match(/@click="chainCopyRecipe\((chain|cycle), '(chain|cycle)'\)"/g) || []).length,
    2,
    'chain and cycle cards should expose recipe copy actions'
);
assert.ok(transformsTemplate.includes('@click="chainExportAll"'), 'chains manager should expose export');
assert.ok(
    /type="file"\s+accept="application\/json,.json"/.test(transformsTemplate),
    'chains manager should expose JSON import'
);
assert.ok(transformsTemplate.includes('chainImportAll($event.target.files[0])'), 'JSON import should pass the selected file');
assert.ok(
    transformsTemplate.includes("chainImportAll($event.target.files[0]); $event.target.value = ''"),
    'JSON import should reset the file input'
);

global.Tool = class Tool {
    constructor() {}
};
global.FileReader = class FileReader {
    readAsText(file) {
        this.result = file.contents;
        this.onload();
    }
};

const TransformTool = require(path.join(projectRoot, 'js', 'tools', 'TransformTool.js'));
const methods = new TransformTool().getVueMethods();
const notifications = [];
let refreshCount = 0;
let chainSaveCount = 0;

global.window = {
    TransformChains: {
        saveChain() {
            chainSaveCount += 1;
            return chainSaveCount === 1 ? 'chain-1' : null;
        },
        saveCycle() {
            return null;
        },
        getLastMutationError() {
            return 'Rejected imported definition';
        }
    }
};

methods.chainImportAll.call({
    refreshChainsTransforms() {
        refreshCount += 1;
    },
    showNotification(message, type) {
        notifications.push({ message, type });
    }
}, {
    contents: JSON.stringify({
        chains: [
            { id: 'chain-1', name: 'Valid', nodes: [] },
            { id: 'chain-2', name: 'Invalid', nodes: [] }
        ],
        cycles: [
            { id: 'cycle-1', name: 'Invalid cycle', chainIds: [] }
        ]
    })
});

assert.strictEqual(refreshCount, 1, 'partial import should refresh successful saves');
assert.strictEqual(notifications.length, 1, 'partial import should show one result notification');
assert.strictEqual(notifications[0].type, 'error', 'partial import should be reported as an error');
assert.ok(notifications[0].message.includes('1 imported'), 'partial import should count successful saves');
assert.ok(notifications[0].message.includes('2 failed'), 'partial import should count rejected saves');
assert.ok(
    notifications[0].message.includes('Rejected imported definition'),
    'partial import should include the storage mutation error'
);
assert.ok(!notifications[0].message.includes('Chains imported'), 'partial import must not claim full success');

console.log('Task 6 surface checks passed');
