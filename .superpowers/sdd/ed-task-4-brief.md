### Task 4: Apply path — encode / reverse / AI decode + clipboard

**Files:**
- Modify: `js/tools/TransformTool.js` (`applyActiveTransformOutput`, `applyTransform`, remove/demote empty-input recipe-only messaging)

**Interfaces:**
- Consumes: `TransformApplyMode.resolveAction`, `describeForAiDecode`, `TransformChains.aiDecode`, `transform.reverse`, staged async encode
- Produces: filled `transformOutput` (text), optional `transformOutputImage`, clipboard via `forceCopyToClipboard` on click/mode-flip apply only

- [ ] **Step 1: Extend output state fields**

Add to tool state:

```javascript
transformOutputImage: '',
```

When applying results:

```javascript
// text always in transformOutput when available
// images in transformOutputImage; transformOutputKind 'image' | 'text'
```

- [ ] **Step 2: Rewrite `applyActiveTransformOutput` action switch**

Core logic (integrate into existing generation/stale guards):

```javascript
applyActiveTransformOutput: async function(options) {
    const generation = ++this.transformApplyGeneration;
    const transform = this.activeTransform;
    const input = this.transformInput;
    const preserveEmojis = !!(options && options.preserveEmojis);
    const copyOnSuccess = !!(options && options.copyOnSuccess);

    if (!transform || !input || this.activeTab !== 'transforms') {
        this.transformOutputKind = 'text';
        this.transformOutput = '';
        this.transformOutputImage = '';
        return { applied: false };
    }

    const opts = this.getMergedOptionsForTransform(transform.name);
    const stagedRecipe = this.stagedRecipeForTransform(transform);
    const action = window.TransformApplyMode
        ? window.TransformApplyMode.resolveAction(transform, this.transformIoMode)
        : 'encode';

    try {
        let result = { kind: 'text', value: '' };

        if (action === 'ai_decode') {
            if (!window.AIProvider || typeof window.AIProvider.getConfiguredProviders !== 'function'
                || !window.AIProvider.getConfiguredProviders().length) {
                throw new Error('Configure an AI provider in Settings to decode this transform.');
            }
            const recipe = window.TransformApplyMode.describeForAiDecode(transform, window.TransformChains);
            const text = await window.TransformChains.aiDecode(recipe, input, {
                model: this.chainDecodeModel || localStorage.getItem('chain-decode-model') || ''
            });
            result = { kind: 'text', value: text };
        } else if (action === 'reverse') {
            if (typeof transform.reverse !== 'function') {
                throw new Error('No reverse function available.');
            }
            result = { kind: 'text', value: String(transform.reverse(input, opts) || '') };
        } else if (this.stagedRecipeNeedsAsync(stagedRecipe)) {
            result = await window.TransformChains.runStagedRecipeAsync(stagedRecipe, input, opts);
        } else if (preserveEmojis) {
            // existing emoji-preserving encode path using transform.func
            const segments = window.EmojiUtils.splitEmojis(input);
            const value = window.EmojiUtils.joinEmojis(segments.map(segment => {
                if (segment.length > 1 || /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u.test(segment)) {
                    return segment;
                }
                return transform.func(segment, opts);
            }));
            result = { kind: 'text', value };
        } else {
            result = { kind: 'text', value: transform.func(input, opts) };
        }

        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
            return { applied: false, stale: true };
        }

        if (result && result.kind === 'image') {
            this.transformOutputKind = 'image';
            this.transformOutputImage = result.value != null ? String(result.value) : '';
            this.transformOutput = result.text != null ? String(result.text) : '';
        } else {
            this.transformOutputKind = 'text';
            this.transformOutputImage = '';
            this.transformOutput = result && result.value != null ? String(result.value) : '';
        }

        if (copyOnSuccess && this.transformOutput) {
            this.isTransformCopy = true;
            this.forceCopyToClipboard(this.transformOutput);
        }

        return { applied: true, kind: this.transformOutputKind };
    } catch (e) {
        if (generation !== this.transformApplyGeneration || this.activeTransform !== transform) {
            return { applied: false, stale: true };
        }
        this.transformOutputKind = 'text';
        this.transformOutput = '';
        this.transformOutputImage = '';
        this.showNotification(
            (e && e.message) ? e.message : (transform.name + ' failed.'),
            'error',
            'fas fa-exclamation-triangle'
        );
        return { applied: false, error: e };
    }
},
```

- [ ] **Step 3: Update `applyTransform` to always use shared path**

```javascript
applyTransform: async function(transform, event) {
    event && event.preventDefault();
    event && event.stopPropagation();
    if (transform && transform.name === 'Random Mix') {
        this.triggerRandomizerChaos();
    }
    if (!transform) return;

    this.activeTransform = transform;

    if (!this.transformInput) {
        this.showNotification('Enter text in the input box, then click the transform again.', 'info', 'fas fa-keyboard');
        const inputBox = document.querySelector('#transform-input');
        if (inputBox) this.focusWithoutScroll(inputBox);
        return;
    }

    this.saveLastUsedTransform(transform.name);
    const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
    if (!outcome.applied) return;

    // Keep existing Random Mix / success toast behavior for non-AI failures already handled
    if (transform.name !== 'Random Mix') {
        const message = this.transformOutputKind === 'image' && !this.transformOutput
            ? transform.name + ' image preview ready!'
            : transform.name + (this.transformIoMode === 'decode' ? ' decoded and copied!' : ' applied and copied!');
        this.showNotification(message, 'success', 'fas fa-check');
    }

    // existing focus / active-button cleanup
},
```

Ensure `autoTransform` calls `applyActiveTransformOutput({ preserveEmojis: true })` **without** `copyOnSuccess`.

- [ ] **Step 4: Demote manager Apply**

In `templates/transforms.html` recipe list actions: remove the prominent Apply button **or** keep a quiet icon that calls `applySavedChain` → `applyTransform` (same path). Prefer remove to avoid two primary verbs.

Update leftover copy that says “use Apply on the list”.

- [ ] **Step 5: Manual verification checklist + commit**

Verify locally after `npm run build:templates`:

1. Encode + Caesar click → Output under input + Copy History entry  
2. Decode + Caesar click on cipher text → plaintext in Output + history  
3. Decode + irreversible recipe with AI configured → AI result in Output + history  
4. Decode + irreversible without AI → Settings toast  
5. Typing with active transform updates Output only (no history flood)

```bash
git add js/tools/TransformTool.js templates/transforms.html
git commit -m "$(cat <<'EOF'
feat: apply transforms in Encode/Decode mode with shared output path

EOF
)"
```

---

