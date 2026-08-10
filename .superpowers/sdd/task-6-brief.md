### Task 6: Chain decode model selection + node option prefs + export/import/copy

**Files:**
- Modify: `js/tools/TransformTool.js`
- Modify: `templates/transforms.html`
- Modify: `css/style.css` (only if new buttons need layout)

**Interfaces:**
- `localStorage['chain-decode-model']` already read by `TransformChains.aiDecode`
- Node add should seed options from `getMergedOptionsForTransform(t.name)` when possible

- [ ] **Step 1: Seed node options from current prefs**

In `chainAddNode`:

```javascript
chainAddNode: function(key) {
    const t = window.transforms[key];
    if (!t) return;
    const options = {};
    const prefs = typeof this.getMergedOptionsForTransform === 'function'
        ? this.getMergedOptionsForTransform(t.name)
        : {};
    (t.configurableOptions || []).forEach(opt => {
        options[opt.id] = (prefs && prefs[opt.id] != null) ? prefs[opt.id] : opt.default;
    });
    this.chainDraftNodes.push({ transform: key, options });
    this.chainNodePickerQuery = '';
},
```

- [ ] **Step 2: Decode-model select on AI decode panel**

In Vue data, add `chainDecodeModel: localStorage.getItem('chain-decode-model') || localStorage.getItem('translate-model') || ''`.

In `chainRunAiDecode`, pass `model: this.chainDecodeModel` and persist:

```javascript
if (this.chainDecodeModel) {
    localStorage.setItem('chain-decode-model', this.chainDecodeModel);
}
```

In `templates/transforms.html` AI-decode boxes, reuse `<openrouter-model-select v-model="chainDecodeModel" label="Decode model">` (or the same component already used elsewhere).

- [ ] **Step 3: Copy recipe key**

```javascript
chainCopyRecipe: function(entity, kind) {
    const recipe = window.TransformChains.describeRecipe(entity, kind);
    this.copyToClipboard(recipe);
    this.showNotification('Recipe copied', 'success', 'fas fa-copy');
},
```

Add a small “Copy recipe” button on each chain/cycle card in the manager.

- [ ] **Step 4: Export / import JSON**

```javascript
chainExportAll: function() {
    const payload = {
        version: 1,
        chains: window.TransformChains.loadChains(),
        cycles: window.TransformChains.loadCycles()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'p4rs3ltongv3-chains.json';
    a.click();
    URL.revokeObjectURL(url);
},
chainImportAll: function(file) {
    const reader = new FileReader();
    const self = this;
    reader.onload = function() {
        try {
            const data = JSON.parse(reader.result);
            (data.chains || []).forEach(function(c) {
                window.TransformChains.saveChain({
                    id: c.id,
                    name: c.name,
                    nodes: c.nodes
                });
            });
            (data.cycles || []).forEach(function(cy) {
                window.TransformChains.saveCycle({
                    id: cy.id,
                    name: cy.name,
                    chainIds: cy.chainIds
                });
            });
            self.refreshChainsTransforms();
            self.showNotification('Chains imported', 'success', 'fas fa-file-import');
        } catch (e) {
            self.showNotification('Import failed: ' + (e.message || 'invalid file'), 'error');
        }
    };
    reader.readAsText(file);
},
```

UI: Export button + hidden file input for Import in the Chains manager header.

- [ ] **Step 5: Commit**

```bash
git add js/tools/TransformTool.js templates/transforms.html css/style.css
git commit -m "feat: chain decode model, prefs-seeded nodes, export/import and copy recipe"
```

---

