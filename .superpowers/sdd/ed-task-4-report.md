# Task 4 Report: Apply path — encode / reverse / AI decode + clipboard

## Summary

Implemented the shared apply path per brief, rewriting `applyActiveTransformOutput` and `applyTransform` in `js/tools/TransformTool.js`, and demoting the manager Apply button in `templates/transforms.html`.

## Changes

### `js/tools/TransformTool.js`

- Added `transformOutputImage: ''` to tool state (alongside existing `transformOutput`/`transformOutputKind`).
- Rewrote `applyActiveTransformOutput(options)`:
  - Resolves `action` via `TransformApplyMode.resolveAction(transform, this.transformIoMode)` → `'encode' | 'reverse' | 'ai_decode'`.
  - `ai_decode`: guards on `AIProvider.getConfiguredProviders().length`, throws a Settings-toast-worthy error if missing; otherwise calls `TransformChains.aiDecode(describeForAiDecode(...), input, { model })`.
  - `reverse`: calls `transform.reverse(input, opts)`, throws if absent.
  - Falls through to existing staged-async / emoji-preserving / plain `transform.func` paths for `encode`.
  - Splits result into `transformOutputImage` (image `value`) vs `transformOutput` (text `value`, or `text` field for image results e.g. QR's underlying payload).
  - `copyOnSuccess` option now triggers `forceCopyToClipboard`/`isTransformCopy` here (moved out of `applyTransform`), only when explicitly requested and `transformOutput` is non-empty.
  - Stale-generation/error handling preserved; errors clear both output fields and toast the error message (AI-missing message surfaces verbatim).
- `applyTransform`: now calls `applyActiveTransformOutput({ copyOnSuccess: true })`, removed the now-redundant clipboard block, success toast wording reflects mode (`decoded and copied!` vs `applied and copied!`) and still special-cases image-only (no text) previews and Random Mix.
- `autoTransform` unchanged (`{ preserveEmojis: true }`, no `copyOnSuccess`) — confirmed it already omits clipboard, satisfying "no history flood" while typing.
- All other call sites (`commitTransformOptions`, `refreshCustomSpellingTransforms`, `transformInput` watcher) call the shared method without `copyOnSuccess` — unchanged behavior, now also clear `transformOutputImage` where output is cleared.
- Removed dead `applySavedChain` (only consumer was the deleted Apply button); updated leftover "use Apply on the list" notification copy after recipe save.

### `templates/transforms.html`

- Manager recipe list: removed the primary "Apply" button entirely (chains now run only via clicking the registered transform button, same path as every other method); updated the now-stale hint text.
- Output section: `v-if` now shows on `transformOutput || transformOutputImage`; image `<img>` binds to `transformOutputImage`; added a `<p>` fallback to surface the underlying `transformOutput` text for image results (e.g. QR's pre-carrier payload) with its own copy button (copy button now shows whenever `transformOutput` is non-empty, regardless of kind).

### `css/style.css`

- Added `.transform-image-output-text` (small monospace, wrapping) for the new underlying-text paragraph under image output.

## Verification

- `npm run test:apply-mode`, `test:chains`, `test:recipes` — pass individually.
- `npm run build:templates` — succeeds, no HTML/Vue errors.
- `npm run test:all` — exit 0 (universal, steg, lexeme, lexeme-ui, chains, recipes, apply-mode all OK).
- `ReadLints` on all three changed files — no errors.
- Manual checklist from brief not run in a browser (no headless UI harness in this pass); logic was traced end-to-end against `TransformApplyMode.resolveAction`, `TransformChains.aiDecode`, `AIProvider.getConfiguredProviders`, and `caesar.reverse(text, options)` signatures to confirm wiring is correct (Caesar reverse takes `(text, options)`, chain/cycle reverse take `(text)` only — both compatible with `transform.reverse(input, opts)` call since JS ignores extra args).

## Concerns / follow-ups

- No automated UI test covers the 5-point manual checklist (encode/decode/AI-decode/AI-missing/live-typing) — recommend a quick manual pass or a future browser-based test.
- Pre-existing minor quirk (not introduced by this task): the `transformInput` Vue watcher and the `@input="autoTransform"` handler on the textarea can both fire on the same keystroke, causing two generation-bumped calls; harmless (later one wins) but worth a look in a future cleanup, out of scope here.

## Files changed

- `js/tools/TransformTool.js`
- `templates/transforms.html`
- `css/style.css`

## Commit

`374e017` — feat: apply transforms in Encode/Decode mode with shared output path

---

## Final-review fixes

Addresses the Critical/Important findings from the final whole-branch review (`ed-final-review.md`).

### Critical 1 — AI decode fired from live typing / watchers / tab refresh

`js/tools/TransformTool.js` — `applyActiveTransformOutput(options)`:

- Added `allowAiDecode = !!(options && (options.allowAiDecode || options.copyOnSuccess))`.
- Right after `action` is resolved and before the `try` block: `if (action === 'ai_decode' && !allowAiDecode) return { applied: false };` — no AI call, no error toast, existing output left untouched.
- `applyTransform` now passes `{ copyOnSuccess: true, allowAiDecode: true }` (explicit click, and the mode-flip re-apply in `setTransformIoMode` which calls `applyTransform`). The other four call sites (`autoTransform` `@input`, the `transformInput` watcher, `commitTransformOptions` options-save, `refreshCustomSpellingTransforms` tab-refresh) pass no flag, so `ai_decode` now short-circuits for all of them.

### Critical 2 — recipe/cycle AI decode prompt degraded to the display name

`js/tools/TransformTool.js` — `buildTransformsFromWindow()` mapping now also copies `isChain: !!transform.isChain`, `isCycle: !!transform.isCycle`, `cycleId: transform.cycleId || null`, `description: transform.description || ''`, `canDecode: transform.canDecode !== false` onto the Vue-facing transform object (this also fixes Important #I2 from the review — `canDecode` was previously dropped, making `resolveAction`'s guard dead). `describeForAiDecode` in `js/core/transformApplyMode.js` was already correct; the bug was entirely in the mapping.

`tests/test_transform_apply_mode.js` — added:
- A stub-`chainsApi` test proving `describeForAiDecode` calls `describeRecipe` (not the name fallback) when `isChain`/`chainId` or `isCycle`/`cycleId` are present, and a companion assertion that the pre-fix shape (`chainId` without `isChain`) falls back to the bare name — pins the exact regression.
- A full integration test loading the real `transformRecipeStages.js` + `transformChains.js` + `transformApplyMode.js` in one `vm` context: saves a staged recipe with a translate stage, calls `describeForAiDecode({ isChain: true, chainId })`, and asserts the result contains `Caesar` and `Latin` (not just the recipe's name) — also exercises the Important fix below. Same pattern for a cycle.

### Important — `chainIsReversible` / `describeChain` ignored Translate & Carrier stages

`js/core/transformChains.js`:

- Added `stagedChainHasOneWayStage(chain)` — true when `chain.kind === 'staged'` and `stages.translate` or `stages.carrier` is set.
- `chainIsReversible` now returns `false` immediately when `stagedChainHasOneWayStage(chain)` is true, before falling through to the existing node-by-node check. This also makes `registerChain`'s `canDecode`/`reverse` correct (both flow from `chainIsReversible`), so `resolveAction` now routes Translate/Carrier recipes to `ai_decode` instead of a silently-wrong mechanical `reverse`.
- Added `describeStagedNode(node)` to describe non-transform staged nodes (`translate` → `"Translate to <language> [translate]"`, `qr` → `"QR code carrier [qr]"`, `emoji_stego` → `"Emoji steganography carrier [emoji_stego]"`).
- `describeChain` now walks the full `getStagedNodes(chain)` list (not the transform-only `getRunnableChainNodes`) for staged recipes, using `describeStagedNode`, so the AI decode hint built by `describeRecipe`/`buildDecodePrompt` includes every stage.

`tests/test_transform_recipes.js` — added:
- Baseline: a plain cipher+encoding staged recipe (with real `reverse` functions added to the `caesar`/`base64` stubs) still reports `chainIsReversible === true`.
- A staged recipe with a `translate` stage: `chainIsReversible === false`, the registered `chain_<id>.canDecode === false` and `.reverse === null`, and `describeChain` output matches `/Translate/` and `/Latin/i` while still including the transform-backed `Theban` stage.
- A staged recipe with a `qr` carrier stage: `chainIsReversible === false`, `.reverse === null`, and `describeChain` output matches `/QR/` and still includes `Caesar`.

### Optional docs

`README.md:281` reworded — presents clicking the tile in Decode mode as the primary AI-decode path and the manager panel as the secondary/testing tool, replacing the stale "use AI decode in the manager" phrasing.

### Verification

```
node tests/test_transform_apply_mode.js   # OK
node tests/test_transform_recipes.js      # OK
npm run test:all                          # exit 0 — all 7 suites (universal, steg, lexeme,
                                           # lexeme-ui, chains, recipes, apply-mode) OK
```

`ReadLints` on all four edited source/test files — no errors.

### Files changed

- `js/tools/TransformTool.js`
- `js/core/transformChains.js`
- `tests/test_transform_apply_mode.js`
- `tests/test_transform_recipes.js`
- `README.md`

### Concerns / remaining

- Important #I3 (interactive browser smoke test for the DOM restructure) is out of scope for this pass — no automated UI harness exists in this suite; still recommended before merge.
- Minor findings #4–10 (dead image-without-text toast, CSS spacing rule, `aria-pressed`, `setTransformIoMode` hard fail-safe, transform-name-less error toast, `docs/TOOL_ARCHITECTURE.md` "demoted" wording, `.gitignore` hygiene) were left untouched — explicitly out of the Critical/Important scope for this pass, and the `.gitignore` change predates this session and was left as-is (not committed).
