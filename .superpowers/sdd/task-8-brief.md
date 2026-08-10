### Task 8: Documentation (README, CONTRIBUTING, architecture)

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/TOOL_ARCHITECTURE.md`

- [ ] **Step 1: README — add under Tools / Transform**

Add a short subsection after the Transform bullets:

```markdown
### Chains & Cycles (on the Transform tab)

- **Chain** — an ordered pipeline of transforms applied to the whole input; each node snapshots its own options (e.g. Caesar shift 3 then shift 7).
- **Cycle** — rotate a list of chains across words (word 1 → chain A, word 2 → chain B, wrap).
- Saved entities appear under the **chains** category like ordinary transforms (search, favorites, click-to-apply).
- Nested chains/cycles are not allowed.
- If a recipe cannot mechanically reverse, use **AI decode** in the Chains manager (uses your configured AI providers).
- Export/import JSON from the Chains manager; copy the human-readable recipe for sharing.
```

Fix any remaining heading-anchor links only if still wrong (`#-getting-started`, `#-ai-providers--api-keys`).

- [ ] **Step 2: CONTRIBUTING — structure tree**

Under `js/core/`, add:

```text
│   │   ├── transformChains.js # Saved transform chains & per-word cycles
```

Mention in Core vs Tools that chains are core logic registered into `window.transforms`, with UI on TransformTool.

- [ ] **Step 3: TOOL_ARCHITECTURE — short note**

Add a subsection:

```markdown
## Transform chains & cycles

- Module: `js/core/transformChains.js` (`window.TransformChains`)
- Storage: `localStorage` keys `transform-chains-v1`, `transform-cycles-v1`
- Registration: `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`
- No nesting of saved chains/cycles inside chain nodes
- Mechanical reverse when every node (and cycle probe) allows it; otherwise AI recipe decode via `aiDecode`
- UI: Transform tab Chains manager (`templates/transforms.html`, methods on `TransformTool`)
```

- [ ] **Step 4: Commit**

```bash
git add README.md CONTRIBUTING.md docs/TOOL_ARCHITECTURE.md
git commit -m "docs: document transform chains and cycles"
```

---

