# Task 4 Report: Prune orphan favorites after refresh

## Status

DONE

## Implementation

- Added `pruneFavoritesForMissingTransforms()` to Vue methods in `js/tools/TransformTool.js` (verbatim from brief).
- Called at end of `refreshCustomSpellingTransforms` after active-transform rematch by `transformKey`.
- Wired into `deleteSavedChain` and `deleteSavedCycle` after successful delete + `refreshChainsTransforms` (Task 2 deferred call).

## Verification

- `node --check js/tools/TransformTool.js` — passed.
- Ad-hoc smoke test: string favorites for missing transforms removed; translate object favorites preserved.
- IDE lint diagnostics for `js/tools/TransformTool.js` — none.

## Self-review

- Prune body matches brief exactly; translate favorites left untouched.
- Delete handlers only call prune on success path, after refresh.
- Only `js/tools/TransformTool.js` staged and committed.

## Commit

- `8538f71 fix: drop orphan transform favorites after list refresh`
- Base confirmed: `a287921`

## Concerns

None. Delete paths invoke prune twice (via `refreshCustomSpellingTransforms` and explicit call); idempotent and harmless.
