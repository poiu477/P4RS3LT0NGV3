# Encode/Decode Final-Fix Re-review

**Range:** `fa59b7a9a65259518dca407dd3941a466c019807..31044e535ea97e3a875bcb461d45d9c7e52fe04f`  
**Verdict:** **Approved — merge-ready aside from the optional browser smoke test.**

## Critical closure

1. **AI decode implicit-call gate — Closed.**
   - `applyActiveTransformOutput` returns before provider checks or `TransformChains.aiDecode` when the resolved action is `ai_decode` and neither `allowAiDecode` nor `copyOnSuccess` was explicitly passed.
   - The typing handler, `transformInput` watcher, options-save refresh, and transform-list refresh all call without those flags.
   - Only `applyTransform` opts in; direct tile clicks and the deliberate mode-change re-apply flow through that method.

2. **Recipe/cycle AI decode metadata — Closed.**
   - `buildTransformsFromWindow` now carries `isChain`, `isCycle`, `chainId`, `cycleId`, `description`, and `canDecode` onto the Vue-facing transform.
   - This supplies the exact fields used by `resolveAction` and `describeForAiDecode`, allowing chains and cycles to reach `TransformChains.describeRecipe` instead of the display-name fallback.
   - Added tests cover chain and cycle helper branches and integration with real recipe descriptions.

3. **Translate/carrier reversibility and descriptions — Closed.**
   - `chainIsReversible` rejects staged recipes containing Translate or Carrier.
   - Registration consequently exposes `canDecode: false` and no mechanical `reverse`, routing Decode to AI.
   - `describeChain` now walks all staged nodes and describes Translate, QR, and emoji-steganography carrier stages, preserving those details in AI decode hints.
   - Tests cover a reversible baseline plus Translate and QR one-way recipes.

## Findings

- **New Critical:** None.
- **New Important:** None.
- **Non-blocking coverage note:** the AI gate is verified by static call-site tracing rather than a direct caller-level test that asserts zero provider calls from typing/watcher/options/refresh paths. The implementation is straightforward and all current call sites are correctly gated, so this does not block merge.

## Verification

- Confirmed current HEAD: `31044e535ea97e3a875bcb461d45d9c7e52fe04f`.
- `node tests/test_transform_apply_mode.js` — pass.
- `node tests/test_transform_recipes.js` — pass.
- IDE diagnostics for the changed source and test files — no errors.

## Merge readiness

**Yes.** All three requested Critical findings are closed, with no new Critical or Important issue found. The encode/decode feature is merge-ready, aside from the optional browser smoke test for visual and interaction confirmation.
