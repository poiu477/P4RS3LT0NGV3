# Task 2 Report: Carrier results include underlying text

## Status

DONE

## What Was Implemented

Extended `applyCarrier` QR success path to return the underlying transformed text alongside the data URL image payload.

### Interface change

| Carrier | Before | After |
|---------|--------|-------|
| QR | `{ kind: 'image', value: dataUrl }` | `{ kind: 'image', value: dataUrl, text: String(text) }` |
| emoji_stego | `{ kind: 'text', value }` | unchanged |

The `text` field carries the string passed into `applyCarrier` — i.e. the post-transform payload encoded into the QR, not the original user input.

### Code change

In `js/core/transformChains.js` `applyCarrier`, QR `.then`:

```javascript
.then(function(dataUrl) {
    return { kind: 'image', value: dataUrl, text: String(text) };
});
```

## TDD Evidence

### RED (Step 2)

```
node tests/test_transform_recipes.js
→ AssertionError: Expected values to be strictly equal: undefined !== 'aGk='
```

New QR Demo recipe test asserted `result.text === 'aGk='` (base64 of `"hi"`) before implementation existed.

### GREEN (Step 4)

```
node tests/test_transform_recipes.js
→ test_transform_recipes: OK
```

## Tests + Results

| Command | Result |
|---------|--------|
| `node tests/test_transform_recipes.js` | PASS — `test_transform_recipes: OK` |

### Coverage added/updated in `test_transform_recipes.js`

- **New QR Demo recipe**: base64 obfuscate → QR carrier; asserts `kind`, `value` prefix, and `text === 'aGk='`
- **Updated `applyCarrier` direct test**: expects `text: 'secret'`
- **Updated staged QR runner test**: expects `text: 'Khoor'` (Caesar-shifted input before QR)

Stubbed `ctx.QRCode.toDataURL` per brief; existing `ctx.transforms.base64.func` already present in harness.

## Files Changed

| File | Action |
|------|--------|
| `js/core/transformChains.js` | Modified (`applyCarrier` QR return shape) |
| `tests/test_transform_recipes.js` | Modified (QR text assertions) |

## Commit

```
715fa06 feat: include underlying text with QR carrier results
```

## Self-Review

- Implementation matches brief verbatim — single-line return shape change only.
- Emoji stego carrier unchanged as required.
- `String(text)` coercion matches spec; handles non-string inputs safely.
- Existing QR tests updated to expect new field — no silent regression on prior assertions.
- QR Demo test integrated into existing async chain (file was not sync-only).
- Did not commit unrelated changes (`.gitignore`, SDD docs).

## Concerns

None. QR carrier results now expose underlying text for downstream encode/decode UI (Task 3+).
