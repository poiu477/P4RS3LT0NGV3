# Task 5 Report: Keep chains out of blind decoder auto-guess

## Status

DONE

## Implementation

- Added `isChain` / `isCycle` / `category === 'chains'` skip guards to both auto-guess loops in `js/core/decoder.js`:
  - Detector-based reverse loop (lines 17–40)
  - Blind reverse loop without detectors (lines 78–91)
- Active-transform decode path (Decode tab, explicit selection) left unchanged.
- Updated `registerChain` `priority: 0` comment in `js/core/transformChains.js` to: excluded from blind auto-guess; still reversible when selected.

## Verification

- `node --check js/core/decoder.js` — passed
- `node --check js/core/transformChains.js` — passed
- `npm run test:universal` — 548 passed, 0 failed, 96 skipped

## Self-review

- Skip guards match brief verbatim; active-selection path untouched.
- Only `js/core/decoder.js` and `js/core/transformChains.js` staged and committed.

## Commit

- `2617ff1 fix: exclude saved chains/cycles from blind decoder auto-guess`
- Base confirmed: `8538f71`

## Concerns

None. `registerCycle` has no inline comment (only `priority: 0`); behavior is covered by the same decoder guards via `isCycle` and `category === 'chains'`.
