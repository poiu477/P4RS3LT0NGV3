# Task 8 Report: Apply/preview wiring for async + carrier output

## Status

Complete.

## Commit

- `b195190 feat: apply staged recipes with async translate and carrier preview`

## Implementation

- Preserved each registered chain ID in the Vue transform model so staged recipes can be resolved at apply time.
- Routed staged recipes containing translate or carrier stages through `runStagedRecipeAsync`.
- Kept sync-only staged recipes on their registered synchronous transform function.
- Added output-kind state so text results continue to copy normally while image results render as an `<img>` preview without copying the data URL.
- Added async failure notification and cleared stale output on failure.
- Rebuilt the templates successfully with `npm run build:templates`; the generated `index.html` remained unchanged.

## Validation

- `node --check js/tools/TransformTool.js` — passed.
- `npm run test:recipes` — passed.
- `npm run test:all` — passed.
- IDE lint check for both modified files — no errors.

## Concerns

- No automated browser-level Vue click test exists for this path; validation covers syntax, recipe runner behavior, template build, and the full existing suite.
- Pre-existing unrelated `.gitignore` and untracked SDD/documentation files were left untouched.

## Important Review Fixes

Commit:

- `f274155 fix: route staged recipe recomputes through async-safe apply`

Changes:

- Extracted `applyActiveTransformOutput()` as the single output-computation path for click apply, `autoTransform`, input watcher updates, option-save refreshes, and active-transform rematches after list rebuilds.
- Added a monotonically increasing apply generation and captured-transform identity check. Results and errors from superseded async work are ignored.
- Preserved synchronous execution for staged recipes without translate/carrier stages and preserved `autoTransform` emoji handling for ordinary synchronous transforms.
- Added responsive `.transform-image-output` styling so generated carrier images stay within the output layout.

Focused validation:

- `node --check js/tools/TransformTool.js` — passed.
- `npm run test:recipes` — passed.
- `npm run test:chains` — passed.
- `git diff --check` — passed.
- IDE lint check for modified JavaScript and CSS — no errors.
- Template rebuild was not needed because this review fix did not change template HTML.
