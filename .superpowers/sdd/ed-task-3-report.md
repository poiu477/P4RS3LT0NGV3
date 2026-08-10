# Task 3 Report: Encode/Decode switch UI + Output under Input

## Status

DONE_WITH_CONCERNS

## What Was Implemented

Added the Encode/Decode mode state and switch to the Transforms UI, persisted mode changes through the existing `TransformApplyMode` helper, and moved the existing transform output directly below the input.

### Vue state and behavior

- Added `transformIoMode`, initialized with `TransformApplyMode.loadMode(localStorage)` and an `'encode'` fallback.
- Added `setTransformIoMode(mode)` using `normalizeMode` and `saveMode`.
- Re-applies the active transform through the existing `applyTransform` path when the mode intentionally changes with a non-empty input on the Transforms tab.
- Kept the existing `transformOutput` and `transformOutputKind` apply-path bindings; Task 4 remains responsible for decode/reverse/AI behavior and split image/text output fields.

### Template

- Added an accessible Encode/Decode button group above both possible input controls.
- Added the exact mode-sensitive input placeholder text from the brief.
- Relocated `.output-section` from below the transform grid to immediately after `.input-section`.
- Updated the output heading to show `Decoded Message` or `Transformed Message`.
- Preserved the current image-versus-text rendering behavior until Task 4 wires separate image and text fields.

### Styling

- Added the required segmented mode-switch styles.
- Added the required adjacent input/output spacing rule.

## Files Changed

- `js/tools/TransformTool.js`
- `templates/transforms.html`
- `css/style.css`

## Verification

- `npm run build:templates` — PASS; all 13 templates injected successfully.
- `npm run test:apply-mode` — PASS; `test_transform_apply_mode: OK`.
- `git diff --check` before commit — PASS.
- `git diff caee482^ caee482 --check` after commit — PASS.
- IDE diagnostics for all three changed files — no errors.
- Static template inspection confirmed the switch precedes the input and the output is the immediate next section.

## Commit

`caee482 feat: add Encode/Decode switch and move output under input`

Only the three task implementation files were committed. Existing `.gitignore` and SDD/documentation working-tree changes were left untouched.

## Self-Review

- Required state, setter guards, normalization, persistence, and intentional re-apply behavior match the brief.
- Both textarea and single-line input receive the mode-dependent placeholder.
- Output markup remains compatible with the current Task 2 result shape and does not preempt Task 4 apply-path work.
- Required CSS values were copied verbatim.

## Concerns

Automated browser smoke testing could not be completed because the Cursor browser service created no navigable tab (`Browser view not found` / `No browser tab available`). The local preview server started successfully, but visual confirmation of the switch and output placement remains for the parent/manual review.
