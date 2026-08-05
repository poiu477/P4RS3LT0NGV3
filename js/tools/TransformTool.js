/**
 * Transform Tool - Text transformation tool
 */
class TransformTool extends Tool {
    constructor() {
        super({
            id: 'transforms',
            name: 'Transform',
            icon: 'fa-font',
            title: 'Transform text (T)',
            order: 1
        });
    }
    
    getVueData() {
        const transforms = this.buildTransformsFromWindow();
        
        const categorySet = new Set();
        transforms.forEach(transform => {
            if (transform.category) {
                categorySet.add(transform.category);
            }
        });
        
        // Legend categories: always alphabetical (for quick link buttons)
        const allCategories = Array.from(categorySet);
        const categoriesWithoutRandomizer = allCategories.filter(c => c !== 'randomizer');
        const legendCategories = [...categoriesWithoutRandomizer.sort((a, b) => a.localeCompare(b)), 'randomizer'];
        
        // Section categories: can be reordered (load saved order or use alphabetical)
        const savedOrder = this.loadCategoryOrder();
        const sectionCategories = savedOrder && savedOrder.length > 0
            ? this.mergeCategoryOrder(allCategories, savedOrder)
            : [...legendCategories]; // Create a copy so legendCategories remains immutable
        
        // Load last used transforms
        const lastUsed = this.loadLastUsed();
        
        // Load favorites
        const favorites = this.loadFavorites();
        
        return {
            transformInput: 'Hello World',
            transformLexemeAnalysis: { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' },
            transformOutput: '',
            transformOutputImage: '',
            transformOutputKind: 'text',
            transformIoMode: (window.TransformApplyMode
                ? window.TransformApplyMode.loadMode(localStorage)
                : 'encode'),
            transformApplyGeneration: 0,
            activeTransform: null,
            transforms: transforms,
            legendCategories: legendCategories, // Always alphabetical for legend
            categories: sectionCategories, // Custom order for sections
            lastUsedTransforms: lastUsed,
            showLastUsed: lastUsed.length > 0,
            favorites: favorites,
            showFavorites: favorites.length > 0,
            transformOptionPrefs: this.loadTransformOptionPrefs(),
            transformOptionsModalOpen: false,
            transformOptionsModalTransform: null,
            transformOptionsDraft: {},
            transformSearchQuery: '',
            transformCategoryFilter: '',

            // Chain / cycle builder
            chainManageOpen: false,
            chainBuilderOpen: false,
            chainBuilderKind: 'chain', // 'chain' | 'cycle'
            recipeBuilderMode: 'staged', // 'staged' | 'legacy'
            recipeTemplateId: '',
            stagedDraft: {
                name: '',
                stages: {
                    normalize: null,
                    translate: null,
                    obfuscate: [],
                    present: null,
                    conceal: null,
                    carrier: null
                }
            },
            stagedPickerStage: '',
            stagedPickerQuery: '',
            stagedOpenNodeOptions: null,
            chainBuilderEditId: null,
            chainBuilderError: '',
            chainDraftName: '',
            chainDraftNodes: [],
            chainNodePickerQuery: '',
            chainOpenNodeOptionsIndex: null,
            cycleDraftName: '',
            cycleDraftChainIds: [],
            cycleDraftMode: 'word_safe',
            chainDecodeOpenKey: '',
            chainDecodeInput: '',
            chainDecodeOutput: '',
            chainDecodeLoading: false,
            chainDecodeError: '',
            chainDecodeModel: localStorage.getItem('chain-decode-model') || localStorage.getItem('translate-model') || ''
        };
    }

    buildTransformsFromWindow() {
        if (typeof window !== 'undefined' && typeof window.syncCustomSpellingAlphabets === 'function') {
            window.syncCustomSpellingAlphabets();
        }

        // Chains reference other transforms, so they must register after the
        // built-ins (and after custom alphabets, which chains may include).
        if (typeof window !== 'undefined' && window.TransformChains) {
            window.TransformChains.syncTransforms();
        }

        if (!window.transforms || Object.keys(window.transforms).length === 0) {
            return [];
        }

        return Object.entries(window.transforms)
            .filter(([key, transform]) => {
                if (!transform || !transform.name || !transform.func) {
                    console.warn(`Transform "${key}" is missing required properties (name or func)`, transform);
                    return false;
                }
                return true;
            })
            .map(([key, transform]) => ({
                transformKey: key,
                customSpellingId: transform.customSpellingId || null,
                chainId: transform.chainId || null,
                name: transform.name,
                func: transform.func.bind(transform),
                preview: transform.preview ? transform.preview.bind(transform) : function() { return '[preview]'; },
                reverse: transform.reverse ? transform.reverse.bind(transform) : null,
                category: transform.category || 'special',
                configurableOptions: transform.configurableOptions || [],
                hasConfigurableOptions: Array.isArray(transform.configurableOptions) && transform.configurableOptions.length > 0,
                inputKind: transform.inputKind === 'text' ? 'text' : 'textarea'
            }));
    }

    rebuildTransformCategories(transforms) {
        const categorySet = new Set();
        transforms.forEach(transform => {
            if (transform.category) {
                categorySet.add(transform.category);
            }
        });

        const allCategories = Array.from(categorySet);
        const categoriesWithoutRandomizer = allCategories.filter(c => c !== 'randomizer');
        const legendCategories = [...categoriesWithoutRandomizer.sort((a, b) => a.localeCompare(b)), 'randomizer'];

        const savedOrder = this.loadCategoryOrder();
        const sectionCategories = savedOrder && savedOrder.length > 0
            ? this.mergeCategoryOrder(allCategories, savedOrder)
            : [...legendCategories];

        return { legendCategories, sectionCategories };
    }
    
    loadTransformOptionPrefs() {
        try {
            const raw = localStorage.getItem('transformOptionPrefs');
            if (raw) {
                const d = JSON.parse(raw);
                if (d && typeof d === 'object' && !Array.isArray(d)) {
                    return d;
                }
            }
        } catch (e) {
            console.warn('Failed to load transform option prefs:', e);
        }
        return {};
    }
    
    loadCategoryOrder() {
        try {
            const saved = localStorage.getItem('transformCategoryOrder');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load category order:', e);
        }
        return null;
    }
    
    mergeCategoryOrder(allCategories, savedOrder) {
        // Always ensure randomizer is last
        const categoriesWithoutRandomizer = allCategories.filter(c => c !== 'randomizer');
        
        if (!savedOrder || savedOrder.length === 0) {
            // Default: alphabetical, randomizer last
            const sorted = categoriesWithoutRandomizer.sort((a, b) => a.localeCompare(b));
            return [...sorted, 'randomizer'];
        }
        
        // Use saved order, but filter out categories that no longer exist and remove duplicates
        const validSavedOrder = savedOrder
            .filter(cat => allCategories.includes(cat))
            .filter((cat, index, arr) => arr.indexOf(cat) === index); // Remove duplicates
        
        // Find new categories not in saved order
        const newCategories = categoriesWithoutRandomizer.filter(cat => !validSavedOrder.includes(cat));
        
        // Build final order: saved order (filtered, deduplicated) + new categories (alphabetically) + randomizer
        const finalOrder = [...validSavedOrder];
        if (newCategories.length > 0) {
            finalOrder.push(...newCategories.sort((a, b) => a.localeCompare(b)));
        }
        
        // Ensure randomizer is always last and remove any duplicates
        const finalWithoutRandomizer = finalOrder.filter(c => c !== 'randomizer');
        const uniqueFinal = finalWithoutRandomizer.filter((cat, index, arr) => arr.indexOf(cat) === index);
        return [...uniqueFinal, 'randomizer'];
    }
    
    loadLastUsed() {
        try {
            const saved = localStorage.getItem('transformLastUsed');
            if (saved) {
                const data = JSON.parse(saved);
                if (!Array.isArray(data)) return [];
                return data
                    .filter(item => {
                        if (item && item.kind === 'translate') {
                            return typeof item.lang === 'string' && item.lang.length > 0;
                        }
                        if (item && item.name && window.transforms) {
                            return Object.values(window.transforms).some(t => t.name === item.name);
                        }
                        return false;
                    })
                    .slice(0, 5);
            }
        } catch (e) {
            console.warn('Failed to load last used transforms:', e);
        }
        return [];
    }
    
    saveLastUsed(transformName) {
        try {
            let lastUsed = this.loadLastUsed();
            
            // Remove if already exists
            lastUsed = lastUsed.filter(item => item.name !== transformName);
            
            // Add to front with timestamp
            lastUsed.unshift({
                name: transformName,
                timestamp: Date.now()
            });
            
            // Keep only last 10
            lastUsed = lastUsed.slice(0, 10);
            
            localStorage.setItem('transformLastUsed', JSON.stringify(lastUsed));
        } catch (e) {
            console.warn('Failed to save last used transform:', e);
        }
    }
    
    loadFavorites() {
        try {
            const saved = localStorage.getItem('transformFavorites');
            if (saved) {
                const data = JSON.parse(saved);
                if (!Array.isArray(data)) return [];
                if (!window.transforms) return [];
                return data.filter(entry => {
                    if (typeof entry === 'string') {
                        return Object.values(window.transforms).some(t => t.name === entry);
                    }
                    if (entry && entry.kind === 'translate' && typeof entry.lang === 'string') {
                        return entry.lang.length > 0;
                    }
                    return false;
                });
            }
        } catch (e) {
            console.warn('Failed to load favorites:', e);
        }
        return [];
    }
    
    saveFavorites(favorites) {
        try {
            localStorage.setItem('transformFavorites', JSON.stringify(favorites));
        } catch (e) {
            console.warn('Failed to save favorites:', e);
        }
    }
    
    getVueMethods() {
        return {
            getDisplayCategory: function(transformName) {
                // Find transform by name and return its category property
                const transform = this.transforms.find(t => t.name === transformName);
                return transform ? transform.category : 'special';
            },
            getTransformKey: function(transform) {
                if (!transform) {
                    return '';
                }
                return transform.customSpellingId || transform.transformKey || transform.name;
            },
            /**
             * True if this transform should show the options gear (uses saved prefs + defaults in decoder).
             * Falls back to window.transforms when the Vue copy omits configurableOptions.
             */
            transformHasOptionsUI: function(transform) {
                if (!transform || !transform.name) {
                    return false;
                }
                const list = transform.configurableOptions;
                if (Array.isArray(list) && list.length > 0) {
                    return true;
                }
                if (window.transforms) {
                    const full = Object.values(window.transforms).find(function(t) {
                        return t && t.name === transform.name;
                    });
                    return !!(full && full.configurableOptions && full.configurableOptions.length);
                }
                return false;
            },
            getMergedOptionsForTransform: function(transformName) {
                if (typeof window.getMergedTransformOptionsForName === 'function') {
                    return window.getMergedTransformOptionsForName(transformName, this.transforms);
                }
                return {};
            },

            // ---- Chains & cycles -------------------------------------------

            savedChains: function() {
                return window.TransformChains ? window.TransformChains.loadChains() : [];
            },
            savedCycles: function() {
                return window.TransformChains ? window.TransformChains.loadCycles() : [];
            },
            chainRegisteredEntry: function(chain) {
                return window.transforms && window.transforms[window.TransformChains.CHAIN_PREFIX + chain.id];
            },
            cycleRegisteredEntry: function(cycle) {
                return window.transforms && window.transforms[window.TransformChains.CYCLE_PREFIX + cycle.id];
            },
            chainIsReversibleNow: function(chain) {
                const entry = this.chainRegisteredEntry(chain);
                return !!(entry && entry.canDecode);
            },
            cycleIsReversibleNow: function(cycle) {
                const entry = this.cycleRegisteredEntry(cycle);
                return !!(entry && entry.canDecode);
            },
            cycleChainName: function(chainId) {
                const chain = this.savedChains().find(c => c.id === chainId);
                return chain ? chain.name : '(deleted chain)';
            },
            cycleRecipeIsWordSafe: function(chain) {
                return !!(window.TransformChains &&
                    typeof window.TransformChains.recipeIsWordSafe === 'function' &&
                    window.TransformChains.recipeIsWordSafe(chain));
            },
            cycleChainIsWordSafe: function(chainId) {
                return this.cycleRecipeIsWordSafe(this.savedChains().find(chain => chain.id === chainId));
            },
            recipeHasCarrier: function(recipe) {
                return !!(recipe && recipe.kind === 'staged' && recipe.stages && recipe.stages.carrier);
            },
            refreshChainsTransforms: function() {
                // Same rebuild custom spelling alphabets use after a CRUD change —
                // generic over window.transforms, not spelling-specific.
                if (typeof this.refreshCustomSpellingTransforms === 'function') {
                    this.refreshCustomSpellingTransforms();
                }
            },

            // -- staged recipe builder --

            stagedEmptyDraft: function() {
                return {
                    name: '',
                    stages: {
                        normalize: null,
                        translate: null,
                        obfuscate: null,
                        present: null,
                        conceal: null,
                        carrier: null
                    }
                };
            },
            recipeStageOrder: function() {
                return window.TransformRecipeStages ? window.TransformRecipeStages.STAGE_ORDER : [];
            },
            recipeStageLabel: function(stageId) {
                const labels = {
                    normalize: 'Normalize',
                    translate: 'Translate',
                    obfuscate: 'Obfuscate',
                    present: 'Present',
                    conceal: 'Conceal',
                    carrier: 'Carrier'
                };
                return labels[stageId] || stageId;
            },
            recipeTemplates: function() {
                return window.TransformRecipeStages ? window.TransformRecipeStages.TEMPLATES : [];
            },
            recipeCarrierChoices: function() {
                const carriers = window.steganography && Array.isArray(window.steganography.carriers)
                    ? window.steganography.carriers
                    : [];
                return carriers.map(carrier => ({
                    emoji: carrier.emoji,
                    name: carrier.name || carrier.emoji
                }));
            },
            clearRecipeTemplateSelection: function() {
                this.recipeTemplateId = '';
            },
            openRecipeBuilder: function(existing) {
                this.chainBuilderKind = 'chain';
                this.recipeBuilderMode = 'staged';
                this.chainBuilderEditId = existing ? existing.id : null;
                this.stagedDraft = existing
                    ? { name: existing.name, stages: JSON.parse(JSON.stringify(existing.stages || {})) }
                    : this.stagedEmptyDraft();
                this.recipeTemplateId = '';
                this.stagedPickerStage = '';
                this.stagedPickerQuery = '';
                this.stagedOpenNodeOptions = null;
                this.chainBuilderError = '';
                // Ignore backdrop "ghost clicks" from the same tap that opened the modal.
                this.chainBuilderOpenedAt = Date.now();
                this.chainBuilderOpen = true;
            },
            applyRecipeTemplate: function(templateId) {
                const template = this.recipeTemplates().find(t => t.id === templateId);
                if (!template) return;
                this.recipeTemplateId = templateId;
                this.$set(this.stagedDraft, 'stages', JSON.parse(JSON.stringify(template.stages)));
                this.stagedPickerStage = '';
                this.stagedPickerQuery = '';
                this.chainBuilderError = '';
            },
            stagedStageNodes: function(stageId) {
                const nodes = this.stagedDraft && this.stagedDraft.stages
                    ? this.stagedDraft.stages[stageId]
                    : null;
                return Array.isArray(nodes) ? nodes : [];
            },
            stagedNodeCandidates: function(stageId) {
                if (!window.transforms || !window.TransformRecipeStages) return [];
                const query = (this.stagedPickerQuery || '').trim().toLowerCase();
                return Object.keys(window.transforms)
                    .filter(key => window.TransformRecipeStages.isTransformAllowedInStage(
                        stageId,
                        key,
                        window.transforms
                    ))
                    .map(key => ({ key, t: window.transforms[key] }))
                    .filter(({ t }) => t && t.name && (!query || t.name.toLowerCase().indexOf(query) !== -1))
                    .sort((a, b) => a.t.name.localeCompare(b.t.name))
                    .map(({ key, t }) => ({ key, name: t.name, category: t.category }));
            },
            stagedTogglePicker: function(stageId) {
                this.stagedPickerStage = this.stagedPickerStage === stageId ? '' : stageId;
                this.stagedPickerQuery = '';
            },
            stagedAddNode: function(stageId, key) {
                const t = window.transforms && window.transforms[key];
                if (!t || !window.TransformRecipeStages ||
                    !window.TransformRecipeStages.isTransformAllowedInStage(stageId, key, window.transforms)) {
                    return;
                }
                const options = {};
                const prefs = typeof this.getMergedOptionsForTransform === 'function'
                    ? this.getMergedOptionsForTransform(t.name)
                    : {};
                (t.configurableOptions || []).forEach(opt => {
                    options[opt.id] = prefs && prefs[opt.id] != null ? prefs[opt.id] : opt.default;
                });
                const nodes = this.stagedStageNodes(stageId).slice();
                nodes.push({ transform: key, options });
                this.$set(this.stagedDraft.stages, stageId, nodes);
                this.clearRecipeTemplateSelection();
                this.stagedPickerQuery = '';
                this.chainBuilderError = '';
            },
            stagedRemoveNode: function(stageId, index) {
                const nodes = this.stagedStageNodes(stageId).slice();
                nodes.splice(index, 1);
                this.$set(this.stagedDraft.stages, stageId, nodes.length ? nodes : null);
                this.clearRecipeTemplateSelection();
                this.stagedOpenNodeOptions = null;
            },
            stagedMoveNode: function(stageId, index, direction) {
                const nodes = this.stagedStageNodes(stageId).slice();
                const target = index + direction;
                if (target < 0 || target >= nodes.length) return;
                const node = nodes.splice(index, 1)[0];
                nodes.splice(target, 0, node);
                this.$set(this.stagedDraft.stages, stageId, nodes);
                this.clearRecipeTemplateSelection();
                this.stagedOpenNodeOptions = null;
            },
            stagedToggleNodeOptions: function(stageId, index) {
                const open = this.stagedOpenNodeOptions;
                this.stagedOpenNodeOptions = open && open.stageId === stageId && open.index === index
                    ? null
                    : { stageId, index };
            },
            stagedNodeOptionsOpen: function(stageId, index) {
                const open = this.stagedOpenNodeOptions;
                return !!(open && open.stageId === stageId && open.index === index);
            },
            stagedSetNodeOption: function(stageId, index, optId, value) {
                const node = this.stagedStageNodes(stageId)[index];
                if (node) {
                    this.$set(node.options, optId, value);
                    this.clearRecipeTemplateSelection();
                }
            },
            stagedSetTranslateEnabled: function(enabled) {
                this.$set(this.stagedDraft.stages, 'translate', enabled
                    ? { type: 'translate', lang: 'la', model: this.translateModel || '' }
                    : null);
                this.clearRecipeTemplateSelection();
            },
            stagedSetCarrier: function(type) {
                this.$set(this.stagedDraft.stages, 'carrier', type
                    ? { type, options: type === 'emoji_stego' ? { carrierEmoji: '🐍' } : {} }
                    : null);
                this.clearRecipeTemplateSelection();
            },
            stagedSetCarrierEmoji: function(emoji) {
                const carrier = this.stagedDraft.stages.carrier;
                if (!carrier || carrier.type !== 'emoji_stego') return;
                this.$set(carrier.options, 'carrierEmoji', emoji);
                this.clearRecipeTemplateSelection();
            },
            saveStagedRecipe: function() {
                const draft = {
                    id: this.chainBuilderEditId,
                    name: (this.stagedDraft.name || '').trim(),
                    kind: 'staged',
                    stages: this.stagedDraft.stages
                };
                const id = window.TransformChains.saveRecipe(draft);
                if (!id) {
                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
                        'Could not save recipe.';
                    return;
                }
                this.chainBuilderOpen = false;
                this.refreshChainsTransforms();
                this.showNotification('Recipe saved — find it in the transform list and click it (with text in the input)', 'success', 'fas fa-link');
            },

            // -- LEGACY_FREEFORM_BUILDER: remove with free-form chain support --

            chainNodeCandidates: function() {
                if (!window.transforms) return [];
                const query = (this.chainNodePickerQuery || '').trim().toLowerCase();
                return Object.keys(window.transforms)
                    .map(key => ({ key, t: window.transforms[key] }))
                    .filter(({ t }) => t && t.name && !t.isChain && !t.isCycle)
                    .filter(({ t }) => !query || t.name.toLowerCase().indexOf(query) !== -1)
                    .sort((a, b) => a.t.name.localeCompare(b.t.name))
                    .map(({ key, t }) => ({ key, name: t.name, category: t.category }));
            },
            openChainBuilder: function(existing) {
                if (existing && existing.kind === 'staged') {
                    this.openRecipeBuilder(existing);
                    return;
                }
                this.chainBuilderKind = 'chain';
                this.recipeBuilderMode = 'legacy';
                this.chainBuilderEditId = existing ? existing.id : null;
                this.chainDraftName = existing ? existing.name : '';
                this.chainDraftNodes = existing ? JSON.parse(JSON.stringify(existing.nodes || [])) : [];
                this.chainNodePickerQuery = '';
                this.chainOpenNodeOptionsIndex = null;
                this.chainBuilderError = '';
                this.chainBuilderOpenedAt = Date.now();
                this.chainBuilderOpen = true;
            },
            setLegacyFreeformBuilder: function(enabled) {
                // LEGACY_FREEFORM_BUILDER: explicit escape hatch for unrestricted transform stacks.
                if (enabled) this.openChainBuilder(null);
            },
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
            chainRemoveNode: function(index) {
                this.chainDraftNodes.splice(index, 1);
                if (this.chainOpenNodeOptionsIndex === index) {
                    this.chainOpenNodeOptionsIndex = null;
                }
            },
            chainMoveNode: function(index, direction) {
                const target = index + direction;
                if (target < 0 || target >= this.chainDraftNodes.length) return;
                const nodes = this.chainDraftNodes.slice();
                const tmp = nodes[index];
                nodes.splice(index, 1);
                nodes.splice(target, 0, tmp);
                this.chainDraftNodes = nodes;
                if (this.chainOpenNodeOptionsIndex === index) {
                    this.chainOpenNodeOptionsIndex = target;
                }
            },
            chainToggleNodeOptions: function(index) {
                this.chainOpenNodeOptionsIndex = this.chainOpenNodeOptionsIndex === index ? null : index;
            },
            chainNodeName: function(node) {
                const t = window.transforms && window.transforms[node.transform];
                return t ? t.name : node.transform + ' (missing)';
            },
            chainNodeOptionFields: function(node) {
                const t = window.transforms && window.transforms[node.transform];
                return (t && t.configurableOptions) || [];
            },
            chainSetNodeOption: function(index, optId, value) {
                this.$set(this.chainDraftNodes[index].options, optId, value);
            },
            chainDraftPreviewSteps: function() {
                if (!window.TransformChains) return [];
                const sample = (this.transformInput || 'Hello World').slice(0, 60);
                return window.TransformChains.previewSteps(this.chainDraftNodes, sample);
            },
            saveChainDraft: function() {
                const name = (this.chainDraftName || '').trim();
                if (!name) {
                    this.chainBuilderError = 'Name is required.';
                    return;
                }
                if (!this.chainDraftNodes.length) {
                    this.chainBuilderError = 'Add at least one transform to the chain.';
                    return;
                }
                const id = window.TransformChains.saveChain({
                    id: this.chainBuilderEditId,
                    name,
                    nodes: this.chainDraftNodes
                });
                if (!id) {
                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
                        'Could not save chain.';
                    return;
                }
                this.chainBuilderOpen = false;
                this.refreshChainsTransforms();
                this.showNotification('Chain saved — find it on the Transforms page under chains', 'success', 'fas fa-link');
            },

            // -- cycle (per-word rotation) builder --

            openCycleBuilder: function(existing) {
                this.chainBuilderKind = 'cycle';
                this.chainBuilderEditId = existing ? existing.id : null;
                this.cycleDraftName = existing ? existing.name : '';
                this.cycleDraftChainIds = existing ? existing.chainIds.slice() : [];
                this.cycleDraftMode = existing && existing.mode === 'one_way' ? 'one_way' : 'word_safe';
                this.chainBuilderError = '';
                this.chainBuilderOpenedAt = Date.now();
                this.chainBuilderOpen = true;
            },
            cycleAddChainRef: function(chainId) {
                if (!chainId) return;
                this.cycleDraftChainIds.push(chainId);
            },
            cycleRemoveChainRef: function(index) {
                this.cycleDraftChainIds.splice(index, 1);
            },
            cycleMoveChainRef: function(index, direction) {
                const target = index + direction;
                if (target < 0 || target >= this.cycleDraftChainIds.length) return;
                const ids = this.cycleDraftChainIds.slice();
                const tmp = ids[index];
                ids.splice(index, 1);
                ids.splice(target, 0, tmp);
                this.cycleDraftChainIds = ids;
            },
            cycleDraftPreview: function() {
                if (!window.TransformChains || !this.cycleDraftChainIds.length) return '';
                const chains = this.cycleDraftChainIds
                    .map(id => this.savedChains().find(c => c.id === id))
                    .filter(Boolean);
                if (!chains.length) return '';
                const sample = this.transformInput || 'Hello World Foo Bar';
                try {
                    return window.TransformChains.runCycle(chains, sample, false);
                } catch (e) {
                    return '(preview failed: ' + e.message + ')';
                }
            },
            saveCycleDraft: function() {
                const name = (this.cycleDraftName || '').trim();
                if (!name) {
                    this.chainBuilderError = 'Name is required.';
                    return;
                }
                if (!this.cycleDraftChainIds.length) {
                    this.chainBuilderError = 'Add at least one chain to rotate through.';
                    return;
                }
                const id = window.TransformChains.saveCycle({
                    id: this.chainBuilderEditId,
                    name,
                    chainIds: this.cycleDraftChainIds,
                    mode: this.cycleDraftMode
                });
                if (!id) {
                    this.chainBuilderError = window.TransformChains.getLastMutationError() ||
                        'Could not save cycle.';
                    return;
                }
                this.chainBuilderOpen = false;
                this.refreshChainsTransforms();
                this.showNotification('Cycle saved — find it on the Transforms page under chains', 'success', 'fas fa-repeat');
            },

            closeChainBuilder: function() {
                // Same-tap backdrop closes look like "the button does nothing".
                if (Date.now() - (this.chainBuilderOpenedAt || 0) < 400) return;
                this.chainBuilderOpen = false;
                this.chainBuilderError = '';
            },
            deleteSavedChain: function(chain) {
                if (!window.confirm('Delete chain "' + chain.name + '"? Any cycle using it will drop the reference.')) return;
                const ok = window.TransformChains.deleteChain(chain.id);
                if (!ok) {
                    this.showNotification(
                        window.TransformChains.getLastMutationError() || 'Could not delete chain.',
                        'error',
                        'fas fa-exclamation-triangle'
                    );
                    return;
                }
                this.refreshChainsTransforms();
                this.pruneFavoritesForMissingTransforms();
                this.showNotification('Chain deleted', 'success', 'fas fa-trash');
            },
            deleteSavedCycle: function(cycle) {
                if (!window.confirm('Delete cycle "' + cycle.name + '"?')) return;
                const ok = window.TransformChains.deleteCycle(cycle.id);
                if (!ok) {
                    this.showNotification(
                        window.TransformChains.getLastMutationError() || 'Could not delete cycle.',
                        'error',
                        'fas fa-exclamation-triangle'
                    );
                    return;
                }
                this.refreshChainsTransforms();
                this.pruneFavoritesForMissingTransforms();
                this.showNotification('Cycle deleted', 'success', 'fas fa-trash');
            },
            chainCopyRecipe: function(entity, kind) {
                const recipe = window.TransformChains.describeRecipe(entity, kind);
                this.copyToClipboard(recipe);
                this.showNotification('Recipe copied', 'success', 'fas fa-copy');
            },
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
                        let importedCount = 0;
                        let failedCount = 0;
                        const mutationErrors = [];
                        const recordSaveResult = function(result) {
                            if (result) {
                                importedCount += 1;
                                return;
                            }
                            failedCount += 1;
                            if (typeof window.TransformChains.getLastMutationError === 'function') {
                                const mutationError = window.TransformChains.getLastMutationError();
                                if (mutationError && mutationErrors.indexOf(mutationError) === -1) {
                                    mutationErrors.push(mutationError);
                                }
                            }
                        };
                        (data.chains || []).forEach(function(c) {
                            const result = c && c.kind === 'staged'
                                ? window.TransformChains.saveRecipe(c)
                                : window.TransformChains.saveChain({
                                    id: c.id,
                                    name: c.name,
                                    nodes: c.nodes
                                });
                            recordSaveResult(result);
                        });
                        (data.cycles || []).forEach(function(cy) {
                            const result = window.TransformChains.saveCycle({
                                id: cy.id,
                                name: cy.name,
                                chainIds: cy.chainIds,
                                mode: cy.mode
                            });
                            recordSaveResult(result);
                        });
                        self.refreshChainsTransforms();
                        if (failedCount) {
                            let message = 'Import incomplete: ' + importedCount + ' imported, ' +
                                failedCount + ' failed';
                            if (mutationErrors.length) {
                                message += '. ' + mutationErrors.join('; ');
                            }
                            self.showNotification(message, 'error', 'fas fa-exclamation-triangle');
                            return;
                        }
                        self.showNotification('Chains imported', 'success', 'fas fa-file-import');
                    } catch (e) {
                        self.showNotification('Import failed: ' + (e.message || 'invalid file'), 'error');
                    }
                };
                reader.readAsText(file);
            },

            // -- AI-assisted decode for chains/cycles that can't mechanically reverse --

            chainDecodeKey: function(kind, id) {
                return kind + ':' + id;
            },
            chainToggleDecode: function(kind, id) {
                const key = this.chainDecodeKey(kind, id);
                this.chainDecodeOpenKey = this.chainDecodeOpenKey === key ? '' : key;
                this.chainDecodeInput = '';
                this.chainDecodeOutput = '';
                this.chainDecodeError = '';
            },
            chainRunAiDecode: function(entity, kind) {
                if (!window.TransformChains) return;
                this.chainDecodeError = '';
                this.chainDecodeOutput = '';
                if (!(this.chainDecodeInput || '').trim()) {
                    this.chainDecodeError = 'Paste the transformed text first.';
                    return;
                }
                const recipe = window.TransformChains.describeRecipe(entity, kind);
                if (this.chainDecodeModel) {
                    localStorage.setItem('chain-decode-model', this.chainDecodeModel);
                }
                this.chainDecodeLoading = true;
                window.TransformChains.aiDecode(recipe, this.chainDecodeInput, { model: this.chainDecodeModel })
                    .then(text => { this.chainDecodeOutput = text; })
                    .catch(e => { this.chainDecodeError = e.message || 'Decode failed.'; })
                    .finally(() => { this.chainDecodeLoading = false; });
            },
            transformInputControlKind: function() {
                if (!this.activeTransform || this.activeTransform.inputKind !== 'text') {
                    return 'textarea';
                }
                return 'text';
            },
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
            transformRefreshLexemeAnalysis: function() {
                if (typeof window === 'undefined' || !window.LexemeAnalysis || typeof window.LexemeAnalysis.analyze !== 'function') {
                    this.transformLexemeAnalysis = { totalFindings: 0, findings: [], summary: 'Lexeme analysis unavailable.' };
                    return;
                }
                this.transformLexemeAnalysis = window.LexemeAnalysis.analyze(this.transformInput);
            },
            transformGetLexemeAnalysis: function() {
                return this.transformLexemeAnalysis || { totalFindings: 0, findings: [], summary: 'No Latin-root wording findings.' };
            },
            transformNeutralizeInput: function() {
                const analysis = this.transformGetLexemeAnalysis();
                if (!analysis.totalFindings || !window.LexemeAnalysis || typeof window.LexemeAnalysis.neutralizeText !== 'function') {
                    return;
                }
                this.transformInput = window.LexemeAnalysis.neutralizeText(this.transformInput, analysis);
                if (typeof this.showNotification === 'function') {
                    this.showNotification('Applied neutral Latin-root rewrites', 'success', 'fas fa-seedling');
                }
            },
            transformApplyLexemeRewrite: function(term, rewrite) {
                if (!term || !rewrite) {
                    return;
                }
                const escapedTerm = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                this.transformInput = this.transformInput.replace(new RegExp('\\b' + escapedTerm + '\\b', 'i'), rewrite);
                if (typeof this.showNotification === 'function') {
                    this.showNotification('Applied rewrite for ' + term, 'success', 'fas fa-pen');
                }
            },
            openTransformOptions: function(transform, event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (!transform || !this.transformHasOptionsUI(transform)) {
                    return;
                }
                let modalTransform = transform;
                if (!modalTransform.configurableOptions || !modalTransform.configurableOptions.length) {
                    const full = window.transforms && Object.values(window.transforms).find(function(tr) {
                        return tr && tr.name === transform.name;
                    });
                    if (full && full.configurableOptions && full.configurableOptions.length) {
                        modalTransform = Object.assign({}, transform, {
                            configurableOptions: full.configurableOptions
                        });
                    }
                }
                this.transformOptionsModalTransform = modalTransform;
                this.transformOptionsDraft = Object.assign({}, this.getMergedOptionsForTransform(transform.name));
                this.transformOptionsModalOpen = true;
            },
            closeTransformOptions: function() {
                this.transformOptionsModalOpen = false;
                this.transformOptionsModalTransform = null;
                this.transformOptionsDraft = {};
            },
            setTransformOptionDraft: function(id, value) {
                this.$set(this.transformOptionsDraft, id, value);
            },
            resetTransformOptionsToDefaults: function() {
                const t = this.transformOptionsModalTransform;
                if (!t || !t.configurableOptions) {
                    return;
                }
                t.configurableOptions.forEach(opt => {
                    let v = opt.default;
                    if (v === undefined || v === null) {
                        if (opt.type === 'boolean') {
                            v = false;
                        } else if (opt.type === 'select' && opt.options && opt.options.length) {
                            v = opt.options[0].value;
                        } else if (opt.type === 'number') {
                            v = 0;
                        } else {
                            v = '';
                        }
                    }
                    this.$set(this.transformOptionsDraft, opt.id, v);
                });
            },
            commitTransformOptions: function() {
                if (!this.transformOptionsModalTransform) {
                    return;
                }
                const name = this.transformOptionsModalTransform.name;
                this.$set(this.transformOptionPrefs, name, Object.assign({}, this.transformOptionsDraft));
                try {
                    localStorage.setItem('transformOptionPrefs', JSON.stringify(this.transformOptionPrefs));
                } catch (e) {
                    console.warn('Failed to save transform option prefs:', e);
                }
                this.showNotification('Options saved', 'success', 'fas fa-gear');
                this.closeTransformOptions();
                if (this.activeTransform && this.activeTransform.name === name && this.transformInput) {
                    this.applyActiveTransformOutput();
                }
            },
            getTransformsByCategory: function(category) {
                const list = this.transforms.filter(transform => transform.category === category);
                if (!this.favorites || this.favorites.length === 0) return list;
                return list.filter(t =>
                    !this.favorites.some(f => typeof f === 'string' && f === t.name)
                );
            },
            formatCategoryLabel: function(category) {
                return String(category || '').replace(/_/g, ' ');
            },
            toggleCategoryFilter: function(category) {
                this.transformCategoryFilter = this.transformCategoryFilter === category ? '' : category;
            },
            clearTransformFilters: function() {
                this.transformSearchQuery = '';
                this.transformCategoryFilter = '';
            },
            transformSearchActive: function() {
                return String(this.transformSearchQuery || '').trim().length > 0;
            },
            transformMatchesSearchText: function(text) {
                const query = String(this.transformSearchQuery || '').trim().toLowerCase();
                if (!query) {
                    return true;
                }
                return String(text || '').toLowerCase().indexOf(query) !== -1;
            },
            transformMatchesSearch: function(transform) {
                return this.transformMatchesSearchText(transform && transform.name);
            },
            getFilteredTransformsByCategory: function(category) {
                const list = this.getTransformsByCategory(category);
                if (!this.transformSearchActive()) {
                    return list;
                }
                return list.filter(t => this.transformMatchesSearch(t));
            },
            categorySectionVisible: function(category) {
                if (this.transformCategoryFilter && this.transformCategoryFilter !== category) {
                    return false;
                }
                return this.getFilteredTransformsByCategory(category).length > 0;
            },
            displayItemMatchesFilters: function(item) {
                if (!item) {
                    return false;
                }
                if (this.transformCategoryFilter) {
                    if (item.type === 'translate') {
                        return false;
                    }
                    if (item.type === 'transform' && item.transform) {
                        const category = item.transform.category || this.getDisplayCategory(item.transform.name);
                        if (category !== this.transformCategoryFilter) {
                            return false;
                        }
                    }
                }
                if (!this.transformSearchActive()) {
                    return true;
                }
                if (item.type === 'translate') {
                    return this.transformMatchesSearchText(item.langName);
                }
                if (item.type === 'transform' && item.transform) {
                    return this.transformMatchesSearch(item.transform);
                }
                return true;
            },
            getFilteredFavoriteDisplayItems: function() {
                return this.getFavoriteDisplayItems().filter(item => this.displayItemMatchesFilters(item));
            },
            getFilteredLastUsedDisplayItems: function() {
                return this.getLastUsedDisplayItems().filter(item => this.displayItemMatchesFilters(item));
            },
            favoritesSectionVisible: function() {
                return this.showFavorites && this.getFilteredFavoriteDisplayItems().length > 0;
            },
            lastUsedSectionVisible: function() {
                return this.showLastUsed && this.getFilteredLastUsedDisplayItems().length > 0;
            },
            translateSectionVisible: function() {
                if (this.transformCategoryFilter) {
                    return false;
                }
                if (!this.transformSearchActive()) {
                    return true;
                }
                const langs = (this.translateMainLangs || [])
                    .concat(this.translateExoticLangs || [])
                    .concat(this.translateCustomLangs || []);
                return langs.some(lang => this.transformMatchesSearchText(lang.name));
            },
            translateLangVisible: function(langName) {
                return this.transformMatchesSearchText(langName);
            },
            transformListHasNoMatches: function() {
                if (!this.transformSearchActive() && !this.transformCategoryFilter) {
                    return false;
                }
                if (this.favoritesSectionVisible() || this.lastUsedSectionVisible() || this.translateSectionVisible()) {
                    return false;
                }
                return !this.categories.some(category => this.categorySectionVisible(category));
            },
            isSpecialCategory: function(category) {
                return category === 'randomizer';
            },
            stagedRecipeForTransform: function(transform) {
                if (!transform || !transform.chainId || !window.TransformChains) {
                    return null;
                }
                return window.TransformChains.loadRecipes().find(function(recipe) {
                    return recipe.id === transform.chainId && recipe.kind === 'staged';
                }) || null;
            },
            stagedRecipeNeedsAsync: function(recipe) {
                const stages = recipe && recipe.stages;
                return !!(stages && (stages.translate || stages.carrier));
            },
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
                    document.querySelectorAll('.transform-button').forEach(button => {
                        button.classList.remove('active');
                    });
                    const inputBox = document.querySelector('#transform-input');
                    if (inputBox) {
                        this.focusWithoutScroll(inputBox);
                    }
                    return;
                }

                // Track last used
                this.saveLastUsedTransform(transform.name);
                
                const outcome = await this.applyActiveTransformOutput({ copyOnSuccess: true });
                if (!outcome.applied) {
                    return;
                }

                if (transform.name === 'Random Mix') {
                    const transformInfo = window.transforms.randomizer.getLastTransformInfo();
                    if (transformInfo.length > 0) {
                        const transformsList = transformInfo.map(t => t.transformName).join(', ');
                        this.showNotification(`Mixed with: ${transformsList}`, 'success', 'fas fa-random');
                    }
                }
                
                if (transform.name !== 'Random Mix') {
                    const message = this.transformOutputKind === 'image' && !this.transformOutput
                        ? `${transform.name} image preview ready!`
                        : `${transform.name}${this.transformIoMode === 'decode' ? ' decoded and copied!' : ' applied and copied!'}`;
                    this.showNotification(message, 'success', 'fas fa-check');
                }
                
                document.querySelectorAll('.transform-button').forEach(button => {
                    button.classList.remove('active');
                });
                
                const inputBox = document.querySelector('#transform-input');
                if (inputBox) {
                    this.focusWithoutScroll(inputBox);
                    const len = inputBox.value.length;
                    try { inputBox.setSelectionRange(len, len); } catch (_) {}
                }
                
                this.isTransformCopy = false;
                this.ignoreKeyboardEvents = false;
            },
            saveLastUsedTransform: function(transformName) {
                try {
                    let lastUsed = this.lastUsedTransforms || [];
                    lastUsed = lastUsed.filter(item => {
                        if (item.kind === 'translate') return true;
                        return item.name !== transformName;
                    });
                    lastUsed.unshift({
                        name: transformName,
                        timestamp: Date.now()
                    });
                    lastUsed = lastUsed.slice(0, 5);
                    this.lastUsedTransforms = lastUsed;
                    this.showLastUsed = lastUsed.length > 0;
                    localStorage.setItem('transformLastUsed', JSON.stringify(lastUsed));
                } catch (e) {
                    console.warn('Failed to save last used transform:', e);
                }
            },
            saveLastUsedTranslate: function(langName, isCustom) {
                try {
                    let lastUsed = this.lastUsedTransforms || [];
                    const c = !!isCustom;
                    lastUsed = lastUsed.filter(item => {
                        if (item.kind === 'translate') {
                            return !(item.lang === langName && !!item.custom === c);
                        }
                        return true;
                    });
                    lastUsed.unshift({
                        kind: 'translate',
                        lang: langName,
                        custom: c,
                        timestamp: Date.now()
                    });
                    lastUsed = lastUsed.slice(0, 5);
                    this.lastUsedTransforms = lastUsed;
                    this.showLastUsed = lastUsed.length > 0;
                    localStorage.setItem('transformLastUsed', JSON.stringify(lastUsed));
                } catch (e) {
                    console.warn('Failed to save last used translate:', e);
                }
            },
            getLastUsedDisplayItems: function() {
                if (!this.lastUsedTransforms || this.lastUsedTransforms.length === 0) {
                    return [];
                }
                const out = [];
                for (let i = 0; i < this.lastUsedTransforms.length; i++) {
                    const item = this.lastUsedTransforms[i];
                    if (item.kind === 'translate') {
                        out.push({
                            type: 'translate',
                            key: 'lu-tx-' + item.lang + '-' + !!item.custom + '-' + (item.timestamp || i),
                            langName: item.lang,
                            custom: !!item.custom
                        });
                    } else if (item.name) {
                        const t = this.transforms.find(tr => tr.name === item.name);
                        if (t) {
                            out.push({ type: 'transform', key: 'lu-tr-' + item.name + '-' + i, transform: t });
                        }
                    }
                }
                return out;
            },
            getFavoriteDisplayItems: function() {
                if (!this.favorites || this.favorites.length === 0) return [];
                const out = [];
                for (let i = 0; i < this.favorites.length; i++) {
                    const f = this.favorites[i];
                    if (typeof f === 'string') {
                        const t = this.transforms.find(tr => tr.name === f);
                        if (t) out.push({ type: 'transform', key: 'fav-tr-' + f, transform: t });
                    } else if (f && f.kind === 'translate' && f.lang) {
                        out.push({
                            type: 'translate',
                            key: 'fav-tx-' + f.lang + '-' + !!f.custom,
                            langName: f.lang,
                            custom: !!f.custom
                        });
                    }
                }
                return out;
            },
            toggleFavorite: function(transformName, event) {
                if (typeof transformName !== 'string') return;
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                const index = this.favorites.indexOf(transformName);
                if (index > -1) {
                    this.favorites.splice(index, 1);
                    this.showNotification('Removed from favorites', 'success', 'fas fa-star');
                } else {
                    this.favorites.push(transformName);
                    this.showNotification('Added to favorites', 'success', 'fas fa-star');
                }
                this.showFavorites = this.favorites.length > 0;
                this.saveFavorites(this.favorites);
            },
            toggleTranslateFavorite: function(langName, custom, event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                const c = !!custom;
                const idx = this.favorites.findIndex(f => {
                    if (typeof f === 'string') return false;
                    return f && f.kind === 'translate' && f.lang === langName && !!f.custom === c;
                });
                if (idx > -1) {
                    this.favorites.splice(idx, 1);
                    this.showNotification('Removed from favorites', 'success', 'fas fa-star');
                } else {
                    this.favorites.push({ kind: 'translate', lang: langName, custom: c });
                    this.showNotification('Added to favorites', 'success', 'fas fa-star');
                }
                this.showFavorites = this.favorites.length > 0;
                this.saveFavorites(this.favorites);
            },
            isTranslateFavorite: function(langName, custom) {
                const c = !!custom;
                return this.favorites && this.favorites.some(f =>
                    f && typeof f === 'object' && f.kind === 'translate' &&
                    f.lang === langName && !!f.custom === c
                );
            },
            isFavorite: function(transformName) {
                return this.favorites && this.favorites.includes(transformName);
            },
            getFavoriteTransforms: function() {
                if (!this.favorites || this.favorites.length === 0) {
                    return [];
                }
                return this.favorites
                    .filter(f => typeof f === 'string')
                    .map(transformName => this.transforms.find(t => t.name === transformName))
                    .filter(t => t !== undefined);
            },
            saveFavorites: function(favorites) {
                try {
                    localStorage.setItem('transformFavorites', JSON.stringify(favorites));
                } catch (e) {
                    console.warn('Failed to save favorites:', e);
                }
            },
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
            moveCategoryUp: function(categoryIndex) {
                if (categoryIndex <= 0) return;
                
                // Never allow moving randomizer itself
                if (this.categories[categoryIndex] === 'randomizer') return;
                
                // Use Vue's array mutation methods for proper reactivity
                const categoryToMove = this.categories[categoryIndex];
                this.categories.splice(categoryIndex, 1);
                this.categories.splice(categoryIndex - 1, 0, categoryToMove);
                
                this.saveCategoryOrder(this.categories);
                this.showNotification('Category order saved', 'success', 'fas fa-check');
            },
            moveCategoryDown: function(categoryIndex) {
                // Don't allow moving if already at or past the last valid position
                // Last position is reserved for randomizer, so we can't move to it
                if (categoryIndex >= this.categories.length - 2) return;
                
                // Never allow moving randomizer itself
                if (this.categories[categoryIndex] === 'randomizer') return;
                
                // Use Vue's array mutation methods for proper reactivity
                const categoryToMove = this.categories[categoryIndex];
                this.categories.splice(categoryIndex, 1);
                this.categories.splice(categoryIndex + 1, 0, categoryToMove);
                
                this.saveCategoryOrder(this.categories);
                this.showNotification('Category order saved', 'success', 'fas fa-check');
            },
            saveCategoryOrder: function(categories) {
                try {
                    // Remove duplicates before saving
                    const uniqueCategories = categories.filter((cat, index, arr) => arr.indexOf(cat) === index);
                    localStorage.setItem('transformCategoryOrder', JSON.stringify(uniqueCategories));
                } catch (e) {
                    console.warn('Failed to save category order:', e);
                }
            },
            autoTransform: function() {
                if (this.transformInput && this.activeTransform && this.activeTab === 'transforms') {
                    this.applyActiveTransformOutput({ preserveEmojis: true });
                }
            },
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
                        this.applyActiveTransformOutput();
                    } else if (!match) {
                        ++this.transformApplyGeneration;
                        this.transformOutputKind = 'text';
                        this.transformOutput = '';
                        this.transformOutputImage = '';
                    }
                }
                this.pruneFavoritesForMissingTransforms();
            },
        };
    }
    
    getVueWatchers() {
        return {
            transformInput() {
                if (typeof this.transformRefreshLexemeAnalysis === 'function') {
                    this.transformRefreshLexemeAnalysis();
                }
                if (this.activeTransform && this.activeTab === 'transforms') {
                    this.applyActiveTransformOutput();
                }
            },
            transformOptionsModalOpen(val) {
                if (typeof document !== 'undefined') {
                    document.body.classList.toggle('transform-options-modal-open', !!val);
                }
            }
        };
    }
    
    getVueLifecycle() {
        return {
            mounted() {
                if (typeof this.refreshCustomSpellingTransforms === 'function') {
                    this.refreshCustomSpellingTransforms();
                }
                
                // Save initial category order to localStorage if it doesn't exist
                // This ensures consistent state for category reordering operations
                try {
                    const saved = localStorage.getItem('transformCategoryOrder');
                    if (!saved && this.categories && this.categories.length > 0) {
                        this.saveCategoryOrder(this.categories);
                    }
                } catch (e) {
                    console.warn('Failed to check/save initial category order:', e);
                }
            }
        };
    }
    
    onActivate(vueInstance) {
        if (typeof vueInstance.refreshCustomSpellingTransforms === 'function') {
            vueInstance.refreshCustomSpellingTransforms();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransformTool;
} else {
    window.TransformTool = TransformTool;
}


