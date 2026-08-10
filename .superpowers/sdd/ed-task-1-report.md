# Task 1 Report: Pure mode helper + tests

## Status

DONE

## What Was Implemented

Created `TransformApplyMode` — a pure IIFE module that centralizes encode/decode mode logic for later UI and apply-path wiring.

### Public API

| Export | Behavior |
|--------|----------|
| `STORAGE_KEY` | `'transform-encode-decode-mode'` |
| `normalizeMode(value)` | Returns `'decode'` only when value (case-insensitive) is `'decode'`; otherwise `'encode'` |
| `loadMode(storage)` | Reads from storage via `STORAGE_KEY`; defaults to `'encode'` on missing/invalid/error |
| `saveMode(storage, mode)` | Persists normalized mode; silently ignores quota/errors |
| `resolveAction(transform, mode)` | `'encode'` for null transform or encode mode; `'reverse'` for mechanically reversible transforms in decode mode; `'ai_decode'` otherwise |
| `describeForAiDecode(transform, chainsApi)` | Human-readable label for AI decode prompts; delegates to `chainsApi.describeRecipe` for chains/cycles when available |

### Wiring

- **`index.template.html`**: Added `<script src="js/core/transformApplyMode.js"></script>` immediately before `transformRecipeStages.js`.
- **`package.json`**: Added `test:apply-mode` script; appended to `test:all`.

## TDD Evidence

### RED (Step 2)

```
node tests/test_transform_apply_mode.js
→ ENOENT: no such file or directory, open '...\js\core\transformApplyMode.js'
```

Test file existed; implementation did not. Failure mode matches brief expectation.

### GREEN (Step 4)

```
node tests/test_transform_apply_mode.js
→ test_transform_apply_mode: OK

npm run test:all
→ exit 0 (all suites including test:apply-mode passed)
```

## Tests + Results

| Command | Result |
|---------|--------|
| `node tests/test_transform_apply_mode.js` | PASS — `test_transform_apply_mode: OK` |
| `npm run test:all` | PASS — exit 0 |

### Coverage in `test_transform_apply_mode.js`

- `TransformApplyMode` global exists
- `normalizeMode`: decode, ENCODE, invalid → encode
- `loadMode` / `saveMode` round-trip via mock storage
- `resolveAction`: encode mode, reversible decode → reverse, irreversible decode → ai_decode, null transform → encode
- `describeForAiDecode`: includes transform name

## Files Changed

| File | Action |
|------|--------|
| `js/core/transformApplyMode.js` | Created |
| `tests/test_transform_apply_mode.js` | Created |
| `package.json` | Modified (`test:apply-mode`, `test:all`) |
| `index.template.html` | Modified (script tag) |

## Commit

```
009047f feat: add transform encode/decode mode helper
```

## Self-Review

- Implementation matches brief verbatim — no scope creep.
- Pure module: no DOM, no network, no side effects beyond optional storage I/O.
- `isMechanicallyReversible` correctly requires `reverse` function and `canDecode !== false`.
- `resolveAction(null, 'decode')` returns `'encode'` per spec (null guard before mode check).
- Chain/cycle branches in `describeForAiDecode` are present for later tasks but untested here (brief only asserts simple transform case).
- Script load order: `transformApplyMode.js` before recipe/chains scripts as required.
- Did not commit unrelated changes (`.gitignore`, SDD docs).

## Concerns

None. Module is ready for Task 2+ UI and apply-path integration.
