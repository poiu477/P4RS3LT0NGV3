# Review Package Task 7
Base: c83c383222314118a8f9e58fa44e89976dbafb30
Head: bb04cee3ce6e283661939ef9afc7720601fdbdf1

## Commits
bb04cee test: assert raw localStorage unchanged on chain rejection
f37aefb test: strengthen TransformChains assertions for persistence and rollback
5d157c7 test: add TransformChains unit coverage

## Stat
 package.json                   |   3 +-
 tests/test_transform_chains.js | 143 +++++++++++++++++++++++++++++++++++++++++
 2 files changed, 145 insertions(+), 1 deletion(-)

## Diff
```diff
diff --git a/package.json b/package.json
index 35fe727..bb6c180 100644
--- a/package.json
+++ b/package.json
@@ -14,17 +14,18 @@
     "build": "npm run build:tools && npm run build:codes-vendor && npm run build:copy && npm run build:index && npm run build:transforms && npm run build:emoji && npm run build:templates",
     "start": "serve dist -l 8080",
     "preview": "npm run build && serve dist -l 8080",
     "test": "node tests/test_universal.js",
     "test:lexeme": "node tests/test_lexeme_analysis.js",
     "test:lexeme-ui": "node tests/test_lexeme_ui_surface.js",
     "test:universal": "node tests/test_universal.js",
     "test:steg": "node tests/test_steganography_options.js",
-    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui",
+    "test:chains": "node tests/test_transform_chains.js",
+    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains",
     "precommit": "npm run test:all"
   },
   "repository": {
     "type": "git",
     "url": "."
   },
   "keywords": [
     "encoder",
diff --git a/tests/test_transform_chains.js b/tests/test_transform_chains.js
new file mode 100644
index 0000000..7b4f1c0
--- /dev/null
+++ b/tests/test_transform_chains.js
@@ -0,0 +1,143 @@
+#!/usr/bin/env node
+const assert = require('assert');
+const path = require('path');
+const fs = require('fs');
+const vm = require('vm');
+
+function createContext() {
+    const store = Object.create(null);
+    const ctx = {
+        window: null,
+        console,
+        localStorage: {
+            getItem: (k) => (k in store ? store[k] : null),
+            setItem: (k, v) => { store[k] = String(v); },
+            _store: store
+        }
+    };
+    ctx.window = ctx;
+    return ctx;
+}
+
+function load(ctx, rel) {
+    const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
+    vm.runInContext(code, ctx, { filename: rel });
+}
+
+const ctx = createContext();
+vm.createContext(ctx);
+ctx.transforms = {
+    base64: {
+        name: 'Base64',
+        category: 'encoding',
+        func: (t) => Buffer.from(t, 'utf8').toString('base64'),
+        reverse: (t) => Buffer.from(t, 'base64').toString('utf8'),
+        canDecode: true
+    },
+    caesar: {
+        name: 'Caesar Cipher',
+        category: 'cipher',
+        configurableOptions: [{ id: 'shift', default: 3 }],
+        func: (t, o) => t,
+        reverse: (t, o) => t,
+        canDecode: true
+    }
+};
+load(ctx, 'js/core/transformChains.js');
+const TC = ctx.TransformChains;
+assert.ok(TC, 'TransformChains global');
+
+// sanitize / null filtering via save+load
+const id = TC.saveChain({
+    name: 'Demo',
+    nodes: [
+        { transform: 'caesar', options: { shift: 3 } },
+        { transform: 'base64', options: {} }
+    ]
+});
+assert.ok(id);
+const storedChains = JSON.parse(ctx.localStorage._store['transform-chains-v1']);
+storedChains[0].nodes.splice(1, 0, null);
+ctx.localStorage._store['transform-chains-v1'] = JSON.stringify(storedChains);
+const chains = TC.loadChains();
+assert.strictEqual(chains.length, 1);
+assert.strictEqual(chains[0].nodes.length, 2);
+assert.deepStrictEqual(
+    Array.from(chains[0].nodes, (node) => node.transform),
+    ['caesar', 'base64']
+);
+assert.strictEqual(chains[0].nodes[0].options.shift, 3);
+assert.deepStrictEqual(Object.keys(chains[0].nodes[1].options), []);
+
+// nesting reject
+TC.syncTransforms();
+const beforeNestedChains = JSON.stringify(TC.loadChains());
+const beforeNestedChainStorage = ctx.localStorage.getItem('transform-chains-v1');
+const nested = TC.saveChain({
+    name: 'Bad',
+    nodes: [{ transform: 'chain_' + id, options: {} }]
+});
+assert.strictEqual(nested, null);
+assert.strictEqual(
+    ctx.localStorage.getItem('transform-chains-v1'),
+    beforeNestedChainStorage
+);
+assert.strictEqual(JSON.stringify(TC.loadChains()), beforeNestedChains);
+
+// describe includes options
+const recipe = TC.describeChain(chains[0]);
+assert.ok(recipe.indexOf('caesar') !== -1);
+assert.ok(recipe.indexOf('"shift":3') !== -1 || recipe.indexOf('"shift": 3') !== -1);
+
+// cycle validation
+const beforeEmptyCycle = JSON.stringify(TC.loadCycles());
+const beforeEmptyCycleStorage = ctx.localStorage.getItem('transform-cycles-v1');
+assert.strictEqual(TC.saveCycle({ name: 'C', chainIds: [] }), null);
+assert.strictEqual(
+    ctx.localStorage.getItem('transform-cycles-v1'),
+    beforeEmptyCycleStorage
+);
+assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeEmptyCycle);
+const cyId = TC.saveCycle({ name: 'C', chainIds: [id] });
+assert.ok(cyId);
+const cycles = TC.loadCycles();
+assert.strictEqual(cycles.length, 1);
+assert.strictEqual(cycles[0].id, cyId);
+assert.strictEqual(cycles[0].name, 'C');
+assert.deepStrictEqual(Array.from(cycles[0].chainIds), [id]);
+
+// write failure rollback on deleteChain
+const beforeChains = JSON.stringify(TC.loadChains());
+const beforeCycles = JSON.stringify(TC.loadCycles());
+let calls = 0;
+let failureFired = false;
+const writeKeys = [];
+const realSet = ctx.localStorage.setItem.bind(ctx.localStorage);
+ctx.localStorage.setItem = (k, v) => {
+    calls += 1;
+    writeKeys.push(k);
+    if (calls === 2) {
+        failureFired = true;
+        throw new Error('fail cycle write');
+    }
+    return realSet(k, v);
+};
+const deleted = TC.deleteChain(id);
+assert.strictEqual(deleted, false);
+ctx.localStorage.setItem = realSet;
+assert.strictEqual(failureFired, true);
+assert.strictEqual(calls, 3);
+assert.deepStrictEqual(writeKeys, [
+    'transform-chains-v1',
+    'transform-cycles-v1',
+    'transform-chains-v1'
+]);
+const storageKeys = Object.keys(ctx.localStorage._store).sort();
+assert.deepStrictEqual(storageKeys, ['transform-chains-v1', 'transform-cycles-v1']);
+assert.strictEqual(storageKeys.length, 2);
+assert.strictEqual(ctx.localStorage._store['transform-chains-v1'], beforeChains);
+assert.strictEqual(ctx.localStorage._store['transform-cycles-v1'], beforeCycles);
+assert.strictEqual(JSON.stringify(TC.loadChains()), beforeChains);
+assert.strictEqual(JSON.stringify(TC.loadCycles()), beforeCycles);
+
+console.log('test_transform_chains: OK');

```