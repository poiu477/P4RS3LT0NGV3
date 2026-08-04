# Staged Transform Recipes — Design Spec

**Date:** 2026-08-04  
**Status:** Approved for planning  
**Branch context:** `feat/transform-chains`  
**Supersedes (product direction):** free-form-first Transform Chains as the default UX  
**Does not delete:** existing free-form chains/cycles (retained as Advanced / Legacy)

## Problem

The current Chains builder allows stacking any transform in any order. Most combinations are domain-nonsense (lossy → cipher, Base64 inside per-word cycles, stego → styling). Users think in **stages** of an obfuscation recipe (e.g. translate → cipher → encode → symbology → QR), not an unrestricted transform bag.

## Goals

1. Make **obfuscation recipes** the primary job of this feature.
2. Allow **creative steps** (Translate, Present/symbology, style) only as typed stages inside that recipe.
3. Default builder uses a **fixed stage rail**; templates are shortcuts that fill stages.
4. Keep **free-form** as an Advanced/Legacy escape hatch, clearly marked for possible future removal.
5. Cycles: **word-safe allowlist now**; optional **one-way / AI-decode** mode; opaque-token model later.
6. Support **terminal carriers**: QR and Emoji-tab steganography as an Output stage.

## Non-goals (this redesign)

- Opaque-token cycle execution (Future work B).
- Moving emoji stego / QR into `window.transforms` as mid-pipeline nodes.
- A new top-level app tab for recipes.
- Forced wipe of existing `transform-chains-v1` / `transform-cycles-v1` data.
- Redesigning Random Mix (reference only for allowlist / splitter behavior).

## Product decisions (locked)

| Topic | Decision |
|-------|----------|
| Primary purpose | Obfuscation recipes (A); creative steps allowed as stages within A |
| Builder strictness | Typed stages (Approach 1) |
| Templates | Shortcuts that pre-fill stages (not a separate system) |
| AI Translate | Optional advanced stage; badge “AI / not mechanically reversible” |
| Cycles now | Word-safe allowlist (A) + checkbox for one-way / AI-decode (D) |
| Cycles later | Opaque tokens (B) |
| Free-form | Advanced toggle; mark legacy in code for possible removal |
| Carriers | Final optional stage: QR or Emoji stego |
| UI chrome | Original staged design (stage rail + template chips); reuse existing buttons/badges/panel patterns |

---

## Stage model

Default rail (left → right / top → bottom):

```text
Normalize? → Translate? → Obfuscate(≥1) → Present? → Conceal? → Carrier?
```

| Stage | Required? | Contents | Notes |
|-------|-----------|----------|--------|
| **Normalize** | optional | Small allowlist of case/format cleanup that stays Latin text | Empty omitted from storage |
| **Translate** | optional | First-class AI node `{ type: "translate", lang, model }` | Not a normal transform key; uses existing AIProvider / Translate prompts |
| **Obfuscate** | **≥1 node** for valid staged recipe | Ciphers + encodings (Caesar, ROT*, Base64, Hex, Morse, …) | Multiple nodes; user-ordered within stage |
| **Present** | optional | Unicode styles + symbol alphabets + custom spelling transforms | “→ symbology” slot; multiple nodes allowed |
| **Conceal** | optional | In-text concealment transforms from the transform catalog | Not emoji-tab stego / QR |
| **Carrier** | optional | `{ type: "qr" \| "emoji_stego", options }` | **Terminal only**; calls Codes QR / `steganography.js` |

### Stage rules

- Fixed stage order in the staged builder (cannot drag Present before Translate).
- Empty optional stages are omitted from persisted recipes.
- Staged builder pickers are **filtered by stage allowlist** (category/folder + explicit lists).
- Free-form / legacy builder ignores stage order and allowlists (current behavior).

### Templates (examples)

Templates only fill stages; user may edit within stage rules afterward.

- Cipher → Base64 → Obfuscate: Caesar + Base64  
- Translate → Theban → Translate + Present: Theban  
- Cipher → Base64 → QR → Obfuscate + Carrier: QR  

Exact template catalog is an implementation detail; start with a small curated set.

---

## UI / UX

**Location:** Transform tab → existing collapsible Chains section (no new tab).

**Manager**

- Primary CTA: **New recipe** (opens staged builder).
- Keep **New per-word cycle**, Export / Import, list rows, badges, AI-decode drawer.
- Quiet control: **Free-form (legacy)** — opens today’s any-transform builder; copy states it may be removed later.

**Staged builder**

- Template chips above the rail.
- Stage rail (horizontal on wide viewports; stack on narrow if needed).
- Empty optional stages: dashed “+ Add …” affordance.
- Click stage → filtered picker (reuse transform search styling, scoped).
- Obfuscate / Present: multi-node + reorder within stage.
- Step preview: intermediate text; Carrier=QR shows inline QR preview; Carrier=emoji_stego shows carrier text.
- Badges: reuse `chain-badge` styles — `Reversible` | `AI-decode` | `Carrier`.

**Cycles**

- Built from saved recipes/chains.
- Checkbox: **One-way / AI-decode** (mode D). Default off → word-safe only (mode A).

**Design-system note**

Reuse existing `btn-secondary`, chain list rows, builder panel, badges. Do not introduce a separate marketing/dashboard aesthetic.

---

## Data model

### Staged recipe (`kind: "staged"`)

Prefer new storage key or schema version, e.g. `transform-recipes-v2`, while keeping v1 keys for legacy:

```json
{
  "id": "…",
  "name": "…",
  "kind": "staged",
  "stages": {
    "normalize": null,
    "translate": { "type": "translate", "lang": "la", "model": "…" },
    "obfuscate": [
      { "transform": "caesar", "options": { "shift": 3 } },
      { "transform": "base64", "options": {} }
    ],
    "present": [{ "transform": "theban", "options": {} }],
    "conceal": null,
    "carrier": { "type": "qr", "options": {} }
  },
  "createdAt": 0,
  "updatedAt": 0
}
```

- Transform `Node` = `{ transform, options }` (options snapshotted at add time, as today).
- `translate` and `carrier` are **typed stage nodes**, not `window.transforms` keys.

### Free-form / legacy

- Existing `{ id, name, nodes: Node[] }` records remain valid (`kind: "freeform"` or inferred from v1 shape).
- Cycles continue to store `chainIds` (or recipe ids) plus new field:

```json
{ "mode": "word_safe" | "one_way" }
```

Default for new cycles: `word_safe`. Missing field on old records: treat as `word_safe` and re-validate on edit/save.

### Registration

- Staged recipes register on `window.transforms` under category `chains` (rename to `recipes` is optional later; not required for v1 of this redesign).
- Keys remain stable (`chain_<id>` / recipe id prefix as implemented).
- Rematch active selection by `transformKey`, not display name.

---

## Architecture

| Concern | Location |
|---------|----------|
| Stage allowlists, validation, run staged pipeline, carrier adapters | `js/core/transformChains.js` and/or new `js/core/transformRecipes.js` if file size warrants a split |
| Free-form CRUD/execution | Keep in core; mark `@legacy` / `LEGACY_FREEFORM_*` |
| UI manager + staged + legacy builders | `js/tools/TransformTool.js` + `templates/transforms.html` |
| Minimal CSS for stage rail | `css/style.css` (extend existing chain-* classes) |
| QR carrier | Existing Codes / QR generation path |
| Emoji carrier | `js/core/steganography.js` |
| AI Translate stage | Existing AIProvider + Translate prompt patterns |
| Universal decoder | Continue excluding recipes from blind auto-guess unless explicitly selected |
| Tests | Extend `tests/test_transform_chains.js` or add `tests/test_transform_recipes.js`; wire into `test:all` |

### Execution order

1. Run Normalize nodes (if any)  
2. Run Translate (if any) — async when AI  
3. Run Obfuscate nodes in order  
4. Run Present nodes in order  
5. Run Conceal nodes in order  
6. Apply Carrier (if any) — may change output type (image vs text)

### Decode

- **Mechanical reverse** when: no Translate; no Carrier (or carrier extracted to plaintext first); every transform node has usable `reverse` / `canDecode !== false`; for cycles, `mode === "word_safe"` and round-trip probe passes.
- Otherwise: badge AI-decode / Carrier; use existing AI decode recipe description, extended for stage + carrier hints.
- Do **not** strip Base64 padding or other payload punctuation to “fix” word split — that corrupts encodings.

### Cycle modes

| Mode | Allowlist | Mechanical reverse |
|------|-----------|--------------------|
| `word_safe` | Transforms (and recipes) whose per-word output stays compatible with `[a-zA-Z0-9]` word splitting **or** proven by round-trip probe | Yes when probe passes |
| `one_way` | Wider allowlist (Random Mix–like); explicit user opt-in | No — AI-decode only |

Shared splitter with Random Mix: word chars `[a-zA-Z0-9]`; separators preserved. Random Mix is one-way by design; cycles must not pretend otherwise in `one_way` mode.

---

## Error handling

- Staged save: reject empty Obfuscate; reject nodes outside stage allowlist; reject incomplete Carrier options.
- Translate: may save without a live key; **run** fails with a clear “configure AI provider” message.
- Cycle `word_safe`: reject unsafe members; message names the offending transform/recipe.
- Cycle `one_way`: allow wider set; force non-reversible registration (`reverse: null`, AI badge).
- Storage failures: continue `getLastMutationError` / no success toast on failure.
- Missing transform at runtime: skip + warn (current behavior).
- Carrier failure: surface error; do not claim success.

---

## Testing

- Stage validation (required Obfuscate, allowlist enforcement, terminal Carrier).
- Execution order of stages.
- Translate / Carrier units mocked (no live network / no DOM QR dependency in Node tests beyond stubs).
- Cycle `word_safe` rejects Base64-like footguns; `one_way` accepts with no mechanical reverse.
- Legacy free-form load/save/run still works.
- Import/export round-trip for both shapes.
- `npm run test:all` includes the new/extended suite.

---

## Migration & legacy

1. Do not wipe v1 storage.
2. Default **new** creations use staged builder.
3. Free-form available via Advanced/Legacy toggle.
4. Export/import supports staged + free-form (+ cycles with `mode`).
5. Mark free-form UI and code paths for future removal (`@legacy`, `LEGACY_FREEFORM_BUILDER`).
6. Document that free-form may be scaffolding for edge cases until staged allowlists prove complete.

---

## Future work (explicitly deferred)

### B — Opaque-token cycles

Stop re-splitting cycle output by character class. Treat each transformed word as an opaque token (delimiters or parallel structure) so encodings that emit `=` / punctuation can round-trip. Implement only after staged recipes + word_safe/one_way ship and prove stable.

### Possible later cleanups

- Remove free-form builder once staged cover is trusted.
- Rename category `chains` → `recipes`.
- Curate Random Mix allowlist to drop non-word-safe entries (separate from this spec).

---

## Success criteria

1. User can build Translate → Obfuscate → Present → Carrier (QR or emoji stego) without seeing irrelevant transforms in each picker.
2. Senseless mid-pipeline stacks are structurally hard in the default builder.
3. Templates produce valid staged recipes in one click.
4. Cycles default to word-safe; one-way is an explicit checkbox.
5. Legacy free-form still available but clearly secondary.
6. Tests cover validation, stage order, cycle modes, and legacy compatibility.
7. Build + `test:all` pass; interactive browser checklist completed on a real Pages or local `dist/` serve.

## Implementation follow-up

After this spec is reviewed unchanged (or amended), create an implementation plan via `writing-plans` and execute on a dedicated branch/worktree as appropriate.
