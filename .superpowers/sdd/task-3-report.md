# Task 3 Report: validateCycleForSave

## Status

DONE

## Implementation

- Added `validateCycleForSave(cycle)` to `js/core/transformChains.js`, placed immediately after `validateChainForSave`.
- Validator checks: object shape, non-empty trimmed name, non-empty `chainIds` array, each id is a non-empty string, and each id resolves to a known persisted chain via `loadChains()`.
- Wired into `saveCycle` at the top, mirroring `saveChain`: logs rejection, sets `lastMutationError`, returns `null` on failure.
- Successful saves continue to clear `lastMutationError` after write.

## Verification

- `node --check js/core/transformChains.js` — passed.
- Ad-hoc smoke test via `saveCycle` / `getLastMutationError`:
  - Empty name → `'Cycle name is required.'`
  - Empty `chainIds` → `'Add at least one chain to the cycle.'`
  - Unknown chain id → `'Cycle references a missing chain (missing).'`
  - Valid cycle → returns id, error cleared.
- IDE lint diagnostics for `js/core/transformChains.js` — none.
- `tests/test_transform_chains.js` does not exist yet (Task 7); no formal test file added per brief scope.

## Self-review

- Compared implementation verbatim with task brief validator body and `saveCycle` wiring pattern from `saveChain`.
- Only `js/core/transformChains.js` staged and committed; no unrelated dirty files included.
- `validateCycleForSave` is internal (not exported), consistent with `validateChainForSave`.

## Commit

- `f28b6ec feat: validate cycles before save`

## Concerns

None. Formal unit tests deferred to Task 7.

## Review fix (null-prototype map)

**Issue:** `known = {}` inherited `Object.prototype` keys (`__proto__`, `constructor`, `toString`), so those strings could pass as valid chain IDs without matching a persisted chain.

**Fix:** Changed to `var known = Object.create(null);` in `validateCycleForSave` only. `validateChainForSave` does not use a lookup map; no change there. Pre-existing maps elsewhere (e.g. `resolveCycleChains`) left untouched per scope.

**Commit:** `a287921 fix: use null-prototype map in validateCycleForSave`

**Re-verification:**
- `node --check js/core/transformChains.js` — passed.
- Smoke test: cycle save with `chainIds: ['__proto__']`, `['constructor']`, `['toString']` — all rejected with missing-chain errors; valid cycle with real id still saves.
