# Review Package Task 8
Base: bb04cee3ce6e283661939ef9afc7720601fdbdf1
Head: bf390d179951adb2e6b379a66039cd7a29c4d3e7

## Commits
bf390d1 docs: document transform chains and cycles

## Stat
 CONTRIBUTING.md           | 2 ++
 README.md                 | 9 +++++++++
 docs/TOOL_ARCHITECTURE.md | 9 +++++++++
 3 files changed, 20 insertions(+)

## Diff
```diff
diff --git a/CONTRIBUTING.md b/CONTRIBUTING.md
index b6cd8a1..a473165 100644
--- a/CONTRIBUTING.md
+++ b/CONTRIBUTING.md
@@ -18,16 +18,17 @@ P4RS3LT0NGV3/
 Γö£ΓöÇΓöÇ js/
 Γöé   Γö£ΓöÇΓöÇ app.js                   # Vue app entry
 Γöé   Γö£ΓöÇΓöÇ config/
 Γöé   Γöé   ΓööΓöÇΓöÇ constants.js
 Γöé   Γö£ΓöÇΓöÇ core/                    # Shared logic (not tab-specific UI)
 Γöé   Γöé   Γö£ΓöÇΓöÇ decoder.js         # Universal decode engine
 Γöé   Γöé   Γö£ΓöÇΓöÇ steganography.js   # Emoji / invisible carriers
 Γöé   Γöé   Γö£ΓöÇΓöÇ toolRegistry.js    # Registers tools, merges Vue data/methods
+Γöé   Γöé   Γö£ΓöÇΓöÇ transformChains.js # Saved transform chains & per-word cycles
 Γöé   Γöé   ΓööΓöÇΓöÇ transformOptions.js
 Γöé   Γö£ΓöÇΓöÇ data/                    # Static data shipped with the app (see note below)
 Γöé   Γöé   Γö£ΓöÇΓöÇ anticlassifierPrompt.js
 Γöé   Γöé   Γö£ΓöÇΓöÇ emojiCompatibility.js
 Γöé   Γöé   Γö£ΓöÇΓöÇ endSequences.js
 Γöé   Γöé   Γö£ΓöÇΓöÇ glitchTokens.js
 Γöé   Γöé   ΓööΓöÇΓöÇ openrouterModels.js
 Γöé   Γö£ΓöÇΓöÇ utils/
@@ -116,16 +117,17 @@ dist/   # npm run build ΓÇö gitignored
 **Generated / ignored paths (also listed in `.gitignore`):** `dist/`, `src/transformers/index.js`, legacy `js/bundles/transforms-bundle.js`, `js/data/emojiData.js`, root `index.html` if present. The build updates **`dist/index.html`** only; a **root** `index.html` is not produced by the current scripts.
 
 ## ≡ƒÄ» Key Concepts
 
 ### Core vs Tools
 
 - **`js/core/`** ΓÇö Shared business logic and infrastructure (not tab-specific)
   - Examples: `decoder.js` (DecodeTool, decoder pipeline), `steganography.js` (EmojiTool, steg engine), `toolRegistry.js` (registers tools, merges Vue surface), `transformOptions.js` (shared transform UI helpers)
+  - Transform chains and cycles are core logic in `transformChains.js`, registered into `window.transforms`; their UI lives on `TransformTool`.
 - **`js/utils/`** ΓÇö Cross-cutting helpers (`clipboard`, `EmojiUtils` in `emoji.js`, notifications, `theme.js`, `openrouterModels.js`, etc.)
 - **`js/data/`** ΓÇö Committed static payloads (models, prompts, glitch token data, end sequences, `emojiCompatibility.js`). **`emojiData.js`** is **not** edited here ΓÇö it is **generated** to `dist/js/data/emojiData.js` by `npm run build:emoji`.
 - **`src/`** ΓÇö `emojiWordMap.js` feeds the emoji build; `transformers/` holds transformer modules
 - **Generated bundle** ΓÇö `npm run build:transforms` writes `dist/js/bundles/transforms-bundle.js` (a legacy `js/bundles/transforms-bundle.js` path may exist for older workflows and is gitignored)
 - **`js/tools/`** ΓÇö Vue integration: one `*Tool.js` per tab (plus `TranslateTool.js`, which is hidden and wired from the Transform tab)
   - Example: `DecodeTool.js` uses the universal decode API from `core/decoder.js`
 
 ### Transformers vs Tools
diff --git a/README.md b/README.md
index d1044a7..6307c1e 100644
--- a/README.md
+++ b/README.md
@@ -263,16 +263,25 @@ Tabs appear in **UI order** below. AI-backed tools use whichever **AI provider**
 ### ≡ƒöñ **Transform**
 
 - **222 Transforms**: Encodings, ciphers, Unicode styles, formats, and more (full catalog above).
 - **Categories**: Grouped sections you can **reorder**; quick-jump legend; **randomizer** last.
 - **Favorites & last used**: Pin transforms and recall recent picks.
 - **Per-transform options**: Gear icon where a transform exposes settings.
 - **Keyboard shortcut**: **T** (shown in the tab title).
 
+### Chains & Cycles (on the Transform tab)
+
+- **Chain** ΓÇö an ordered pipeline of transforms applied to the whole input; each node snapshots its own options (e.g. Caesar shift 3 then shift 7).
+- **Cycle** ΓÇö rotate a list of chains across words (word 1 ΓåÆ chain A, word 2 ΓåÆ chain B, wrap).
+- Saved entities appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply).
+- Nested chains/cycles are not allowed.
+- If a recipe cannot mechanically reverse, use **AI decode** in the Chains manager (uses your configured AI providers).
+- Export/import JSON from the Chains manager; copy the human-readable recipe for sharing.
+
 ### ≡ƒîÉ **AI Translation** (AI-powered)
 
 *Lives on the **Transform** tab ΓÇö not a separate tab.*
 
 - **20+ Languages**: Major world languages (Spanish, French, Chinese, Japanese, Korean, etc.)
 - **Dead & Exotic Languages**: Latin, Sanskrit, Ancient Greek, Sumerian, Akkadian, Old English, and more
 - **Custom Languages**: Add any language on-the-fly
 - **Any configured model**: Pick from every provider you've set up (OpenRouter, OpenAI, Anthropic, Google, audn.ai, custom); translation models like Gemma 3 / TranslateGemma still work great here
diff --git a/docs/TOOL_ARCHITECTURE.md b/docs/TOOL_ARCHITECTURE.md
index 6bb5c35..bdce527 100644
--- a/docs/TOOL_ARCHITECTURE.md
+++ b/docs/TOOL_ARCHITECTURE.md
@@ -74,16 +74,25 @@ Example: Transform Tool, Decoder Tool, Emoji Tool
 - Γ£à Emoji Tool - Interactive emoji grid
 - Γ£à Tokenade Tool - Complex nested options
 - Γ£à Mutation Tool - Multiple fuzzing options
 - Γ£à Tokenizer Tool - Dynamic token display
 
 ### Tools with Dynamic Content
 - Γ£à Splitter Tool - Self-contained in SplitterTool.js
 
+## Transform chains & cycles
+
+- Module: `js/core/transformChains.js` (`window.TransformChains`)
+- Storage: `localStorage` keys `transform-chains-v1`, `transform-cycles-v1`
+- Registration: `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`
+- No nesting of saved chains/cycles inside chain nodes
+- Mechanical reverse when every node (and cycle probe) allows it; otherwise AI recipe decode via `aiDecode`
+- UI: Transform tab Chains manager (`templates/transforms.html`, methods on `TransformTool`)
+
 ## Adding a New Tool
 
 ### Step 1: Create Tool Class
 
 ```javascript
 // js/tools/MyTool.js
 class MyTool extends Tool {
     constructor() {

```