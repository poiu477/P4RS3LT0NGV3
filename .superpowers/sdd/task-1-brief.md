### Task 1: Remap `activeTransform` after transform-list refresh

**Files:**
- Modify: `js/tools/TransformTool.js` (`refreshCustomSpellingTransforms`, ~1006–1027; optionally `refreshChainsTransforms`)

**Interfaces:**
- Consumes: `this.activeTransform.transformKey` (already set when mapping from `window.transforms` in `buildTransformsFromWindow`)
- Produces: After rebuild, `activeTransform` is either the same logical transform with fresh `func`/`preview`/`reverse`, or `null` if deleted

- [ ] **Step 1: Confirm `transformKey` is present on Vue transform objects**

In `buildTransformsFromWindow`, the mapped object already includes `transformKey: key`. Verify with a quick read; do not change the shape unless missing.

- [ ] **Step 2: After assigning `this.transforms`, rematch active**

Replace the end of `refreshCustomSpellingTransforms` so it rematches:

```javascript
refreshCustomSpellingTransforms: function() {
    const transformTool = window.toolRegistry && window.toolRegistry.get('transforms');
    if (!transformTool || typeof transformTool.buildTransformsFromWindow !== 'function') {
        return;
    }

    const previousCustomCount = (this.transforms || []).filter(function(t) {
        return t.category === 'custom_spelling';
    }).length;

    const previousKey = this.activeTransform && this.activeTransform.transformKey
        ? this.activeTransform.transformKey
        : null;

    this.transforms = transformTool.buildTransformsFromWindow();
    const categories = transformTool.rebuildTransformCategories(this.transforms);
    this.legendCategories = categories.legendCategories;
    this.categories = categories.sectionCategories;

    const nextCustomCount = this.transforms.filter(function(t) {
        return t.category === 'custom_spelling';
    }).length;
    if (nextCustomCount !== previousCustomCount) {
        this.saveCategoryOrder(this.categories);
    }

    if (!previousKey) {
        this.activeTransform = null;
    } else {
        const match = this.transforms.find(function(t) {
            return t.transformKey === previousKey;
        });
        this.activeTransform = match || null;
        if (match && this.transformInput && this.activeTab === 'transforms') {
            const opts = this.getMergedOptionsForTransform(match.name);
            this.transformOutput = match.func(this.transformInput, opts);
        } else if (!match) {
            this.transformOutput = '';
        }
    }
},
```

- [ ] **Step 3: Manual check**

Build, open Transform tab, apply a saved chain, edit/delete it from the Chains manager, confirm output clears or updates and no stale function runs.

- [ ] **Step 4: Commit**

```bash
git add js/tools/TransformTool.js
git commit -m "fix: rematch activeTransform after transform list refresh"
```

---

