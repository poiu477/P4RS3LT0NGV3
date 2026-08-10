# Task 3 Report: Run staged pipeline (sync transform nodes)

## Status

DONE

## Implementation

- Added `getStagedTransformNodes(recipe)` — flattens staged recipe via `TransformRecipeStages.flattenStagedToNodes`, keeps nodes with a string `transform` (skips Translate/Carrier stage nodes).
- Added `runStagedRecipeSync(recipe, text)` — runs filtered nodes through existing `runChainNodes`.
- Refactored `getRunnableChainNodes` to delegate staged recipes to `getStagedTransformNodes`.
- Wired `registerChain` so staged recipes use `runStagedRecipeSync` for `func` and `preview`; free-form chains unchanged.
- Exported `runStagedRecipeSync` on `TransformChains`.

## Verification

- `node tests/test_transform_recipes.js` — passed (`test_transform_recipes: OK`).
- `npm run test:recipes` — passed.
- `node --check js/core/transformChains.js` — passed.
- New test: staged caesar→base64 recipe with real shift + base64 funcs; `runStagedRecipeSync` and registered `func` both match expected base64 of caesar output.

## Commit

- `1e8bd96 feat: run sync stages for staged recipes` (only `js/core/transformChains.js`, `tests/test_transform_recipes.js` staged)

## Concerns

None blocking. Translate and Carrier stages remain skipped in sync path until Tasks 4–5 async runner.
