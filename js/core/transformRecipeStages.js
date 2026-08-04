(function(global) {
    'use strict';

    var STAGE_ORDER = ['normalize', 'translate', 'obfuscate', 'present', 'conceal', 'carrier'];

    // Categories / keys allowed per stage (extend carefully; prefer category buckets).
    var STAGE_TRANSFORM_CATEGORIES = {
        normalize: ['case', 'format'],
        obfuscate: ['cipher', 'encoding', 'technical'],
        present: ['symbol', 'unicode', 'visual', 'custom_spelling', 'signwriting'],
        conceal: ['concealment']
    };

    // Deny-list inside otherwise-allowed categories (lossy / unsuitable for recipes).
    var STAGE_DENY_KEYS = {
        normalize: { random_mix: true, shuffle_words: true },
        obfuscate: { random_mix: true },
        present: { random_mix: true },
        conceal: {}
    };

    // Extra allow keys even if category differs (empty initially).
    var STAGE_ALLOW_KEYS = {
        normalize: {},
        obfuscate: {},
        present: {},
        conceal: {}
    };

    // Staged recipes persist TranslateTool language codes; known display names remain accepted.
    var TRANSLATE_LANG_CODE_MAP = {
        'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Chinese': 'zh',
        'Japanese': 'ja', 'Korean': 'ko', 'Arabic': 'ar', 'Russian': 'ru',
        'Hindi': 'hi', 'Portuguese': 'pt', 'Italian': 'it', 'Dutch': 'nl',
        'Turkish': 'tr', 'Vietnamese': 'vi', 'Thai': 'th', 'Polish': 'pl',
        'Latin': 'la', 'Sanskrit': 'sa', 'Ancient Greek': 'grc',
        'Egyptian Arabic': 'arz', 'Old English': 'ang', 'Sumerian': 'sux',
        'Akkadian': 'akk', 'Hawaiian': 'haw', 'Welsh': 'cy', 'Swahili': 'sw',
        'Hebrew': 'he', 'Persian': 'fa', 'Tamil': 'ta', 'Esperanto': 'eo',
        'Irish': 'ga', 'Basque': 'eu', 'Navajo': 'nv', 'Quechua': 'qu',
        'Nahuatl': 'nah', 'Tagalog': 'tl', 'Maori': 'mi', 'Yoruba': 'yo',
        'Zulu': 'zu', 'Catalan': 'ca', 'Romanian': 'ro', 'Czech': 'cs',
        'Indonesian': 'id', 'Malay': 'ms', 'Bengali': 'bn', 'Urdu': 'ur'
    };

    function resolveTranslateLanguage(lang) {
        var raw = String(lang || '').trim();
        var names = Object.keys(TRANSLATE_LANG_CODE_MAP);
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var code = TRANSLATE_LANG_CODE_MAP[name];
            if (raw === name || raw.toLowerCase() === code.toLowerCase()) {
                return { name: name, code: code };
            }
        }
        return { name: raw, code: raw };
    }

    function isRecord(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    }

    function isTransformAllowedInStage(stageId, transformKey, transformsMap) {
        if (stageId === 'translate' || stageId === 'carrier') return false;
        if (typeof transformKey !== 'string' || !transformKey) return false;
        if (transformKey.indexOf('chain_') === 0 || transformKey.indexOf('cycle_') === 0) return false;
        var t = transformsMap && transformsMap[transformKey];
        if (!t) return false;
        if (STAGE_DENY_KEYS[stageId] && STAGE_DENY_KEYS[stageId][transformKey]) return false;
        if (STAGE_ALLOW_KEYS[stageId] && STAGE_ALLOW_KEYS[stageId][transformKey]) return true;
        var cats = STAGE_TRANSFORM_CATEGORIES[stageId] || [];
        var cat = t.category || '';
        return cats.indexOf(cat) !== -1;
    }

    function validateStagedRecipe(recipe, transformsMap) {
        if (!isRecord(recipe) || typeof recipe.name !== 'string' || !recipe.name.trim()) {
            return 'Name is required.';
        }
        var stages = recipe.stages;
        if (!isRecord(stages)) return 'Invalid stages.';
        var ob = stages.obfuscate;
        if (!Array.isArray(ob) || ob.length === 0) {
            return 'Add at least one obfuscate step.';
        }
        var i;
        for (i = 0; i < ob.length; i++) {
            if (!isTransformAllowedInStage('obfuscate', ob[i] && ob[i].transform, transformsMap)) {
                return 'Transform not allowed in Obfuscate: ' + ((ob[i] && ob[i].transform) || '?');
            }
        }
        var multi = ['normalize', 'present', 'conceal'];
        for (i = 0; i < multi.length; i++) {
            var sid = multi[i];
            var nodes = stages[sid];
            if (nodes == null) continue;
            if (!Array.isArray(nodes)) return 'Invalid ' + sid + ' stage.';
            for (var j = 0; j < nodes.length; j++) {
                if (!isTransformAllowedInStage(sid, nodes[j] && nodes[j].transform, transformsMap)) {
                    return 'Transform not allowed in ' + sid + ': ' + ((nodes[j] && nodes[j].transform) || '?');
                }
            }
        }
        if (stages.translate != null) {
            if (!isRecord(stages.translate) || stages.translate.type !== 'translate') {
                return 'Invalid translate stage.';
            }
            if (!stages.translate.lang) return 'Translate stage needs a language.';
        }
        if (stages.carrier != null) {
            if (!isRecord(stages.carrier)) return 'Invalid carrier stage.';
            if (stages.carrier.type !== 'qr' && stages.carrier.type !== 'emoji_stego') {
                return 'Carrier must be qr or emoji_stego.';
            }
        }
        return null;
    }

    function flattenStagedToNodes(recipe) {
        var stages = (recipe && recipe.stages) || {};
        var out = [];
        function pushNodes(arr) {
            if (!Array.isArray(arr)) return;
            for (var i = 0; i < arr.length; i++) out.push(arr[i]);
        }
        pushNodes(stages.normalize);
        if (stages.translate) out.push(stages.translate);
        pushNodes(stages.obfuscate);
        pushNodes(stages.present);
        pushNodes(stages.conceal);
        if (stages.carrier) out.push(stages.carrier);
        return out;
    }

    var TEMPLATES = [
        {
            id: 'cipher-base64',
            name: 'Cipher → Base64',
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
        },
        {
            id: 'translate-theban',
            name: 'Translate → Theban',
            stages: {
                normalize: null,
                translate: { type: 'translate', lang: 'la', model: '' },
                obfuscate: [{ transform: 'caesar', options: { shift: 3 } }],
                present: [{ transform: 'theban', options: {} }],
                conceal: null,
                carrier: null
            }
        },
        {
            id: 'cipher-qr',
            name: 'Cipher → Base64 → QR',
            stages: {
                normalize: null,
                translate: null,
                obfuscate: [
                    { transform: 'caesar', options: { shift: 3 } },
                    { transform: 'base64', options: {} }
                ],
                present: null,
                conceal: null,
                carrier: { type: 'qr', options: {} }
            }
        }
    ];

    global.TransformRecipeStages = {
        STAGE_ORDER: STAGE_ORDER,
        STAGE_TRANSFORM_CATEGORIES: STAGE_TRANSFORM_CATEGORIES,
        TRANSLATE_LANG_CODE_MAP: TRANSLATE_LANG_CODE_MAP,
        resolveTranslateLanguage: resolveTranslateLanguage,
        isTransformAllowedInStage: isTransformAllowedInStage,
        validateStagedRecipe: validateStagedRecipe,
        flattenStagedToNodes: flattenStagedToNodes,
        TEMPLATES: TEMPLATES
    };
})(typeof window !== 'undefined' ? window : this);
