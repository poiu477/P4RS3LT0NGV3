# Task 4 Review: Apply path — encode / reverse / AI decode + clipboard

## Verdict

- **Spec:** ✅
- **Task quality:** Approved

## Spec compliance

- **Missing:** None. All decisions in `docs/superpowers/specs/2026-08-04-encode-decode-mode-design.md` relevant to this task are wired: encode → `func`/staged-async, decode+reversible → `reverse`, decode+irreversible → AI decode via `TransformApplyMode.describeForAiDecode` + `TransformChains.aiDecode`, missing-AI → error toast naming Settings, text always lands in `transformOutput` (shown under Input via Task 3's template), clipboard only on explicit click/mode-flip (`copyOnSuccess`), live `@input` auto-transform (`autoTransform`) stays clipboard-free.
- **Extra:** The implementer also fixed the carrier/QR "underlying text" copy gap (old code only copied when `transformOutputKind === 'text'`, silently skipping the clipboard for image results even when `result.text` was populated by Task 2's QR fix). This is in-spec ("Carriers … if underlying text exists, also show that text … and copy the text") and directly serves this task's mandate ("Produces: filled `transformOutput`… clipboard via `forceCopyToClipboard`"), so it's a legitimate in-scope completion rather than scope creep. The `css/style.css` addition (`.transform-image-output-text`) is the minimal styling this needs.
- **Misunderstood:** None.

## Task quality

**Critical:** None.

**Important:**
- None specific to this diff. (See risk note below for an inherited concern outside this diff's file set.)

**Minor:**
1. Error toast wording changed from `` `${transform.name} failed: ${e.message}` `` to just `e.message` (falling back to `` `${transform.name} failed.` `` only when there's no message). This is correct and required for the AI-missing case ("Configure an AI provider in Settings…" reads better without a `Transform failed:` prefix), but it does mean other thrown errors (e.g. an unexpected `reverse` exception) now surface without transform-name context. Not a regression against any test or requirement, just a minor UX trade-off worth a glance.
2. The `image` + `!transformOutput` branch in `applyTransform`'s toast message (`"... image preview ready!"`, no "copied") is currently unreachable — the only `kind: 'image'` producer in the codebase (`transformChains.js` QR carrier) always sets `text`. Harmless defensive code, not a bug.

**Risk note (not a Task 4 defect, flagged for the epic, not blocking this gate):** `chainIsReversible`/`registerChain` in `js/core/transformChains.js` (untouched by this diff, predates the encode/decode epic) compute reversibility and build `reverse` from only the non-carrier, non-translate nodes of a staged recipe. For a carrier-only recipe this correctly resolves to AI decode (empty node list ⇒ not reversible). But a staged recipe combining a **translate** stage with an otherwise-reversible transform stage would be marked `canDecode: true` and `reverse` would skip the translate step entirely, reversing only the mechanical stage against text that was never actually translated back — producing wrong output instead of routing to AI decode. This is inherited logic Task 4 correctly treats as a black box per its brief ("Consumes: … `transform.reverse`"); fixing it is out of scope here. Worth a follow-up ticket or a look during the final epic-level review, since it affects the Decode-mode correctness guarantee this feature advertises for staged translate+transform recipes specifically (carrier-only and pure-transform recipes are unaffected).

## Verification of the implementer's claims

- Full diff read line-by-line against `js/core/transformApplyMode.js` (`resolveAction`, `describeForAiDecode`) and `js/core/transformChains.js` (`aiDecode(recipeKey, text, opts)`, `runStagedRecipeAsync`) call signatures — all call sites in the new `applyActiveTransformOutput` match.
- Confirmed `autoTransform` (`{ preserveEmojis: true }`, no `copyOnSuccess`) and the `transformInput` watcher (no options) never set `copyOnSuccess`, so live typing never spams Copy History — matches the "no history flood" requirement.
- Confirmed `setTransformIoMode` (pre-existing, unmodified) re-invokes `applyTransform` on mode flip, which now routes through `applyActiveTransformOutput({ copyOnSuccess: true })` — mode-flip apply now correctly copies, matching the brief's "click/mode-flip apply only" clipboard rule.
- Confirmed `applySavedChain` removal has no dangling references anywhere in the repo (`grep` clean) and the manager Apply button is fully removed per the brief's stated preference ("Prefer remove to avoid two primary verbs"), with the stale "use Apply on the list" copy updated in both the save-notification string and the manager hint text.
- Verified `templates/transforms.html`'s new `v-if`/`v-else-if` chain (`img` → `textarea` → `p`) renders correctly for all three `transformOutputKind`/`transformOutput` combinations (text-only, image+text, and the theoretically-unreachable image-only case) by tracing Vue's adjacent-sibling `v-else-if` semantics against the actual markup.
- Ran `npm run test:all` myself (universal, steg, lexeme, lexeme-ui, chains, recipes, apply-mode) — exit code 0, consistent with the report. `test_transform_apply_mode.js` only covers the pure `transformApplyMode.js` helper, not `TransformTool.js`'s Vue methods directly, so this doesn't independently prove the new `applyActiveTransformOutput`/`applyTransform` wiring — the report's disclosed gap ("No automated UI test covers the 5-point manual checklist") is accurate and was not overstated.
- Confirmed the working tree has no code-file modifications (`git status` shows only untracked docs/tooling files), i.e. the checkout was not mutated during this review.
