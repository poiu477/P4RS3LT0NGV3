# Review Package Task 5
Base: 8538f71a87265448c8830ac9973ec23cbbbf899e
Head: 2617ff1

## Commits
2617ff1 fix: exclude saved chains/cycles from blind decoder auto-guess

## Stat
 js/core/decoder.js         | 6 ++++++
 js/core/transformChains.js | 2 +-
 2 files changed, 7 insertions(+), 1 deletion(-)

## Diff
```diff
diff --git a/js/core/decoder.js b/js/core/decoder.js
index 937e844..eac703e 100644
--- a/js/core/decoder.js
+++ b/js/core/decoder.js
@@ -8,20 +8,23 @@ function universalDecode(input, context = {}) {
         if (text && text !== input && text.length > 0) {
             const exists = allDecodings.some(d => d.text === text);
             if (!exists) {
                 allDecodings.push({ text, method, priority });
             }
         }
     }
     
     let foundHighPriorityMatch = false;
     for (const [transformKey, transform] of Object.entries(window.transforms)) {
+        if (transform.isChain || transform.isCycle || transform.category === 'chains') {
+            continue; // only via explicit user selection / AI recipe decode
+        }
         if (transform.detector && transform.reverse) {
             try {
                 if (transform.detector(input)) {
                     const opts = window.getMergedTransformOptions
                         ? window.getMergedTransformOptions(transform)
                         : {};
                     const result = transform.reverse(input, opts);
                     if (result && result !== input && result.length > 0) {
                         const hasContent = result.replace(/[\x00-\x1F\x7F-\x9F\s]/g, '').length > 0;
                         if (hasContent) {
@@ -67,20 +70,23 @@ function universalDecode(input, context = {}) {
                     addDecoding(result, activeTransform.name, 150);
                 }
             }
         } catch (e) {
             console.error('Error decoding with active transform:', e);
         }
     }
     
     for (const name in window.transforms) {
         const transform = window.transforms[name];
+        if (transform.isChain || transform.isCycle || transform.category === 'chains') {
+            continue; // only via explicit user selection / AI recipe decode
+        }
         if (transform.reverse && !transform.detector) {
             try {
                 const opts = window.getMergedTransformOptions ? window.getMergedTransformOptions(transform) : {};
                 const result = transform.reverse(input, opts);
                 if (result !== input && /[a-zA-Z0-9\s]{3,}/.test(result)) {
                     addDecoding(result, transform.name, 10);
                 }
             } catch (e) {
                 console.error(`Error decoding with ${name}:`, e);
             }
diff --git a/js/core/transformChains.js b/js/core/transformChains.js
index 3db1385..cb4cd22 100644
--- a/js/core/transformChains.js
+++ b/js/core/transformChains.js
@@ -315,21 +315,21 @@
         var names = (chain.nodes || []).map(describeNode);
         return names.join(' ΓåÆ ') || 'empty chain';
     }
 
     function registerChain(chain) {
         var reversible = chainIsReversible(chain);
         global.transforms[CHAIN_PREFIX + chain.id] = {
             name: chain.name,
             category: CATEGORY,
             description: 'Chain: ' + describeChain(chain),
-            priority: 0, // never auto-guessed by the decoder; user picks it explicitly
+            priority: 0, // excluded from blind auto-guess; still reversible when selected
             canDecode: reversible,
             isChain: true,
             chainId: chain.id,
             func: function(text) { return runChainNodes(chain.nodes, text); },
             preview: function(text) { return runChainNodes(chain.nodes, text); },
             reverse: reversible
                 ? function(text) { return reverseChainNodes(chain.nodes, text); }
                 : null
         };
     }

```