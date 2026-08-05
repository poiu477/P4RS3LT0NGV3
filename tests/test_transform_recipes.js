#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function createContext() {
    const store = Object.create(null);
    const ctx = {
        window: null,
        console,
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            _store: store
        }
    };
    ctx.window = ctx;
    return ctx;
}

function load(ctx, rel) {
    const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
}

const ctx = createContext();
vm.createContext(ctx);
ctx.transforms = {
    caesar: { name: 'Caesar', category: 'cipher', canDecode: true },
    base64: { name: 'Base64', category: 'encoding', canDecode: true },
    theban: { name: 'Theban', category: 'symbol', canDecode: true },
    bold: { name: 'Bold', category: 'unicode', canDecode: true },
    zero_width: { name: 'Zero-Width', category: 'concealment', canDecode: true },
    title_case: { name: 'Title Case', category: 'case', canDecode: true }
};
load(ctx, 'js/core/transformRecipeStages.js');
const S = ctx.TransformRecipeStages;
assert.ok(S, 'TransformRecipeStages global');

assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'caesar', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('obfuscate', 'theban', ctx.transforms), false);
assert.strictEqual(S.isTransformAllowedInStage('present', 'theban', ctx.transforms), true);
assert.strictEqual(S.isTransformAllowedInStage('normalize', 'title_case', ctx.transforms), true);

assert.strictEqual(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: { obfuscate: [], present: null, translate: null, normalize: null, conceal: null, carrier: null }
}, ctx.transforms), 'Add at least two steps (any stages).');

assert.strictEqual(S.validateStagedRecipe({
    name: 'Only one',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null, translate: null, normalize: null, conceal: null, carrier: null
    }
}, ctx.transforms), 'Add at least two steps (any stages).');

assert.strictEqual(S.validateStagedRecipe({
    name: 'Translate + symbol',
    kind: 'staged',
    stages: {
        obfuscate: null,
        present: [{ transform: 'theban', options: {} }],
        translate: { type: 'translate', lang: 'la', model: '' },
        normalize: null, conceal: null, carrier: null
    }
}, ctx.transforms), null);

assert.ok(String(S.validateStagedRecipe({
    name: 'x',
    kind: 'staged',
    stages: {
        obfuscate: [
            { transform: 'theban', options: {} },
            { transform: 'caesar', options: { shift: 3 } }
        ],
        present: null, translate: null, normalize: null, conceal: null, carrier: null
    }
}, ctx.transforms)).indexOf('not allowed') !== -1, 'theban not allowed in obfuscate');

assert.strictEqual(S.validateStagedRecipe({
    name: 'Good',
    kind: 'staged',
    stages: {
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        translate: null, normalize: null, conceal: null,
        carrier: { type: 'qr', options: {} }
    }
}, ctx.transforms), null);

const flat = S.flattenStagedToNodes({
    stages: {
        translate: { type: 'translate', lang: 'la', model: 'm' },
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null, normalize: null, conceal: null,
        carrier: { type: 'emoji_stego', options: { carrier: '😀' } }
    }
});
assert.strictEqual(flat[0].type, 'translate');
assert.strictEqual(flat[1].transform, 'caesar');
assert.strictEqual(flat[flat.length - 1].type, 'emoji_stego');

load(ctx, 'js/core/transformChains.js');
const TC = ctx.TransformChains;

const rid = TC.saveRecipe({
    name: 'Staged Demo',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: [{ transform: 'theban', options: {} }],
        conceal: null,
        carrier: null
    }
});
assert.ok(rid);
const loaded = TC.loadChains().filter(c => c.id === rid)[0];
assert.strictEqual(loaded.kind, 'staged');
assert.strictEqual(loaded.stages.obfuscate[0].transform, 'caesar');

const persisted = JSON.parse(ctx.localStorage._store['transform-chains-v1']);
persisted.push({
    id: 'legacy-demo',
    name: 'Legacy Demo',
    nodes: [{ transform: 'base64', options: {} }]
});
ctx.localStorage.setItem('transform-chains-v1', JSON.stringify(persisted));
const legacy = TC.loadChains().filter(c => c.id === 'legacy-demo')[0];
assert.strictEqual(legacy.kind, 'freeform');
assert.deepStrictEqual(Array.from(TC.loadRecipes(), c => c.id), [rid]);
assert.ok(ctx.transforms[`chain_${rid}`], 'staged recipe registered as a transform');
assert.match(ctx.transforms[`chain_${rid}`].description, /Caesar \[caesar\].*Theban \[theban\]/);

assert.strictEqual(TC.saveRecipe({
    name: 'Bad',
    kind: 'staged',
    stages: {
        obfuscate: [
            { transform: 'theban', options: {} },
            { transform: 'caesar', options: { shift: 3 } }
        ],
        present: null,
        translate: null,
        normalize: null,
        conceal: null,
        carrier: null
    }
}), null);

ctx.transforms.caesar.func = (t, o) => {
    const shift = (o && o.shift) || 3;
    return t.replace(/[a-zA-Z]/g, (ch) => {
        const base = ch <= 'Z' ? 65 : 97;
        return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
    });
};
ctx.transforms.base64.func = (t) => Buffer.from(t, 'utf8').toString('base64');

const syncId = TC.saveRecipe({
    name: 'Caesar Base64',
    kind: 'staged',
    stages: {
        normalize: null,
        translate: null,
        obfuscate: [
            { transform: 'caesar', options: { shift: 3 } },
            { transform: 'base64', options: {} }
        ],
        present: null,
        conceal: null,
        carrier: null
    }
});
const syncRecipe = TC.loadChains().filter(c => c.id === syncId)[0];
const syncInput = 'Hello';
const caesarOut = ctx.transforms.caesar.func(syncInput, { shift: 3 });
const syncExpected = ctx.transforms.base64.func(caesarOut);
assert.strictEqual(TC.runStagedRecipeSync(syncRecipe, syncInput), syncExpected);
assert.strictEqual(ctx.transforms[`chain_${syncId}`].func(syncInput), syncExpected);

const translateCalls = [];
ctx.AIProvider = {
    chatCompletion: (messages, opts) => {
        translateCalls.push({ messages, opts });
        return Promise.resolve({
            choices: [{ message: { content: '[LA]' + messages[messages.length - 1].content.split('\n\n').pop() } }]
        });
    }
};

const asyncRecipe = {
    kind: 'staged',
    stages: {
        normalize: null,
        translate: { type: 'translate', lang: 'la', model: 'test::translate' },
        obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
        present: null,
        conceal: null,
        carrier: null
    }
};

TC.runStagedRecipeAsync(asyncRecipe, 'Hello').then((result) => {
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(result)),
        { kind: 'text', value: '[OD]Khoor' },
        'translation runs before Caesar and returns a typed result'
    );
    assert.strictEqual(translateCalls.length, 1);
    assert.strictEqual(translateCalls[0].opts.model, 'test::translate');
    assert.strictEqual(Array.isArray(translateCalls[0].messages), true);
    assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
        /English \(en\) to Latin \(la\) translator/);
    assert.match(translateCalls[0].messages[translateCalls[0].messages.length - 1].content,
        /Please translate the following English text into Latin:\n\nHello$/);
    const qrCalls = [];
    ctx.QRCode = {
        toDataURL: (text, options) => {
            qrCalls.push({ text, options });
            return Promise.resolve('data:image/png;base64,mocked');
        }
    };
    return TC.applyCarrier({
        type: 'qr',
        options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
    }, 'secret').then((qrResult) => {
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(qrResult)),
            { kind: 'image', value: 'data:image/png;base64,mocked' }
        );
        assert.deepStrictEqual(
            JSON.parse(JSON.stringify(qrCalls)),
            [{
                text: 'secret',
                options: { width: 512, margin: 4, errorCorrectionLevel: 'H' }
            }]
        );

        const emojiCalls = [];
        ctx.steganography = {
            encodeEmoji: (emoji, text) => {
                emojiCalls.push({ emoji, text });
                return emoji + ':' + text;
            }
        };
        return TC.applyCarrier({
            type: 'emoji_stego',
            options: { carrier: '😀' }
        }, 'hidden').then((emojiResult) => {
            assert.deepStrictEqual(
                JSON.parse(JSON.stringify(emojiResult)),
                { kind: 'text', value: '😀:hidden' }
            );
            assert.deepStrictEqual(
                JSON.parse(JSON.stringify(emojiCalls)),
                [{ emoji: '😀', text: 'hidden' }]
            );

            const qrRecipe = {
                kind: 'staged',
                stages: {
                    normalize: null,
                    translate: null,
                    obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
                    present: null,
                    conceal: null,
                    carrier: { type: 'qr', options: {} }
                }
            };
            return TC.runStagedRecipeAsync(qrRecipe, 'Hello').then((result) => ({
                result,
                qrCalls
            }));
        });
    });
}).then(({ result, qrCalls }) => {
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(result)),
        { kind: 'image', value: 'data:image/png;base64,mocked' },
        'runner applies the carrier after text transforms'
    );
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(qrCalls[1])),
        {
            text: 'Khoor',
            options: { width: 256, margin: 2, errorCorrectionLevel: 'M' }
        },
        'QR receives transformed text and CodesTool defaults'
    );
    console.log('test_transform_recipes: OK');
}).catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
