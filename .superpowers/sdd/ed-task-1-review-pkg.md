# Review package: 9c041cfdcbd94499f26e7e153510c0e8f949daca..HEAD

## Commits
009047f feat: add transform encode/decode mode helper

## Files changed
 index.template.html                |  1 +
 js/core/transformApplyMode.js      | 66 ++++++++++++++++++++++++++++++++++++++
 package.json                       |  3 +-
 tests/test_transform_apply_mode.js | 42 ++++++++++++++++++++++++
 4 files changed, 111 insertions(+), 1 deletion(-)

## Diff
diff --git a/index.template.html b/index.template.html
index f3c1310..eb3a9fd 100644
--- a/index.template.html
+++ b/index.template.html
@@ -538,20 +538,21 @@
 
     <!-- Load JavaScript files after Vue template -->
     <!-- Data files (generated/static data) -->
     <script src="js/data/emojiData.js"></script>
     <script src="js/data/emojiCompatibility.js"></script>
     
     <!-- Generated bundles -->
     <script src="js/bundles/transforms-bundle.js"></script>
     <script src="js/core/spellingAlphabetTransform.js"></script>
     <script src="js/core/customSpellingAlphabets.js"></script>
+    <script src="js/core/transformApplyMode.js"></script>
     <script src="js/core/transformRecipeStages.js"></script>
     <script src="js/core/transformChains.js"></script>
     
     <!-- Glitch Tokens Data -->
     <script src="js/data/glitchTokens.js"></script>
     <script src="js/data/endSequences.js"></script>
     <script src="js/data/openrouterModels.js"></script>
     <script src="js/data/anticlassifierPrompt.js"></script>
     <script src="js/data/latinAffixPolicies.js"></script>
     
diff --git a/js/core/transformApplyMode.js b/js/core/transformApplyMode.js
new file mode 100644
index 0000000..372ab2b
--- /dev/null
+++ b/js/core/transformApplyMode.js
@@ -0,0 +1,66 @@
+(function(global) {
+    var STORAGE_KEY = 'transform-encode-decode-mode';
+
+    function normalizeMode(value) {
+        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
+    }
+
+    function loadMode(storage) {
+        try {
+            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
+        } catch (e) {
+            return 'encode';
+        }
+    }
+
+    function saveMode(storage, mode) {
+        try {
+            if (storage && typeof storage.setItem === 'function') {
+                storage.setItem(STORAGE_KEY, normalizeMode(mode));
+            }
+        } catch (e) { /* ignore quota */ }
+    }
+
+    function isMechanicallyReversible(transform) {
+        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
+    }
+
+    /**
+     * @returns {'encode'|'reverse'|'ai_decode'}
+     */
+    function resolveAction(transform, mode) {
+        if (!transform) return 'encode';
+        if (normalizeMode(mode) !== 'decode') return 'encode';
+        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
+    }
+
+    function describeForAiDecode(transform, chainsApi) {
+        if (!transform) return 'Unknown transform';
+        if (chainsApi && transform.isChain && transform.chainId) {
+            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
+                .filter(function(c) { return c.id === transform.chainId; })[0];
+            if (chain && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(chain, 'chain');
+            }
+        }
+        if (chainsApi && transform.isCycle && transform.cycleId) {
+            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
+                .filter(function(c) { return c.id === transform.cycleId; })[0];
+            if (cycle && chainsApi.describeRecipe) {
+                return chainsApi.describeRecipe(cycle, 'cycle');
+            }
+        }
+        var bits = [transform.name || 'Transform'];
+        if (transform.description) bits.push(transform.description);
+        return bits.join(' — ');
+    }
+
+    global.TransformApplyMode = {
+        STORAGE_KEY: STORAGE_KEY,
+        normalizeMode: normalizeMode,
+        loadMode: loadMode,
+        saveMode: saveMode,
+        resolveAction: resolveAction,
+        describeForAiDecode: describeForAiDecode
+    };
+})(typeof window !== 'undefined' ? window : this);
diff --git a/package.json b/package.json
index 057e39f..63cc11a 100644
--- a/package.json
+++ b/package.json
@@ -14,21 +14,22 @@
     "build": "npm run build:tools && npm run build:codes-vendor && npm run build:copy && npm run build:index && npm run build:transforms && npm run build:emoji && npm run build:templates",
     "start": "serve dist -l 8080",
     "preview": "npm run build && serve dist -l 8080",
     "test": "node tests/test_universal.js",
     "test:lexeme": "node tests/test_lexeme_analysis.js",
     "test:lexeme-ui": "node tests/test_lexeme_ui_surface.js",
     "test:universal": "node tests/test_universal.js",
     "test:steg": "node tests/test_steganography_options.js",
     "test:chains": "node tests/test_transform_chains.js",
     "test:recipes": "node tests/test_transform_recipes.js",
-    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes",
+    "test:apply-mode": "node tests/test_transform_apply_mode.js",
+    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes && npm run test:apply-mode",
     "precommit": "npm run test:all"
   },
   "repository": {
     "type": "git",
     "url": "."
   },
   "keywords": [
     "encoder",
     "decoder",
     "steganography",
diff --git a/tests/test_transform_apply_mode.js b/tests/test_transform_apply_mode.js
new file mode 100644
index 0000000..e2ab410
--- /dev/null
+++ b/tests/test_transform_apply_mode.js
@@ -0,0 +1,42 @@
+#!/usr/bin/env node
+const assert = require('assert');
+const path = require('path');
+const fs = require('fs');
+const vm = require('vm');
+
+function load(rel) {
+    const ctx = { console, window: null };
+    ctx.window = ctx;
+    vm.createContext(ctx);
+    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), ctx, { filename: rel });
+    return ctx;
+}
+
+const ctx = load('js/core/transformApplyMode.js');
+const M = ctx.TransformApplyMode;
+assert.ok(M, 'TransformApplyMode global');
+
+assert.strictEqual(M.normalizeMode('decode'), 'decode');
+assert.strictEqual(M.normalizeMode('ENCODE'), 'encode');
+assert.strictEqual(M.normalizeMode('nope'), 'encode');
+
+const store = Object.create(null);
+const storage = {
+    getItem: (k) => (k in store ? store[k] : null),
+    setItem: (k, v) => { store[k] = String(v); }
+};
+assert.strictEqual(M.loadMode(storage), 'encode');
+M.saveMode(storage, 'decode');
+assert.strictEqual(store[M.STORAGE_KEY], 'decode');
+assert.strictEqual(M.loadMode(storage), 'decode');
+
+const reversible = { name: 'Caesar', canDecode: true, reverse: function() {} };
+const irreversible = { name: 'OneWay', canDecode: false, reverse: null };
+assert.strictEqual(M.resolveAction(reversible, 'encode'), 'encode');
+assert.strictEqual(M.resolveAction(reversible, 'decode'), 'reverse');
+assert.strictEqual(M.resolveAction(irreversible, 'decode'), 'ai_decode');
+assert.strictEqual(M.resolveAction(null, 'decode'), 'encode');
+
+assert.ok(M.describeForAiDecode({ name: 'Bold', description: 'Unicode bold' }, null).indexOf('Bold') !== -1);
+
+console.log('test_transform_apply_mode: OK');
