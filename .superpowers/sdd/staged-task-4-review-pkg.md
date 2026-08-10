# Review Package Staged Task 4 re-review
Base: 1e8bd9615170f8084a3dbc71084397ae647d603f
Head: 4b891e0509d3d91a0707f9e2920054d4e2eaf617

## Commits
4b891e0 fix: align staged Translate lang with TranslateTool mapping
fa89511 feat: async Translate stage for staged recipes

## Stat
 js/core/transformChains.js       | 58 +++++++++++++++++++++++++++++++++++-----
 js/core/transformRecipeStages.js | 31 +++++++++++++++++++++
 tests/test_transform_recipes.js  | 37 ++++++++++++++++++++++++-
 3 files changed, 119 insertions(+), 7 deletions(-)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 99c689c..797d9c0 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -216,32 +216,77 @@
                 return applyNode(node, acc);
             } catch (e) {
                 console.warn('Chain node "' + node.transform + '" failed:', e);
                 return acc;
             }
         }, text);
     }
 
-    /**
-     * Staged execution gets a dedicated runner in Task 3. Until then, expose
-     * transform-backed stages through the existing synchronous chain runner.
-     */
-    function getStagedTransformNodes(recipe) {
+    /** Return every staged node in canonical flatten order. */
+    function getStagedNodes(recipe) {
         var stagesApi = global.TransformRecipeStages;
         if (!stagesApi || typeof stagesApi.flattenStagedToNodes !== 'function') return [];
-        return stagesApi.flattenStagedToNodes(recipe).filter(function(n) {
+        return stagesApi.flattenStagedToNodes(recipe);
+    }
+
+    /** Return only transform-backed nodes for synchronous execution. */
+    function getStagedTransformNodes(recipe) {
+        return getStagedNodes(recipe).filter(function(n) {
             return n && typeof n.transform === 'string';
         });
     }
 
     function runStagedRecipeSync(recipe, text) {
         return runChainNodes(getStagedTransformNodes(recipe), text);
     }
 
+    function buildTranslatePrompt(langName, langCode, text) {
+        return 'You are a professional English (en) to ' + langName + ' (' + langCode + ') translator. ' +
+            'Your goal is to accurately convey the meaning and nuances of the original English text ' +
+            'while adhering to ' + langName + ' grammar, vocabulary, and cultural sensitivities. ' +
+            'Produce only the ' + langName + ' translation, without any additional explanations or commentary. ' +
+            'Please translate the following English text into ' + langName + ':\n\n' + text;
+    }
+
+    function runTranslateNode(node, text, opts) {
+        if (!global.AIProvider || typeof global.AIProvider.chatCompletion !== 'function') {
+            return Promise.reject(new Error('Configure an AI provider in Settings.'));
+        }
+        opts = opts || {};
+        var model = node.model || opts.model ||
+            global.localStorage.getItem('translate-model') || '';
+        var callOpts = Object.assign({}, opts, { model: model });
+        var stagesApi = global.TransformRecipeStages;
+        var language = stagesApi && typeof stagesApi.resolveTranslateLanguage === 'function'
+            ? stagesApi.resolveTranslateLanguage(node.lang)
+            : { name: String(node.lang || ''), code: String(node.lang || '') };
+        return global.AIProvider.chatCompletion([
+            { role: 'user', content: buildTranslatePrompt(language.name, language.code, text) }
+        ], callOpts).then(function(data) {
+            var message = data && data.choices && data.choices[0] && data.choices[0].message;
+            return ((message && message.content) || '').trim();
+        });
+    }
+
+    /** Walk every staged node in flatten order, awaiting AI-backed stages. */
+    function runStagedRecipeAsync(recipe, text, opts) {
+        return getStagedNodes(recipe).reduce(function(pending, node) {
+            return pending.then(function(acc) {
+                if (node && node.type === 'translate') {
+                    return runTranslateNode(node, acc, opts);
+                }
+                if (node && typeof node.transform === 'string') {
+                    return runChainNodes([node], acc);
+                }
+                return acc;
+            });
+        }, Promise.resolve(text));
+    }
+
     function getRunnableChainNodes(chain) {
         if (!chain) return [];
         if (chain.kind !== 'staged') return chain.nodes || [];
         return getStagedTransformNodes(chain);
     }
 
     /** Undo a chain: same nodes, back-to-front, each reversed. */
     function reverseChainNodes(nodes, text) {
@@ -688,14 +733,15 @@
         describeRecipe: describeRecipe,
         buildDecodePrompt: buildDecodePrompt,
         aiDecode: aiDecode,
         previewNodes: previewNodes,
         previewSteps: previewSteps,
         smartWordSplit: smartWordSplit,
         runChainNodes: runChainNodes,
         runStagedRecipeSync: runStagedRecipeSync,
+        runStagedRecipeAsync: runStagedRecipeAsync,
         reverseChainNodes: reverseChainNodes,
         runCycle: runCycle,
         resolveCycleChains: resolveCycleChains,
         genId: genId
     };
 })(typeof window !== 'undefined' ? window : this);
diff --git a/js/core/transformRecipeStages.js b/js/core/transformRecipeStages.js
index 4a901db..b7c1741 100644
--- a/js/core/transformRecipeStages.js
+++ b/js/core/transformRecipeStages.js
@@ -22,16 +22,45 @@
     // Extra allow keys even if category differs (empty initially).
     var STAGE_ALLOW_KEYS = {
         normalize: {},
         obfuscate: {},
         present: {},
         conceal: {}
     };
 
+    // Staged recipes persist TranslateTool language codes; known display names remain accepted.
+    var TRANSLATE_LANG_CODE_MAP = {
+        'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Chinese': 'zh',
+        'Japanese': 'ja', 'Korean': 'ko', 'Arabic': 'ar', 'Russian': 'ru',
+        'Hindi': 'hi', 'Portuguese': 'pt', 'Italian': 'it', 'Dutch': 'nl',
+        'Turkish': 'tr', 'Vietnamese': 'vi', 'Thai': 'th', 'Polish': 'pl',
+        'Latin': 'la', 'Sanskrit': 'sa', 'Ancient Greek': 'grc',
+        'Egyptian Arabic': 'arz', 'Old English': 'ang', 'Sumerian': 'sux',
+        'Akkadian': 'akk', 'Hawaiian': 'haw', 'Welsh': 'cy', 'Swahili': 'sw',
+        'Hebrew': 'he', 'Persian': 'fa', 'Tamil': 'ta', 'Esperanto': 'eo',
+        'Irish': 'ga', 'Basque': 'eu', 'Navajo': 'nv', 'Quechua': 'qu',
+        'Nahuatl': 'nah', 'Tagalog': 'tl', 'Maori': 'mi', 'Yoruba': 'yo',
+        'Zulu': 'zu', 'Catalan': 'ca', 'Romanian': 'ro', 'Czech': 'cs',
+        'Indonesian': 'id', 'Malay': 'ms', 'Bengali': 'bn', 'Urdu': 'ur'
+    };
+
+    function resolveTranslateLanguage(lang) {
+        var raw = String(lang || '').trim();
+        var names = Object.keys(TRANSLATE_LANG_CODE_MAP);
+        for (var i = 0; i < names.length; i++) {
+            var name = names[i];
+            var code = TRANSLATE_LANG_CODE_MAP[name];
+            if (raw === name || raw.toLowerCase() === code.toLowerCase()) {
+                return { name: name, code: code };
+            }
+        }
+        return { name: raw, code: raw };
+    }
+
     function isRecord(v) {
         return !!v && typeof v === 'object' && !Array.isArray(v);
     }
 
     function isTransformAllowedInStage(stageId, transformKey, transformsMap) {
         if (stageId === 'translate' || stageId === 'carrier') return false;
         if (typeof transformKey !== 'string' || !transformKey) return false;
         if (transformKey.indexOf('chain_') === 0 || transformKey.indexOf('cycle_') === 0) return false;
@@ -146,14 +175,16 @@
                 carrier: { type: 'qr', options: {} }
             }
         }
     ];
 
     global.TransformRecipeStages = {
         STAGE_ORDER: STAGE_ORDER,
         STAGE_TRANSFORM_CATEGORIES: STAGE_TRANSFORM_CATEGORIES,
+        TRANSLATE_LANG_CODE_MAP: TRANSLATE_LANG_CODE_MAP,
+        resolveTranslateLanguage: resolveTranslateLanguage,
         isTransformAllowedInStage: isTransformAllowedInStage,
         validateStagedRecipe: validateStagedRecipe,
         flattenStagedToNodes: flattenStagedToNodes,
         TEMPLATES: TEMPLATES
     };
 })(typeof window !== 'undefined' ? window : this);
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index 96ff43f..21498df 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -153,9 +153,44 @@ const syncId = TC.saveRecipe({
 });
 const syncRecipe = TC.loadChains().filter(c => c.id === syncId)[0];
 const syncInput = 'Hello';
 const caesarOut = ctx.transforms.caesar.func(syncInput, { shift: 3 });
 const syncExpected = ctx.transforms.base64.func(caesarOut);
 assert.strictEqual(TC.runStagedRecipeSync(syncRecipe, syncInput), syncExpected);
 assert.strictEqual(ctx.transforms[`chain_${syncId}`].func(syncInput), syncExpected);
 
-console.log('test_transform_recipes: OK');
+const translateCalls = [];
+ctx.AIProvider = {
+    chatCompletion: (messages, opts) => {
+        translateCalls.push({ messages, opts });
+        return Promise.resolve({
+            choices: [{ message: { content: '[LA]' + messages[messages.length - 1].content.split('\n\n').pop() } }]
+        });
+    }
+};
+
+const asyncRecipe = {
+    kind: 'staged',
+    stages: {
+        normalize: null,
+        translate: { type: 'translate', lang: 'la', model: 'test::translate' },
+        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+        present: null,
+        conceal: null,
+        carrier: null
+    }
+};
+
+TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
+    assert.strictEqual(result, '[OD]Khoor', 'translation runs before Caesar');
+    assert.strictEqual(translateCalls.length, 1);
+    assert.strictEqual(translateCalls[0].opts.model, 'test::translate');
+    assert.strictEqual(Array.isArray(translateCalls[0].messages), true);
+    assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
+        /English \(en\) to Latin \(la\) translator/);
+    assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
+        /Please translate the following English text into Latin:\n\nHello$/);
+    console.log('test_transform_recipes: OK');
+}).catch((err) => {
+    console.error(err);
+    process.exitCode = 1;
+});

```