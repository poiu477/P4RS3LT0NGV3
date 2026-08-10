### Task 4: Translate stage (async)

**Files:**
- Modify: `js/core/transformChains.js`
- Modify: `tests/test_transform_recipes.js` (mock `AIProvider.chatCompletion`)

**Interfaces:**
- Produces: `runStagedRecipeAsync(recipe, text, opts) → Promise<string>`
- Translate node uses same prompt pattern as `TranslateTool.translateBuildPrompt` (extract shared helper **or** duplicate minimal prompt string in core to avoid Vue dependency — prefer small shared `js/utils/translatePrompt.js` only if needed; otherwise inline TranslateGemma-style user prompt in core).

```javascript
function runTranslateNode(node, text) {
    if (!global.AIProvider || typeof global.AIProvider.chatCompletion !== 'function') {
        return Promise.reject(new Error('Configure an AI provider in Settings.'));
    }
    var model = node.model || global.localStorage.getItem('translate-model') || '';
    var lang = node.lang;
    var prompt = 'Please translate the following English text into ' + lang + ':\n\n' + text;
    return global.AIProvider.chatCompletion({
        model: model,
        messages: [{ role: 'user', content: prompt }]
    }).then(function(res) {
        // mirror AIProvider response shape used elsewhere
        return (res && res.content) || (res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
    });
}
```

Inspect actual `AIProvider.chatCompletion` return shape in `js/utils/aiProvider.js` and match it exactly in the plan implementation (do not guess in code — read file during task).

- [ ] **Step 1: Test with mock provider** — translate node prepends `[LA]` in mock; assert async pipeline order translate then caesar.

- [ ] **Step 2: Implement async runner that walks flatten order**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: async Translate stage for staged recipes"
```

---

