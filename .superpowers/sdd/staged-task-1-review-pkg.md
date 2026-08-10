# Review Package Staged Task 1
Base: 7cfb7169bdd01c92ae29905fa3e40ab3b4a837e5
Head: 401f755f2a22617b5624546a814891ffb02282a6

## Commits
401f755 feat: add staged recipe stage taxonomy and validation

## Stat
 index.template.html              |   1 +
 js/core/transformRecipeStages.js | 159 +++++++++++++++++++++++++++++++++++++++
 package.json                     |   3 +-
 tests/test_transform_recipes.js  |  84 +++++++++++++++++++++
 4 files changed, 246 insertions(+), 1 deletion(-)

## Diff
```diff
diff --git a/index.template.html b/index.template.html
index 57fcf1d..f3c1310 100644
--- a/index.template.html
+++ b/index.template.html
@@ -540,16 +540,17 @@
     <!-- Data files (generated/static data) -->
     <script src="js/data/emojiData.js"></script>
     <script src="js/data/emojiCompatibility.js"></script>
     
     <!-- Generated bundles -->
     <script src="js/bundles/transforms-bundle.js"></script>
     <script src="js/core/spellingAlphabetTransform.js"></script>
     <script src="js/core/customSpellingAlphabets.js"></script>
+    <script src="js/core/transformRecipeStages.js"></script>
     <script src="js/core/transformChains.js"></script>
     
     <!-- Glitch Tokens Data -->
     <script src="js/data/glitchTokens.js"></script>
     <script src="js/data/endSequences.js"></script>
     <script src="js/data/openrouterModels.js"></script>
     <script src="js/data/anticlassifierPrompt.js"></script>
     <script src="js/data/latinAffixPolicies.js"></script>
diff --git a/js/core/transformRecipeStages.js b/js/core/transformRecipeStages.js
new file mode 100644
index 0000000..4a901db
--- /dev/null
+++ b/js/core/transformRecipeStages.js
@@ -0,0 +1,159 @@
+(function(global) {
+    'use strict';
+
+    var STAGE_ORDER = ['normalize', 'translate', 'obfuscate', 'present', 'conceal', 'carrier'];
+
+    // Categories / keys allowed per stage (extend carefully; prefer category buckets).
+    var STAGE_TRANSFORM_CATEGORIES = {
+        normalize: ['case', 'format'],
+        obfuscate: ['cipher', 'encoding', 'technical'],
+        present: ['symbol', 'unicode', 'visual', 'custom_spelling', 'signwriting'],
+        conceal: ['concealment']
+    };
+
+    // Deny-list inside otherwise-allowed categories (lossy / unsuitable for recipes).
+    var STAGE_DENY_KEYS = {
+        normalize: { random_mix: true, shuffle_words: true },
+        obfuscate: { random_mix: true },
+        present: { random_mix: true },
+        conceal: {}
+    };
+
+    // Extra allow keys even if category differs (empty initially).
+    var STAGE_ALLOW_KEYS = {
+        normalize: {},
+        obfuscate: {},
+        present: {},
+        conceal: {}
+    };
+
+    function isRecord(v) {
+        return !!v && typeof v === 'object' && !Array.isArray(v);
+    }
+
+    function isTransformAllowedInStage(stageId, transformKey, transformsMap) {
+        if (stageId === 'translate' || stageId === 'carrier') return false;
+        if (typeof transformKey !== 'string' || !transformKey) return false;
+        if (transformKey.indexOf('chain_') === 0 || transformKey.indexOf('cycle_') === 0) return false;
+        var t = transformsMap && transformsMap[transformKey];
+        if (!t) return false;
+        if (STAGE_DENY_KEYS[stageId] && STAGE_DENY_KEYS[stageId][transformKey]) return false;
+        if (STAGE_ALLOW_KEYS[stageId] && STAGE_ALLOW_KEYS[stageId][transformKey]) return true;
+        var cats = STAGE_TRANSFORM_CATEGORIES[stageId] || [];
+        var cat = t.category || '';
+        return cats.indexOf(cat) !== -1;
+    }
+
+    function validateStagedRecipe(recipe, transformsMap) {
+        if (!isRecord(recipe) || typeof recipe.name !== 'string' || !recipe.name.trim()) {
+            return 'Name is required.';
+        }
+        var stages = recipe.stages;
+        if (!isRecord(stages)) return 'Invalid stages.';
+        var ob = stages.obfuscate;
+        if (!Array.isArray(ob) || ob.length === 0) {
+            return 'Add at least one obfuscate step.';
+        }
+        var i;
+        for (i = 0; i < ob.length; i++) {
+            if (!isTransformAllowedInStage('obfuscate', ob[i] && ob[i].transform, transformsMap)) {
+                return 'Transform not allowed in Obfuscate: ' + ((ob[i] && ob[i].transform) || '?');
+            }
+        }
+        var multi = ['normalize', 'present', 'conceal'];
+        for (i = 0; i < multi.length; i++) {
+            var sid = multi[i];
+            var nodes = stages[sid];
+            if (nodes == null) continue;
+            if (!Array.isArray(nodes)) return 'Invalid ' + sid + ' stage.';
+            for (var j = 0; j < nodes.length; j++) {
+                if (!isTransformAllowedInStage(sid, nodes[j] && nodes[j].transform, transformsMap)) {
+                    return 'Transform not allowed in ' + sid + ': ' + ((nodes[j] && nodes[j].transform) || '?');
+                }
+            }
+        }
+        if (stages.translate != null) {
+            if (!isRecord(stages.translate) || stages.translate.type !== 'translate') {
+                return 'Invalid translate stage.';
+            }
+            if (!stages.translate.lang) return 'Translate stage needs a language.';
+        }
+        if (stages.carrier != null) {
+            if (!isRecord(stages.carrier)) return 'Invalid carrier stage.';
+            if (stages.carrier.type !== 'qr' && stages.carrier.type !== 'emoji_stego') {
+                return 'Carrier must be qr or emoji_stego.';
+            }
+        }
+        return null;
+    }
+
+    function flattenStagedToNodes(recipe) {
+        var stages = (recipe && recipe.stages) || {};
+        var out = [];
+        function pushNodes(arr) {
+            if (!Array.isArray(arr)) return;
+            for (var i = 0; i < arr.length; i++) out.push(arr[i]);
+        }
+        pushNodes(stages.normalize);
+        if (stages.translate) out.push(stages.translate);
+        pushNodes(stages.obfuscate);
+        pushNodes(stages.present);
+        pushNodes(stages.conceal);
+        if (stages.carrier) out.push(stages.carrier);
+        return out;
+    }
+
+    var TEMPLATES = [
+        {
+            id: 'cipher-base64',
+            name: 'Cipher ΓåÆ Base64',
+            stages: {
+                normalize: null,
+                translate: null,
+                obfuscate: [
+                    { transform: 'caesar', options: { shift: 3 } },
+                    { transform: 'base64', options: {} }
+                ],
+                present: null,
+                conceal: null,
+                carrier: null
+            }
+        },
+        {
+            id: 'translate-theban',
+            name: 'Translate ΓåÆ Theban',
+            stages: {
+                normalize: null,
+                translate: { type: 'translate', lang: 'la', model: '' },
+                obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+                present: [{ transform: 'theban', options: {} }],
+                conceal: null,
+                carrier: null
+            }
+        },
+        {
+            id: 'cipher-qr',
+            name: 'Cipher ΓåÆ Base64 ΓåÆ QR',
+            stages: {
+                normalize: null,
+                translate: null,
+                obfuscate: [
+                    { transform: 'caesar', options: { shift: 3 } },
+                    { transform: 'base64', options: {} }
+                ],
+                present: null,
+                conceal: null,
+                carrier: { type: 'qr', options: {} }
+            }
+        }
+    ];
+
+    global.TransformRecipeStages = {
+        STAGE_ORDER: STAGE_ORDER,
+        STAGE_TRANSFORM_CATEGORIES: STAGE_TRANSFORM_CATEGORIES,
+        isTransformAllowedInStage: isTransformAllowedInStage,
+        validateStagedRecipe: validateStagedRecipe,
+        flattenStagedToNodes: flattenStagedToNodes,
+        TEMPLATES: TEMPLATES
+    };
+})(typeof window !== 'undefined' ? window : this);
diff --git a/package.json b/package.json
index bb6c180..057e39f 100644
--- a/package.json
+++ b/package.json
@@ -15,17 +15,18 @@
     "start": "serve dist -l 8080",
     "preview": "npm run build && serve dist -l 8080",
     "test": "node tests/test_universal.js",
     "test:lexeme": "node tests/test_lexeme_analysis.js",
     "test:lexeme-ui": "node tests/test_lexeme_ui_surface.js",
     "test:universal": "node tests/test_universal.js",
     "test:steg": "node tests/test_steganography_options.js",
     "test:chains": "node tests/test_transform_chains.js",
-    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains",
+    "test:recipes": "node tests/test_transform_recipes.js",
+    "test:all": "npm run test:universal && npm run test:steg && npm run test:lexeme && npm run test:lexeme-ui && npm run test:chains && npm run test:recipes",
     "precommit": "npm run test:all"
   },
   "repository": {
     "type": "git",
     "url": "."
   },
   "keywords": [
     "encoder",
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
new file mode 100644
index 0000000..a8f2f6d
--- /dev/null
+++ b/tests/test_transform_recipes.js
@@ -0,0 +1,84 @@
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
+    caesar: { name: 'Caesar', category: 'cipher', canDecode: true },
+    base64: { name: 'Base64', category: 'encoding', canDecode: true },
+    theban: { name: 'Theban', category: 'symbol', canDecode: true },
+    bold: { name: 'Bold', category: 'unicode', canDecode: true },
+    zero_width: { name: 'Zero-Width', category: 'concealment', canDecode: true },
+    title_case: { name: 'Title Case', category: 'case', canDecode: true }
+};
+load(ctx, 'js/core/transformRecipeStages.js');
+const S = ctx.TransformRecipeStages;
+assert.ok(S, 'TransformRecipeStages global');
+
+assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'caesar', ctx.transforms), true);
+assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'theban', ctx.transforms), false);
+assert.strictEqual(S.isTransformAllowedInStage('present', 'theban', ctx.transforms), true);
+assert.strictEqual(S.isTransformAllowedInStage('normalize', 'title_case', ctx.transforms), true);
+
+assert.strictEqual(S.validateStagedRecipe({
+    name: 'x',
+    kind: 'staged',
+    stages: { obfuscate: [], present: null, translate: null, normalize: null, conceal: null, carrier: null }
+}, ctx.transforms), 'Add at least one obfuscate step.');
+
+assert.strictEqual(S.validateStagedRecipe({
+    name: 'x',
+    kind: 'staged',
+    stages: {
+        obfuscate: [{ transform: 'theban', options: {} }],
+        present: null, translate: null, normalize: null, conceal: null, carrier: null
+    }
+}, ctx.transforms) != null, true, 'theban not allowed in obfuscate');
+
+assert.strictEqual(S.validateStagedRecipe({
+    name: 'Good',
+    kind: 'staged',
+    stages: {
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: [{ transform: 'theban', options: {} }],
+        translate: null, normalize: null, conceal: null,
+        carrier: { type: 'qr', options: {} }
+    }
+}, ctx.transforms), null);
+
+const flat = S.flattenStagedToNodes({
+    stages: {
+        translate: { type: 'translate', lang: 'la', model: 'm' },
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: null, normalize: null, conceal: null,
+        carrier: { type: 'emoji_stego', options: { carrier: '≡ƒÿÇ' } }
+    }
+});
+assert.strictEqual(flat[0].type, 'translate');
+assert.strictEqual(flat[1].transform, 'caesar');
+assert.strictEqual(flat[flat.length - 1].type, 'emoji_stego');
+
+console.log('test_transform_recipes: OK');

```