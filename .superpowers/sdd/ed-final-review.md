# Final Code Review — Encode/Decode Mode + Output Destinations

**Reviewer:** Senior Code Reviewer
**Date:** 2026-08-04
**Range:** `9c041cfdcbd94499f26e7e153510c0e8f949daca..fa59b7a9a65259518dca407dd3941a466c019807` (5 commits)
**Spec:** `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md`
**Plan:** `docs/superpowers/plans/2026-08-04-encode-decode-mode.md`
**Verdict:** **Not merge-ready.** Two Critical defects in the decode path plus one Important pre-existing routing bug that this feature newly exposes.

---

## Verification performed

- Read the full diff package (`ed-final-review-pkg.md`), spec, and plan.
- Read the merged state of `js/tools/TransformTool.js`, `js/core/transformApplyMode.js`, `js/core/transformChains.js`, `js/core/transformRecipeStages.js`, `templates/transforms.html`, `css/style.css`, `js/app.js`.
- `npm run test:all` → **exit 0**, all seven suites pass (`test_universal`, `test_steganography_options`, `test_lexeme_analysis`, `test_lexeme_ui_surface`, `test_transform_chains`, `test_transform_recipes`, `test_transform_apply_mode`).
- Confirmed `dist/` is gitignored (`.gitignore:12`), so no stale build artifact is committed; `index.template.html` is the only tracked entry point and the new script tag is present in the right load order.
- Traced every call site of `applyActiveTransformOutput` and the object identity of what reaches `resolveAction` / `describeForAiDecode`.
- Grepped all 222 transformers for `canDecode: false` + `reverse` interactions and confirmed `BaseTransformer` nulls `reverse` when `canDecode` is false.
- **Not performed:** interactive browser smoke test (see Important #4).

---

## Strengths

1. **The centralization is genuinely good.** Collapsing recipes, chains, cycles, and plain transforms onto one `applyTransform` → `applyActiveTransformOutput` path removed a whole parallel code path (`applySavedChain` and the manager Apply button) rather than adding a second one. The dead reference check is clean — no dangling callers anywhere in the repo. This is the architectural win the spec asked for.
2. **`copyOnSuccess` is the right seam.** Making clipboard side effects an explicit opt-in flag, rather than inferring intent from output kind, means live typing, options saves, and list rebuilds cannot flood Copy History. Verified: only `applyTransform` passes it; the other four call sites do not.
3. **Stale-guard discipline is preserved through the new async branches.** The `transformApplyGeneration` and `activeTransform !== transform` checks are re-asserted after `await` in both the success and error paths, including the new AI-decode branch. This is easy to get wrong when adding an await and it was not gotten wrong.
4. **`transformApplyMode.js` is a well-chosen extraction.** Pure, dependency-free, storage-injected, and therefore trivially testable in the existing `vm`-based harness. The try/catch around `localStorage` is appropriate for a mode preference (fail to default, never throw into the UI).
5. **The QR carrier text payload is a real correctness fix, not just plumbing.** Before this change, image results silently skipped the clipboard entirely. Now the underlying text rides along, is shown under the preview, and is copied. Both the unit assertion (`applyCarrier` direct) and the integration assertion (`runStagedRecipeAsync` end-to-end, `text: 'Khoor'`) are in place — a good test pairing.
6. **`transformOutputImage` splits cleanly from `transformOutput`.** Previously the data URL and the text shared one field, which is exactly why image results couldn't also carry text. The split is applied consistently across all five reset sites (guard, success, error, list-rebuild, options).
7. **Spec coverage is otherwise complete.** Every locked decision in the spec's decision table is implemented: global segmented control, `encode` default, `localStorage` persistence, auto-AI on irreversible decode, Output-under-Input, text always in Output, image preview plus text, manager Apply removed.

---

## Issues by severity

### Critical

#### C1. AI decode fires on every keystroke, tab activation, and options save

`resolveAction` is consulted inside `applyActiveTransformOutput`, which has **five** call sites — but only one of them represents an explicit user "run this" gesture:

```1118:1136:js/tools/TransformTool.js
            applyActiveTransformOutput: async function(options) {
                const generation = ++this.transformApplyGeneration;
                const transform = this.activeTransform;
                const input = this.transformInput;
                const preserveEmojis = !!(options && options.preserveEmojis);
                const copyOnSuccess = !!(options && options.copyOnSuccess);
                ...
                const action = window.TransformApplyMode
                    ? window.TransformApplyMode.resolveAction(transform, this.transformIoMode)
                    : 'encode';
```

The other four are implicit refreshes: `autoTransform` (bound to `@input` on the textarea), the `transformInput` watcher (which fires on the *same* keystroke, so two calls per character), `refreshCustomSpellingTransforms` (invoked from `mounted` and `onActivate`, i.e. every switch back to the Transforms tab), and the options-modal save handler.

With Decode selected and any irreversible transform active, each of those reaches the `ai_decode` branch and issues a live `AIProvider.chatCompletion` request:

```1141:1150:js/tools/TransformTool.js
                    if (action === 'ai_decode') {
                        if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
                            || !window.AIProvider.getConfiguredProviders().length) {
                            throw new Error('Configure an AI provider in Settings to decode this transform.');
                        }
                        const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
                        const text = await window.TransformChains.aiDecode(recipe, input, {
                            model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
                        });
```

There is no debounce anywhere on the input. Concretely: select a one-way cycle, switch to Decode, and type a ten-character sentence — that is roughly twenty billed completions at `maxTokens: 4096`, plus rate-limit risk. If no provider is configured, the same path throws on every keystroke and calls `showNotification` each time, producing a continuous error-toast stream that makes the input unusable.

The spec line "Existing `@input` auto-transform continues and respects the current Encode/Decode mode" is the origin of this, but it was written without accounting for the AI branch being reachable from a keystroke handler. The plan's own constraint — "Live `@input` auto-transform updates Output only (no clipboard spam)" — shows the intent was to avoid exactly this class of side effect.

I want to be precise about novelty: encode-mode staged recipes containing a Translate stage already had this shape (`stagedRecipeNeedsAsync` → `runStagedRecipeAsync` → `runTranslateNode` → AI call per keystroke), so the pattern predates this branch. What is new is that the global Decode switch extends unbounded AI calls from a narrow opt-in recipe configuration to *any* of the many transforms that lack a `reverse`, reachable with two clicks and no recipe authoring. That escalation is what makes it a merge blocker rather than an inherited wart.

**Suggested fix (small):** gate the AI branch on explicit intent. Pass something like `allowAi: true` from `applyTransform` only, and in the `ai_decode` branch when the flag is absent, clear the output and return `{ applied: false, needsExplicitApply: true }` without calling the provider. Optionally surface a one-line hint in the Output area ("Click the transform to run AI decode"). A debounce alone is not sufficient — it reduces the call volume but still bills for typing.

#### C2. AI decode for recipes and cycles sends only the recipe's display name as the prompt hint

`describeForAiDecode` branches on `transform.isChain` / `transform.isCycle` to build a step-by-step recipe description via `TransformChains.describeRecipe`:

```1058:1073:js/core/transformApplyMode.js
    function describeForAiDecode(transform, chainsApi) {
        if (!transform) return 'Unknown transform';
        if (chainsApi && transform.isChain && transform.chainId) {
            ...
        if (chainsApi && transform.isCycle && transform.cycleId) {
            ...
        var bits = [transform.name || 'Transform'];
        if (transform.description) bits.push(transform.description);
        return bits.join(' — ');
    }
```

But the object that actually reaches it is not the registered `window.transforms` entry — it is the reshaped Vue-facing copy produced by `buildTransformsFromWindow`, which whitelists fields and **omits `isChain`, `isCycle`, `cycleId`, `canDecode`, and `description`**:

```128:140:js/tools/TransformTool.js
            .map(([key, transform]) => ({
                transformKey: key,
                customSpellingId: transform.customSpellingId || null,
                chainId: transform.chainId || null,
                name: transform.name,
                func: transform.func.bind(transform),
                preview: transform.preview ? transform.preview.bind(transform) : function() { return '[preview]'; },
                reverse: transform.reverse ? transform.reverse.bind(transform) : null,
                category: transform.category || 'special',
                configurableOptions: transform.configurableOptions || [],
                hasConfigurableOptions: Array.isArray(transform.configurableOptions) && transform.configurableOptions.length > 0,
                inputKind: transform.inputKind === 'text' ? 'text' : 'textarea'
            }));
```

Every transform tile in the template renders from this mapped array (`getFilteredTransformsByCategory`, `getFilteredFavoriteDisplayItems`, `getFilteredLastUsedDisplayItems` all read `this.transforms`), and `applyTransform(transform, $event)` assigns that mapped object to `activeTransform`. So for a saved recipe or cycle, both `isChain` and `isCycle` are `undefined`, both guarded branches are skipped, `description` is also absent, and the function returns **just `transform.name`**.

That name is then handed to `buildDecodePrompt` as the authoritative recipe description:

```732:739:js/core/transformChains.js
    function buildDecodePrompt(recipeKey, text) {
        return 'The following text was produced by applying a known sequence of ' +
            'reversible text transformations (encodings, ciphers, and Unicode styling).\n\n' +
            'TRANSFORMATION RECIPE (applied in this order):\n' + recipeKey + '\n\n' +
```

The model receives `TRANSFORMATION RECIPE (applied in this order):` followed by a user-chosen label such as `Secret Sauce` or `My Cycle` and nothing else. It has no way to recover the plaintext and will hallucinate. This breaks the spec's headline decode behavior — "Decode + irreversible recipe triggers AI decode into Output + clipboard when AI is configured" — for the exact case the feature was built to serve, while still showing a `"<name> decoded and copied!"` success toast and writing the hallucinated text to the clipboard and Copy History.

Note that the per-task reviews recorded this path as working. The helper's unit test exercises `describeForAiDecode` only with a hand-built literal (`{ name: 'Bold', description: 'Unicode bold' }`) and with `chainsApi === null`, so the chain/cycle branches were never executed against a realistic input shape — the test suite could not have caught this. This is the concrete cost of carry-forward #2 (untested describe branches); it was not merely a coverage gap, it was hiding a real defect.

**Suggested fix (small):** add `isChain: !!transform.isChain`, `isCycle: !!transform.isCycle`, `cycleId: transform.cycleId || null`, `canDecode: transform.canDecode`, and `description: transform.description || ''` to the `buildTransformsFromWindow` mapping, then add a test that calls `describeForAiDecode` with a stub `chainsApi` and asserts the returned string contains the node descriptions rather than only the name.

### Important

#### I1. `chainIsReversible` ignores Translate and Carrier stages, so Decode silently returns wrong output (carry-forward #1, confirmed and worse than described)

`chainIsReversible` delegates to `getRunnableChainNodes`, which for staged recipes calls `getStagedTransformNodes` — and that filters to nodes carrying a `transform` string:

```243:247:js/core/transformChains.js
    function getStagedTransformNodes(recipe) {
        return getStagedNodes(recipe).filter(function(n) {
            return n && typeof n.transform === 'string';
        });
    }
```

Translate nodes (`{ type: 'translate', lang, model }`) and carrier nodes (`{ type: 'qr' | 'emoji_stego' }`) have no `transform` key — confirmed against `flattenStagedToNodes` in `js/core/transformRecipeStages.js` — so they are invisible to the reversibility check. A `Translate → Theban` recipe (one of the three shipped templates) therefore registers with `canDecode: true` and a non-null `reverse`, `resolveAction` returns `'reverse'`, and the `reverse` branch runs *before* the staged-async branch. The user gets Theban un-mapped back to the translated foreign-language text, labelled "Decoded Message", with a `"decoded and copied!"` success toast and no indication that the translation layer was never undone. Silent wrong answers are worse than errors.

Two things make this more than the "minor" it was carried forward as:

- **It also corrupts the fix.** `describeChain` uses the same `getRunnableChainNodes` helper, so even after routing translate recipes to AI decode, the prompt would omit the Translate stage and the model would return the still-translated text. Both halves need fixing together.
- **The docs already claim the stronger behavior.** `docs/TOOL_ARCHITECTURE.md` states "Mechanical reverse is available only when every relevant node supports it," which is not what the code does.

The same filter makes a `Caesar → QR` recipe register as reversible, so Decode on it offers a mechanical reverse of text the user only has as an image.

This bug predates the range (`transformChains.js` has exactly one changed line here, the QR `text` payload). But before this branch, decoding a recipe required deliberately choosing mechanical reverse or the manager's AI decode; now a global two-state switch routes there automatically for every tile. The feature converts a latent inconsistency into a default-path wrong answer, which is why it should be fixed here rather than deferred.

**Suggested fix:** have `chainIsReversible` inspect the full `getStagedNodes` list and return `false` when any node is a Translate or Carrier stage; extend `describeChain` (or `describeRecipe`) to emit those stages so the AI hint is complete.

#### I2. `canDecode` is dropped by the Vue mapping, making `resolveAction`'s guard dead in the running app

`isMechanicallyReversible` checks `typeof transform.reverse === 'function' && transform.canDecode !== false`. Because `buildTransformsFromWindow` does not copy `canDecode` (see C2), the second clause is always true in production, and routing collapses to "does it have a `reverse`?".

Today this happens to be harmless: `BaseTransformer` sets `this.reverse = null` whenever `canDecode` is false (`src/transformers/BaseTransformer.js:95-97`), and both `registerChain` and `registerCycle` set `reverse: null` when not reversible. I checked all transformers declaring `canDecode: false` and none ship a live `reverse`. So the guard is currently redundant rather than wrong.

It is still worth fixing now, because the helper's unit test asserts `resolveAction(irreversible, 'decode') === 'ai_decode'` using `{ canDecode: false, reverse: null }` — the test passes for the `reverse` reason, not the `canDecode` reason, so the suite gives false confidence about a contract the app never actually exercises. Any transform registered directly on `window.transforms` (bypassing `BaseTransformer`) with `canDecode: false` plus a lossy `reverse` would be silently misrouted to mechanical reverse. Fix is one line in the same mapping as C2.

#### I3. Interactive smoke test never run (carry-forward #4)

This branch restructures the Transforms tab DOM: a new segmented control inside a `position: sticky` container, and the entire `.output-section` relocated from the bottom of the page into the flex column between input and the lexeme card. There is no DOM- or browser-level test in the suite covering the transforms template — `test_lexeme_ui_surface` is the only template-aware test and it does not touch these regions. The five-item manual checklist in the plan's Task 4 Step 5 was never executed.

Everything I can verify statically is correct, but layout and interaction regressions in a sticky flex container are precisely what static review cannot catch. Given the whole point of the feature is a visible control and a relocated output field, one manual pass before merge is not optional. Minimum coverage: switch persists across reload; Output renders under Input with a long value; QR recipe shows image *and* text with a working copy button; Decode + reversible transform round-trips; Decode + irreversible without a provider shows the Settings toast exactly once.

### Minor

1. **Stale README line (carry-forward #3).** `README.md:281` still reads "If a recipe cannot mechanically reverse, use **AI decode** in the manager" — not false (the manager tool remains) but now misleading as the primary instruction, and it sits four lines below the new bullet describing the tile-click path. Reword to present the manager as the secondary route.
2. **Unreachable toast branch (carry-forward #5).** `applyTransform`'s `transformOutputKind === 'image' && !this.transformOutput` branch is dead: the QR carrier is the only producer of `kind: 'image'` anywhere in the codebase (verified by grep), and it now always populates `text`. Either drop the branch or keep it as a deliberate guard with a one-line note; leaving it silently dead invites a future reader to assume image-without-text is a live case.
3. **Untested helper branches (carry-forward #2).** `loadMode`'s storage-throw path, `saveMode` with a missing/invalid storage object, and both `describeForAiDecode` chain/cycle branches are unexercised. As noted in C2, the describe gap concealed a Critical defect, so this is worth closing rather than deferring.
4. **Error toasts lost their transform attribution.** The message changed from `` `${transform.name} failed: ${e.message}` `` to `(e && e.message) ? e.message : ...`. A user now sees a bare "No reverse function available." with no indication of which of 222 transforms produced it. Prefixing the transform name back on (while keeping the AI/Settings message intact, since it reads well standalone) restores context.
5. **The new CSS spacing rule does the opposite of its intent.** `.transform-layout` is `display: flex; flex-direction: column; gap: 24px`, so `.transform-layout .input-section + .output-section { margin-top: 0.75rem }` *adds* 12px to the existing 24px gap (36px total) rather than tightening the pairing. Either drop the rule or use a negative margin / dedicated wrapper.
6. **Toggle exposes no state to assistive technology.** The buttons convey selection only through a CSS class. `role="group"` plus `aria-label` does not communicate which is active. Add `:aria-pressed="transformIoMode === 'encode'"` (and the decode equivalent), or model it as a `radiogroup`.
7. **`setTransformIoMode` no-ops entirely if the helper is missing.** `if (!window.TransformApplyMode) return;` means a script-load failure leaves a visible toggle that does nothing. The data initializer already falls back to `'encode'`; the setter should likewise fall back to local state so the control still works in-session.
8. **Success toast claims a copy that did not happen.** The copy is conditional (`copyOnSuccess && this.transformOutput`) but the toast unconditionally says "…and copied!". When a reverse yields an empty string, the user gets a success toast, no clipboard write, and no Output section (its `v-if` is false). Pre-existing shape, newly more reachable in Decode mode.
9. **`docs/TOOL_ARCHITECTURE.md` says manager Apply "is demoted"; it was removed outright.** Small precision fix while that file is already being touched for I1.
10. **Working-tree hygiene.** The uncommitted `.gitignore` change comments out `.superpowers/`, which would start tracking the SDD scratch directory. Not part of the reviewed range, but it should not ride along with the merge.

---

## Spec compliance

| Spec requirement | Status |
|---|---|
| Global Encode/Decode control near input, persisted | Met — `transform-encode-decode-mode`, default `encode` |
| Click transform **or** recipe → same path | Met — shared `applyTransform`; `applySavedChain` and manager Apply removed |
| Output field directly under Input | Met (unverified visually — I3) |
| Text results always in Output | Met |
| Decode + mechanically reversible → `reverse` | Met for plain transforms; **wrong for Translate/Carrier recipes (I1)** |
| Decode + irreversible → AI decode | Routed correctly, but **prompt is degraded to the recipe name (C2)** |
| AI not configured → Settings toast | Met (but fires per keystroke — C1) |
| Mode flip re-runs with active transform | Met |
| Live typing respects mode, Output only, no clipboard | Clipboard requirement met; **unbounded AI calls (C1)** |
| QR: image preview + underlying text + copy text | Met, with unit and integration coverage |
| Empty input → select + focus, not a hard error | Met |

---

## Merge readiness

**Not ready.** The encode direction, the plumbing, the test suite, and the architectural consolidation are in good shape — I would merge the encode half as-is. The decode half, which is the feature's reason for existing, has two defects that produce either unbounded billing or confidently wrong output, plus one pre-existing routing bug that this branch promotes to the default path.

None of the fixes are large: C2 and I2 are a five-field addition to one object literal, C1 is a flag threaded through one call site plus an early return, and I1 is a filter change in two functions. The verification cost (I3) is a single manual pass. I would expect all of it inside one focused session.

### Carry-forward triage

| # | Item | Verdict | Reason |
|---|---|---|---|
| 1 | `chainIsReversible` ignores translate stages | **Fix before merge** | Confirmed; also affects carriers and `describeChain`. Produces silent wrong output on a shipped template (`Translate → Theban`) via the new default decode path |
| 2 | Untested storage-error / chain-cycle describe branches | **Fix before merge** | Not just coverage — the missing describe test concealed C2. Closing it is the regression guard for that fix |
| 3 | Stale README manager-only AI decode line | Later (or fold in) | Cosmetic doc drift; trivial to include with the C1/C2 fixes |
| 4 | Browser interactive smoke never run | **Fix before merge** | Only remaining verification of a DOM restructure with no automated UI coverage |
| 5 | Unreachable image-without-text toast branch | Later | Dead code, no user impact; clean up opportunistically |

### Blocking list

1. **C1** — gate `ai_decode` behind explicit apply (stop per-keystroke, per-tab-activate, per-options-save provider calls).
2. **C2** — carry `isChain` / `isCycle` / `cycleId` / `description` (and `canDecode`, per I2) through `buildTransformsFromWindow` so recipe AI decode receives a real recipe description; add a `describeForAiDecode` test with a stub `chainsApi`.
3. **I1** — make `chainIsReversible` account for Translate and Carrier stages, and extend `describeChain` to include them.
4. **I3** — run the manual smoke checklist and record the result.

Non-blocking: I2's one-line mapping addition should ride with C2. Minors 1–10 can follow, though 1, 4, 5, and 9 are cheap enough to include now.
