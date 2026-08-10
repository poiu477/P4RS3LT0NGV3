### Task 4: Prune favorites when transforms disappear

**Files:**
- Modify: `js/tools/TransformTool.js`

**Interfaces:**
- Produces: `pruneFavoritesForMissingTransforms()` method on Vue
- Called from: `refreshCustomSpellingTransforms` and/or after successful chain/cycle delete/save rename paths

- [ ] **Step 1: Implement prune**

Favorites for normal transforms are plain name strings. After rebuild:

```javascript
pruneFavoritesForMissingTransforms: function() {
    if (!Array.isArray(this.favorites) || !this.favorites.length) return;
    const names = {};
    (this.transforms || []).forEach(function(t) {
        if (t && t.name) names[t.name] = true;
    });
    const next = this.favorites.filter(function(f) {
        if (typeof f === 'string') return !!names[f];
        return true; // keep translate favorites objects
    });
    if (next.length !== this.favorites.length) {
        this.favorites = next;
        this.showFavorites = next.length > 0;
        this.saveFavorites(next);
    }
},
```

Call at end of `refreshCustomSpellingTransforms` after rematch.

- [ ] **Step 2: Commit**

```bash
git add js/tools/TransformTool.js
git commit -m "fix: drop orphan transform favorites after list refresh"
```

---

