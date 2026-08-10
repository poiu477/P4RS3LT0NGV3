# Task 4 Report: Translate stage (async)

## Status

DONE

## Implementation

- Added `runStagedRecipeAsync(recipe, text, opts)` to walk `flattenStagedToNodes` output in canonical order.
- Transform-backed nodes delegate to the existing synchronous `runChainNodes` runner.
- Translate nodes call `AIProvider.chatCompletion(messages, opts)` using the TranslateTool prompt pattern.
- Translation responses are read from the provider's normalized `choices[0].message.content` shape.
- Stage model selection prefers `node.model`, then `opts.model`, then the saved `translate-model`.

## TDD Evidence

- RED: `node tests/test_transform_recipes.js` failed because `runStagedRecipeAsync` did not exist.
- GREEN: mocked translation prepends `[LA]`; subsequent Caesar transforms it to `[OD]`, proving translate-before-obfuscate ordering.
- `node tests/test_transform_recipes.js` passed.
- `npm test -- --runInBand` passed.
- `npm run test:all` passed.
- Changed-file linter diagnostics and `git diff --check` passed.

## Commit

- `fa89511 feat: async Translate stage for staged recipes`

## Concerns

None blocking. Carrier nodes remain pass-through pending the dedicated carrier task.

## Important Review Fix

- Resolved staged `lang` values through the same name/code mapping as TranslateTool.
- Documented language codes as the persisted staged-recipe schema while accepting known display names.
- Added coverage for the built-in template value `lang: 'la'`, asserting a `Latin (la)` prompt.
- RED reproduced `la (la)` in the prompt; GREEN passed `npm run test:recipes`.
- Commit: `4b891e0 fix: align staged Translate lang with TranslateTool mapping`
