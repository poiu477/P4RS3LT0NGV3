### Task 3: Encode/Decode switch UI + Output under Input

**Files:**
- Modify: `js/tools/TransformTool.js` (data: `transformIoMode`, init from `TransformApplyMode.loadMode`)
- Modify: `templates/transforms.html` (switch + move output block)
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `TransformApplyMode.loadMode` / `saveMode` / `normalizeMode`
- Produces: Vue state `transformIoMode: 'encode'|'decode'`; method `setTransformIoMode(mode)`

- [ ] **Step 1: Add state + setter in TransformTool data/methods**

In the tool’s `data()` (or equivalent initial state object), add:

```javascript
transformIoMode: (window.TransformApplyMode
    ? window.TransformApplyMode.loadMode(localStorage)
    : 'encode'),
transformOutputText: '', // optional alias — see Step 3 if keeping transformOutput
```

Add methods:

```javascript
setTransformIoMode: function(mode) {
    if (!window.TransformApplyMode) return;
    const next = window.TransformApplyMode.normalizeMode(mode);
    if (next === this.transformIoMode) return;
    this.transformIoMode = next;
    window.TransformApplyMode.saveMode(localStorage, next);
    if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
        this.applyTransform(this.activeTransform);
    }
},
```

(Mode flip uses full `applyTransform` so clipboard updates on intentional mode change with active selection.)

- [ ] **Step 2: Template — switch above input; Output directly under input**

Near the top of `templates/transforms.html`, inside `.input-section` (or wrapping it), add:

```html
<div class="transform-io-mode" role="group" aria-label="Encode or decode">
    <button
        type="button"
        class="transform-io-mode-btn"
        :class="{ active: transformIoMode === 'encode' }"
        @click="setTransformIoMode('encode')"
    >Encode</button>
    <button
        type="button"
        class="transform-io-mode-btn"
        :class="{ active: transformIoMode === 'decode' }"
        @click="setTransformIoMode('decode')"
    >Decode</button>
</div>
```

Update input placeholders:

```html
:placeholder="transformIoMode === 'decode' ? 'Enter text to decode...' : 'Enter text to transform...'"
```

**Move** the existing `.output-section` block (currently below the transform button grid) to sit **immediately under** the input control(s), still inside the left column / `.transform-layout` flow before filters/buttons.

Output section should show:

- Textarea bound to text output when present
- Image when `transformOutputKind === 'image'`
- **Both** when image + text: show image and the text textarea (`v-if` text when `transformOutput` text non-empty OR dedicated `transformOutputText`)

Suggested binding after Task 4 wiring:

```html
<div class="output-section" v-if="transformOutput || transformOutputKind === 'image'">
  <div class="output-heading">
    <h4>
      <i class="fas fa-check-circle"></i>
      {{ transformIoMode === 'decode' ? 'Decoded' : 'Transformed' }} Message
      <small v-if="activeTransform">({{ activeTransform.name }})</small>
    </h4>
  </div>
  <div class="output-container">
    <img v-if="transformOutputKind === 'image' && transformOutputImage" :src="transformOutputImage" class="transform-image-output" alt="" />
    <textarea v-if="transformOutput" readonly v-model="transformOutput" aria-label="Transform output text"></textarea>
    <button v-if="transformOutput" class="copy-button" @click="copyToClipboard(transformOutput)" title="Copy to clipboard">
      <i class="fas fa-copy"></i>
    </button>
  </div>
</div>
```

Until Task 4 lands image split fields, keep current `transformOutput`/`transformOutputKind` behavior but **relocate** the markup.

- [ ] **Step 3: CSS for mode switch**

Add minimal styles reusing existing button tokens:

```css
.transform-io-mode {
    display: inline-flex;
    margin-bottom: 0.5rem;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    overflow: hidden;
}
.transform-io-mode-btn {
    border: 0;
    background: transparent;
    color: var(--text-color);
    padding: 0.4rem 0.9rem;
    cursor: pointer;
}
.transform-io-mode-btn.active {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
    font-weight: 600;
}
.transform-layout .input-section + .output-section {
    margin-top: 0.75rem;
}
```

- [ ] **Step 4: Build templates and smoke-check**

Run: `npm run build:templates`  
Expected: success

Manually open Transforms tab: switch visible above input; output block under input (may be empty until a transform runs).

- [ ] **Step 5: Commit**

```bash
git add js/tools/TransformTool.js templates/transforms.html css/style.css
git commit -m "$(cat <<'EOF'
feat: add Encode/Decode switch and move output under input

EOF
)"
```

---

