# Review package: 009047f01d30139f6694b7600e88508d5e51f792..HEAD

## Commits
715fa06 feat: include underlying text with QR carrier results

## Files changed
 js/core/transformChains.js      |  2 +-
 tests/test_transform_recipes.js | 30 ++++++++++++++++++++++++++++--
 2 files changed, 29 insertions(+), 3 deletions(-)

## Diff
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 13e1f76..09e7bc7 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -297,21 +297,21 @@
             if (!global.QRCode || typeof global.QRCode.toDataURL !== 'function') {
                 return Promise.reject(new Error('QR library not loaded. Rebuild the app (npm run build).'));
             }
             var widthValue = options.width != null ? options.width : options.size;
             var marginValue = options.margin != null ? options.margin : 2;
             return global.QRCode.toDataURL(String(text), {
                 width: clampNumber(widthValue, 256, 128, 1024),
                 margin: clampNumber(marginValue, 2, 0, 20),
                 errorCorrectionLevel: options.errorCorrectionLevel || options.ecl || 'M'
             }).then(function(dataUrl) {
-                return { kind: 'image', value: dataUrl };
+                return { kind: 'image', value: dataUrl, text: String(text) };
             });
         }
         if (carrierNode.type === 'emoji_stego') {
             if (!global.steganography || typeof global.steganography.encodeEmoji !== 'function') {
                 return Promise.reject(new Error('Emoji steganography library not loaded.'));
             }
             var carrierEmoji = options.carrierEmoji || options.carrier || carrierNode.carrierEmoji || '🐍';
             return Promise.resolve().then(function() {
                 return {
                     kind: 'text',
diff --git a/tests/test_transform_recipes.js b/tests/test_transform_recipes.js
index def276f..deadd48 100644
--- a/tests/test_transform_recipes.js
+++ b/tests/test_transform_recipes.js
@@ -225,21 +225,21 @@ TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
             qrCalls.push({ text, options });
             return Promise.resolve('data:image/png;base64,mocked');
         }
     };
     return TC.applyCarrier({
         type: 'qr',
         options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
     }, 'secret').then((qrResult) => {
         assert.deepStrictEqual(
             JSON.parse(JSON.stringify(qrResult)),
-            { kind: 'image', value: 'data:image/png;base64,mocked' }
+            { kind: 'image', value: 'data:image/png;base64,mocked', text: 'secret' }
         );
         assert.deepStrictEqual(
             JSON.parse(JSON.stringify(qrCalls)),
             [{
                 text: 'secret',
                 options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
             }]
         );
 
         const emojiCalls = [];
@@ -275,26 +275,52 @@ TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
             };
             return TC.runStagedRecipeAsync(qrRecipe, 'Hello').then((result) => ({
                 result,
                 qrCalls
             }));
         });
     });
 }).then(({ result, qrCalls }) => {
     assert.deepStrictEqual(
         JSON.parse(JSON.stringify(result)),
-        { kind: 'image', value: 'data:image/png;base64,mocked' },
+        { kind: 'image', value: 'data:image/png;base64,mocked', text: 'Khoor' },
         'runner applies the carrier after text transforms'
     );
     assert.deepStrictEqual(
         JSON.parse(JSON.stringify(qrCalls[1])),
         {
             text: 'Khoor',
             options: { width: 256, margin: 2, errorCorrectionLevel: 'M' }
         },
         'QR receives transformed text and CodesTool defaults'
     );
+    ctx.QRCode = {
+        toDataURL: function(text) {
+            return Promise.resolve('data:image/png;base64,STUB');
+        }
+    };
+    const recipeWithQr = {
+        name: 'QR Demo',
+        kind: 'staged',
+        stages: {
+            normalize: null,
+            translate: null,
+            obfuscate: [{ transform: 'base64', options: {} }],
+            present: null,
+            conceal: null,
+            carrier: { type: 'qr', options: {} }
+        }
+    };
+    TC.saveRecipe(recipeWithQr);
+    return TC.runStagedRecipeAsync(
+        TC.loadChains().filter(c => c.name === 'QR Demo')[0] || recipeWithQr,
+        'hi'
+    );
+}).then(function(result) {
+    assert.strictEqual(result.kind, 'image');
+    assert.ok(result.value.indexOf('data:image') === 0);
+    assert.strictEqual(result.text, 'aGk=');
     console.log('test_transform_recipes: OK');
 }).catch((err) => {
     console.error(err);
     process.exitCode = 1;
 });
