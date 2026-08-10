# Review Package Staged Task 5
Base: 4b891e0509d3d91a0707f9e2920054d4e2eaf617
Head: 6395de876ed0b55861a120223b9f99a2e5d5a250

## Commits
6395de8 feat: QR and emoji-stego carrier stages

## Stat
 js/core/transformChains.js      | 58 ++++++++++++++++++++++++++++--
 tests/test_transform_recipes.js | 80 ++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 134 insertions(+), 4 deletions(-)

## Diff
```diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 797d9c0..312999a 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -262,29 +262,80 @@
         return global.AIProvider.chatCompletion([
             { role: 'user', content: buildTranslatePrompt(language.name, language.code, text) }
         ], callOpts).then(function(data) {
             var message = data && data.choices && data.choices[0] && data.choices[0].message;
             return ((message && message.content) || '').trim();
         });
     }
 
-    /** Walk every staged node in flatten order, awaiting AI-backed stages. */
+    function clampNumber(value, fallback, min, max) {
+        var number = Number(value);
+        if (!isFinite(number)) number = fallback;
+        return Math.max(min, Math.min(max, number));
+    }
+
+    /**
+     * Wrap transformed text in the recipe's final carrier.
+     * QR options mirror CodesTool; encodeEmoji uses its actual (emoji, text) signature.
+     */
+    function applyCarrier(carrierNode, text) {
+        if (!carrierNode) {
+            return Promise.resolve({ kind: 'text', value: String(text) });
+        }
+        var options = carrierNode.options || {};
+        if (carrierNode.type === 'qr') {
+            if (!global.QRCode || typeof global.QRCode.toDataURL !== 'function') {
+                return Promise.reject(new Error('QR library not loaded. Rebuild the app (npm run build).'));
+            }
+            var widthValue = options.width != null ? options.width : options.size;
+            var marginValue = options.margin != null ? options.margin : 2;
+            return global.QRCode.toDataURL(String(text), {
+                width: clampNumber(widthValue, 256, 128, 1024),
+                margin: clampNumber(marginValue, 2, 0, 20),
+                errorCorrectionLevel: options.errorCorrectionLevel || options.ecl || 'M'
+            }).then(function(dataUrl) {
+                return { kind: 'image', value: dataUrl };
+            });
+        }
+        if (carrierNode.type === 'emoji_stego') {
+            if (!global.steganography || typeof global.steganography.encodeEmoji !== 'function') {
+                return Promise.reject(new Error('Emoji steganography library not loaded.'));
+            }
+            var carrierEmoji = options.carrierEmoji || options.carrier || carrierNode.carrierEmoji || '≡ƒÉì';
+            return Promise.resolve().then(function() {
+                return {
+                    kind: 'text',
+                    value: global.steganography.encodeEmoji(carrierEmoji, String(text))
+                };
+            });
+        }
+        return Promise.reject(new Error('Unsupported carrier type: ' + carrierNode.type));
+    }
+
+    /** Walk every text stage in flatten order, then apply the final carrier. */
     function runStagedRecipeAsync(recipe, text, opts) {
-        return getStagedNodes(recipe).reduce(function(pending, node) {
+        var stages = (recipe && recipe.stages) || {};
+        var carrierNode = stages.carrier || null;
+        var textNodes = getStagedNodes(recipe).filter(function(node) {
+            return node !== carrierNode;
+        });
+        return textNodes.reduce(function(pending, node) {
             return pending.then(function(acc) {
                 if (node && node.type === 'translate') {
                     return runTranslateNode(node, acc, opts);
                 }
                 if (node && typeof node.transform === 'string') {
                     return runChainNodes([node], acc);
                 }
                 return acc;
             });
-        }, Promise.resolve(text));
+        }, Promise.resolve(text)).then(function(value) {
+            return applyCarrier(carrierNode, value);
+        });
     }
 
     function getRunnableChainNodes(chain) {
         if (!chain) return [];
         if (chain.kind !== 'staged') return chain.nodes || [];
         return getStagedTransformNodes(chain);
     }
 
@@ -733,15 +784,16 @@
         describeRecipe: describeRecipe,
         buildDecodePrompt: buildDecodePrompt,
         aiDecode: aiDecode,
         previewNodes: previewNodes,
         previewSteps: previewSteps,
         smartWordSplit: smartWordSplit,
         runChainNodes: runChainNodes,
         runStagedRecipeSync: runStagedRecipeSync,
+        applyCarrier: applyCarrier,
         runStagedRecipeAsync: runStagedRecipeAsync,
         reverseChainNodes: reverseChainNodes,
         runCycle: runCycle,
         resolveCycleChains: resolveCycleChains,
         genId: genId
     };
 })(typeof window !== 'undefined' ? window : this);
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index 21498df..f3b0528 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -176,21 +176,99 @@ const asyncRecipe = {
         obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
         present: null,
         conceal: null,
         carrier: null
     }
 };
 
 TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
-    assert.strictEqual(result, '[OD]Khoor', 'translation runs before Caesar');
+    assert.deepStrictEqual(
+        JSON.parse(JSON.stringify(result)),
+        { kind: 'text', value: '[OD]Khoor' },
+        'translation runs before Caesar and returns a typed result'
+    );
     assert.strictEqual(translateCalls.length, 1);
     assert.strictEqual(translateCalls[0].opts.model, 'test::translate');
     assert.strictEqual(Array.isArray(translateCalls[0].messages), true);
     assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
         /English \(en\) to Latin \(la\) translator/);
     assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
         /Please translate the following English text into Latin:\n\nHello$/);
+    const qrCalls = [];
+    ctx.QRCode = {
+        toDataURL: (text, options) => {
+            qrCalls.push({ text, options });
+            return Promise.resolve('data:image/png;base64,mocked');
+        }
+    };
+    return TC.applyCarrier({
+        type: 'qr',
+        options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
+    }, 'secret').then((qrResult) => {
+        assert.deepStrictEqual(
+            JSON.parse(JSON.stringify(qrResult)),
+            { kind: 'image', value: 'data:image/png;base64,mocked' }
+        );
+        assert.deepStrictEqual(
+            JSON.parse(JSON.stringify(qrCalls)),
+            [{
+                text: 'secret',
+                options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
+            }]
+        );
+
+        const emojiCalls = [];
+        ctx.steganography = {
+            encodeEmoji: (emoji, text) => {
+                emojiCalls.push({ emoji, text });
+                return emoji + ':' + text;
+            }
+        };
+        return TC.applyCarrier({
+            type: 'emoji_stego',
+            options: { carrier: '≡ƒÿÇ' }
+        }, 'hidden').then((emojiResult) => {
+            assert.deepStrictEqual(
+                JSON.parse(JSON.stringify(emojiResult)),
+                { kind: 'text', value: '≡ƒÿÇ:hidden' }
+            );
+            assert.deepStrictEqual(
+                JSON.parse(JSON.stringify(emojiCalls)),
+                [{ emoji: '≡ƒÿÇ', text: 'hidden' }]
+            );
+
+            const qrRecipe = {
+                kind: 'staged',
+                stages: {
+                    normalize: null,
+                    translate: null,
+                    obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
+                    present: null,
+                    conceal: null,
+                    carrier: { type: 'qr', options: {} }
+                }
+            };
+            return TC.runStagedRecipeAsync(qrRecipe, 'Hello').then((result) => ({
+                result,
+                qrCalls
+            }));
+        });
+    });
+}).then(({ result, qrCalls }) => {
+    assert.deepStrictEqual(
+        JSON.parse(JSON.stringify(result)),
+        { kind: 'image', value: 'data:image/png;base64,mocked' },
+        'runner applies the carrier after text transforms'
+    );
+    assert.deepStrictEqual(
+        JSON.parse(JSON.stringify(qrCalls[1])),
+        {
+            text: 'Khoor',
+            options: { width: 256, margin: 2, errorCorrectionLevel: 'M' }
+        },
+        'QR receives transformed text and CodesTool defaults'
+    );
     console.log('test_transform_recipes: OK');
 }).catch((err) => {
     console.error(err);
     process.exitCode = 1;
 });

```