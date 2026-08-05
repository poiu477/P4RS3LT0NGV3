# Encode/Decode Mode + Transform Output Destinations

**Date:** 2026-08-04  
**Status:** Approved for planning  
**Scope:** Transforms tab — global Encode/Decode mode, unified click behavior for transforms and recipes, Output field under Input, clipboard/Copy History

## Problem

Recipes feel different from other transform methods: users expect clicking a recipe tile to run against the top input and produce a visible result. “Right output” in product language means **Copy History** (clipboard-driven), while long results also need an on-page **Output** field near the input. Decode today is split across mechanical `reverse` and a separate AI-decode panel for irreversible chains.

## Goals

1. One global **Encode | Decode** control near the top input drives every transform/recipe click.
2. Clicking a transform **or** saved recipe tile behaves the same: run in current mode → show result → copy text to clipboard (Copy History).
3. An **Output** field sits directly under the Input for reading long results (especially decoded text).
4. Decode + non-reversible methods auto-run the existing AI decode path into those same destinations.

## Non-goals

- Redesigning Copy History UI or tabs.
- Changing stage-rail recipe builder validation (min two steps, etc.).
- Removing AI-decode power tools from the Recipes manager entirely (they may remain as secondary tools).
- Building a separate Decoder tab workflow.

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Mode control | Global segmented **Encode \| Decode** near input (Approach 1) |
| Default | Encode |
| Persistence | `localStorage` |
| Irreversible in Decode | **B** — auto AI decode into Output + clipboard |
| Primary destinations | Output under Input **and** clipboard → Copy History |
| Text results | Always shown in Output (not clipboard-only) |
| Image carriers (e.g. QR) | Preview in Output; if underlying text exists, show that text in Output too and copy the text |
| Recipes | Same click path as other transforms; manager Apply demoted/removed |

## UI layout

```
[ Encode | Decode ]
[ Input ……………………………… ]
[ Output …………………………… ]   ← under input; readonly + copy control
[ search / category filters … ]
[ Recipes & chains manager … ]
[ transform / recipe buttons … ]
```

- Placeholder reflects mode: transform vs decode.
- Existing output block that currently sits below the button grid moves up under Input (or is replaced by this field so there is a single Output).

## Click behavior

1. User enters text in Input (optional first).
2. User clicks any transform or recipe button.
3. App sets `activeTransform` and runs according to mode (see below).
4. **Text** result → Output field + clipboard (`forceCopyToClipboard` / equivalent) → Copy History entry labeled with the transform/recipe name.
5. Empty Input → select the method, focus Input; do not treat as a hard error.

Recipes must appear and work as category tiles (existing `chains` registration). Manager list keeps Edit / Delete / Copy recipe; separate Apply is redundant for the primary path.

## Mode semantics

### Encode

- Call `func` / staged async encode (`runStagedRecipeAsync` when needed).
- Result → Output + clipboard when text.

### Decode + mechanically reversible (`canDecode` / `reverse`)

- Call `reverse` (chains/cycles use existing reverse path).
- Result → Output + clipboard.

### Decode + not reversible

- Run existing AI-assisted decode (same provider/model prefs as chain AI decode, e.g. `chain-decode-model` / Settings).
- Result → Output + clipboard.
- If AI is not configured: toast pointing to Settings; leave Output empty; do not silently fail.

### Mode flip

- When Encode ↔ Decode changes and a transform is already selected with non-empty Input, re-run immediately in the new mode.

### Live typing

- Existing `@input` auto-transform continues and respects the current Encode/Decode mode.

## Carriers / non-text

- QR (and similar image outputs): show image preview in Output.
- If an underlying text payload exists, also show that text in Output and copy the text to clipboard.
- If there is no sensible text payload: show image only; toast that clipboard was skipped (optional, keep short).

## Recipes manager

- Remains the place to create/edit/delete recipes and cycles.
- Primary “run” path is the recipe tile among transforms, not a manager-only Apply.
- Optional: keep a small Apply affordance that calls the same shared apply path (must not be the only way to run).

## Persistence & copy labeling

- Mode key: e.g. `transform-encode-decode-mode` → `encode` | `decode`.
- Copy History should continue to attribute the entry to the active transform/recipe name (Encode vs Decode may be reflected in label if easy; not required for v1).

## Success criteria

- [ ] Encode/Decode switch visible next to/above Input and persists across reload.
- [ ] Clicking Base64 (or similar) and a saved recipe both fill Output under Input and create a Copy History entry when the result is text.
- [ ] Decode + reversible recipe/transform reverses into Output + clipboard.
- [ ] Decode + irreversible recipe triggers AI decode into Output + clipboard when AI is configured.
- [ ] Decode without AI configured surfaces a clear Settings toast.
- [ ] Long decoded text is readable in the under-input Output without opening Copy History.

## Out of scope / later

- Filtering or dimming irreversible tiles while in Decode.
- Per-tile Encode/Decode dual buttons.
- Changing upstream Pages deploy branch policy (manual workflow_dispatch on feature branch remains operational concern).
