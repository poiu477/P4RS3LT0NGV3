# Task 7 Report: TransformChains Unit Tests

## Status

Complete. Added VM-based unit coverage for `TransformChains`, registered `test:chains`, and included it in `test:all`.

## Commit

- `5d157c7` — `test: add TransformChains unit coverage`
- Commit contains only `tests/test_transform_chains.js` and `package.json`.

## TDD Evidence

### RED

Before creating the test file:

```text
> node tests/test_transform_chains.js
Error: Cannot find module '...\tests\test_transform_chains.js'
code: 'MODULE_NOT_FOUND'
Exit code: 1
```

This established that the requested automated coverage did not yet exist.

### GREEN

After adding the test file:

```text
> node tests/test_transform_chains.js
test_transform_chains: OK
Exit code: 0
```

Package script:

```text
> npm run test:chains
test_transform_chains: OK
Exit code: 0
```

Full regression suite:

```text
> npm run test:all
Universal: 548 passed, 0 failed, 96 skipped (reported total: 569)
Steganography: 91 passed, 0 failed
Lexeme analysis: passed
Lexeme UI surface: passed
TransformChains: OK
Exit code: 0
```

## Coverage

- VM context and localStorage mock
- Persisted null-node sanitization
- Nested saved-chain rejection
- Recipe descriptions including node options
- Empty-cycle rejection and valid-cycle persistence
- Atomic rollback when the second `deleteChain` storage write fails
- `test:chains` integration with `test:all`

## Self-Review

- `git diff --cached --check` passed before commit.
- IDE diagnostics reported no errors in the changed files.
- The commit was verified to contain only the two files required by the brief.

## Concern

The brief's literal null-node fixture passed `null` to `saveChain`, but current validation intentionally rejects malformed nodes before writing. The test saves a valid chain, injects a legacy persisted null, then verifies `loadChains()` sanitizes it. This preserves the specified load-sanitization case without changing production behavior. Expected warning output is emitted for the rejection and write-failure paths under test.

## Review Follow-up

Strengthened persistence and rollback assertions after review:

- Commit: `f37aefb` — `test: strengthen TransformChains assertions for persistence and rollback`
- Null sanitization now verifies surviving transform order and options.
- Rejected nested-chain saves verify the persisted chain list is unchanged.
- Rejected empty-cycle saves verify the persisted cycle list is unchanged.
- Valid cycle persistence verifies its exact ID, name, and chain IDs.
- Rollback verifies the injected failure fired, all three write attempts occurred in order (including the compensating chain write), both storage keys remain, and raw plus loaded state is restored.
- Removed the unused quota-blocking mock and dead toggle calls.

Verification:

```text
> npm run test:chains
> node tests/test_transform_chains.js

saveChain rejected: Chains cannot nest other saved chains or cycles.
saveCycle rejected: Add at least one chain to the cycle.
Failed to save transform-cycles-v1: Error: fail cycle write
test_transform_chains: OK
Exit code: 0
```

## Raw Storage Review Follow-up

The nested-chain and empty-cycle rejection cases now snapshot their relevant raw `localStorage` strings before the rejected operation and assert byte-for-byte equality afterward. The existing sanitized `loadChains()` and `loadCycles()` unchanged assertions remain.

- Commit: `bb04cee` — `test: assert raw localStorage unchanged on chain rejection`

Verification:

```text
> npm run test:chains
> node tests/test_transform_chains.js

saveChain rejected: Chains cannot nest other saved chains or cycles.
saveCycle rejected: Add at least one chain to the cycle.
Failed to save transform-cycles-v1: Error: fail cycle write
test_transform_chains: OK
Exit code: 0
```
