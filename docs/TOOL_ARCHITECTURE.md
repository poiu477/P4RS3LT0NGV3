# Tool Architecture

## Overview

The Tool system provides a way to organize features into modular, self-contained units. Each tool has:
- Vue data properties
- Vue methods
- Tab button configuration
- Tab content (template)

## Important Limitation: Vue Template Compilation

**Critical**: Tab content that uses Vue directives (`v-if`, `v-for`, `v-model`, `{{ }}`) **MUST** be defined in `index.html`, not in the Tool's `getTabContentHTML()` method.

### Why?

Vue's `v-html` directive (used for dynamic content insertion) has a fundamental limitation:
- It inserts **raw HTML only**
- It does **NOT** compile Vue templates
- Vue directives and interpolations are treated as literal text

This is by design for security and performance reasons.

### What Works vs What Doesn't

✅ **Works in `getTabContentHTML()`:**
```javascript
getTabContentHTML() {
    return `
        <div class="static-content">
            <h1>Hello World</h1>
            <button onclick="doSomething()">Click</button>
        </div>
    `;
}
```

❌ **Doesn't Work in `getTabContentHTML()`:**
```javascript
getTabContentHTML() {
    return `
        <div v-if="activeTab === 'mytool'">
            <input v-model="myData" />
            <p>{{ myData }}</p>
        </div>
    `;
}
```

## Architecture Pattern

### For Simple Tools (Static HTML)

1. Define content in Tool's `getTabContentHTML()`
2. Use plain HTML with inline event handlers
3. No Vue directives needed

Example: A simple documentation viewer

### For Complex Tools (Vue Templates)

1. Define content in `index.html`
2. Use full Vue template syntax
3. Tool provides only data and methods
4. `getTabContentHTML()` returns empty string

Example: Transform Tool, Decoder Tool, Emoji Tool

## Current Implementation

### Tools with Index.html Templates
- ✅ Transform Tool - Complex category system
- ✅ Decoder Tool - Dynamic alternatives list  
- ✅ Emoji Tool - Interactive emoji grid
- ✅ Tokenade Tool - Complex nested options
- ✅ Mutation Tool - Multiple fuzzing options
- ✅ Tokenizer Tool - Dynamic token display

### Tools with Dynamic Content
- ✅ Splitter Tool - Self-contained in SplitterTool.js

## Transform recipes, legacy chains & cycles

The Transform tab keeps recipe composition in the existing Chains manager; it does not add another tool tab.

### Staged recipe model

- Taxonomy: `js/core/transformRecipeStages.js` (`window.TransformRecipeStages`)
- Runtime and persistence: `js/core/transformChains.js` (`window.TransformChains`)
- Schema: `{ kind: 'staged', stages: { normalize, translate, obfuscate, present, conceal, carrier } }`
- Fixed execution rail: **Normalize → Translate → Obfuscate → Present → Conceal → Carrier**
- `obfuscate` is a required array with at least one node. Normalize, Present, and Conceal are optional transform arrays; Translate and Carrier are optional typed singleton nodes.
- Stage transform pickers and validation use category allowlists plus explicit allow/deny keys. Saved chains and cycles cannot be nested as stage nodes.
- `TransformRecipeStages.TEMPLATES` supplies editable builder presets. Templates only prefill ordinary staged records; they do not introduce another persisted kind or runner.

Transform-backed stages run synchronously in rail order. A Translate node uses the configured AI provider/model asynchronously. A terminal Carrier node runs last and returns either text (`emoji_stego`) or an image data URL (`qr`); the Transform tool renders QR results as an image preview.

### Persistence and registration

- Storage remains at `localStorage` keys `transform-chains-v1` and `transform-cycles-v1`; upgrades do not wipe either v1 key.
- Staged recipes and free-form chains share `transform-chains-v1`. Staged records keep `kind: 'staged'` and `stages`; old node-list records are normalized to `kind: 'freeform'`.
- The unrestricted **Free-form (legacy)** builder and `saveChain` path remain available behind explicit `LEGACY_FREEFORM_*` / `@legacy` markers for compatibility and possible later removal.
- Registration uses `chain_<id>` / `cycle_<id>` on `window.transforms`, category `chains`.
- Mechanical reverse is available only when every relevant node supports it; otherwise the manager offers AI recipe decode through `aiDecode`.
- UI: `templates/transforms.html`, with builder and apply/preview methods on `TransformTool`.

### Encode / Decode apply mode

- Mode helpers: `js/core/transformApplyMode.js` (`window.TransformApplyMode`); persisted in `localStorage` key `transform-encode-decode-mode` (default `encode`).
- UI: segmented **Encode | Decode** switch above the input in `templates/transforms.html`; Output field sits directly under Input.
- Click path: registered transforms and saved recipes/cycles share `TransformTool.applyTransform` → `applyActiveTransformOutput({ copyOnSuccess: true })`. `TransformApplyMode.resolveAction` picks `encode`, mechanical `reverse`, or `ai_decode` (irreversible decode → `TransformChains.aiDecode` with `describeForAiDecode`).
- Destinations: text always in Output; image carriers (e.g. QR) preview in Output with underlying text when present; explicit apply/click also copies text to clipboard (Copy History). Live `@input` auto-transform updates Output only (no clipboard).
- Manager **Apply** on recipe list is demoted; chains run like other transform tiles via the shared click path.

### Cycle modes

- `word_safe` is the default, including for records saved before cycle modes existed. Validation rejects recipes that are unsafe per word, including Base64-like transforms and staged Translate or Carrier nodes, and registration keeps mechanical reverse only after its round-trip probe succeeds.
- `one_way` permits those recipes, but registers the cycle with `canDecode: false` and no mechanical `reverse`; the UI marks it for AI decode.
- **Future B (documented only):** opaque-token cycles could preserve word boundaries around arbitrary recipe output. No opaque-token schema, execution path, or UI exists today.

## Adding a New Tool

### Step 1: Create Tool Class

```javascript
// js/tools/MyTool.js
class MyTool extends Tool {
    constructor() {
        super({
            id: 'mytool',
            name: 'My Tool',
            icon: 'fa-star',
            title: 'My awesome tool',
            order: 10
        });
    }
    
    getVueData() {
        return {
            myInput: '',
            myOutput: ''
        };
    }
    
    getVueMethods() {
        return {
            processData: function() {
                this.myOutput = this.myInput.toUpperCase();
            }
        };
    }
    
    getTabContentHTML() {
        // If you need Vue directives, return empty and use index.html
        return '';
    }
}
```

### Step 2: Add Content to index.html

```html
<!-- My Tool Tab -->
<div v-if="activeTab === 'mytool'" class="tab-content">
    <div class="transform-layout">
        <input v-model="myInput" placeholder="Enter text..." />
        <button @click="processData">Process</button>
        <div>{{ myOutput }}</div>
    </div>
</div>
```

### Step 3: Register Tool

```javascript
// js/tools/index.js
if (typeof MyTool !== 'undefined') {
    window.toolRegistry.register(new MyTool());
}
```

### Step 4: Add Script Tag

```html
<!-- index.html -->
<script src="js/tools/MyTool.js"></script>
```

## Future Improvements

To enable fully dynamic tools with Vue templates, we would need to:

1. **Use Vue Components** - Convert each tool to a proper Vue component
2. **Dynamic Component Loading** - Use `<component :is="currentTool">`
3. **Component Registration** - Register components instead of raw HTML

This would require a significant refactor but would provide:
- Fully modular tools
- No index.html modifications for new tools
- Better encapsulation
- Proper Vue template compilation

## Summary

**Current Pattern:**
- Tool provides: data, methods, lifecycle hooks
- Index.html provides: template (for Vue directives)
- Tool registry: merges data/methods, handles activation

**This works because:**
- Vue compiles templates in index.html at app initialization
- Data and methods are merged into the Vue instance
- Templates can reference the merged data/methods

**Keep in mind:**
- v-html is not a replacement for Vue components
- Complex interactive UIs need proper Vue templates
- Static content can be fully dynamic
- The current hybrid approach is a practical compromise

