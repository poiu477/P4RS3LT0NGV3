(function(global) {
    var STORAGE_KEY = 'transform-encode-decode-mode';

    function normalizeMode(value) {
        return String(value || '').toLowerCase() === 'decode' ? 'decode' : 'encode';
    }

    function loadMode(storage) {
        try {
            return normalizeMode(storage && storage.getItem(STORAGE_KEY));
        } catch (e) {
            return 'encode';
        }
    }

    function saveMode(storage, mode) {
        try {
            if (storage && typeof storage.setItem === 'function') {
                storage.setItem(STORAGE_KEY, normalizeMode(mode));
            }
        } catch (e) { /* ignore quota */ }
    }

    function isMechanicallyReversible(transform) {
        return !!(transform && typeof transform.reverse === 'function' && transform.canDecode !== false);
    }

    /**
     * @returns {'encode'|'reverse'|'ai_decode'}
     */
    function resolveAction(transform, mode) {
        if (!transform) return 'encode';
        if (normalizeMode(mode) !== 'decode') return 'encode';
        return isMechanicallyReversible(transform) ? 'reverse' : 'ai_decode';
    }

    function describeForAiDecode(transform, chainsApi) {
        if (!transform) return 'Unknown transform';
        if (chainsApi && transform.isChain && transform.chainId) {
            var chain = (chainsApi.loadChains && chainsApi.loadChains() || [])
                .filter(function(c) { return c.id === transform.chainId; })[0];
            if (chain && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(chain, 'chain');
            }
        }
        if (chainsApi && transform.isCycle && transform.cycleId) {
            var cycle = (chainsApi.loadCycles && chainsApi.loadCycles() || [])
                .filter(function(c) { return c.id === transform.cycleId; })[0];
            if (cycle && chainsApi.describeRecipe) {
                return chainsApi.describeRecipe(cycle, 'cycle');
            }
        }
        var bits = [transform.name || 'Transform'];
        if (transform.description) bits.push(transform.description);
        return bits.join(' — ');
    }

    global.TransformApplyMode = {
        STORAGE_KEY: STORAGE_KEY,
        normalizeMode: normalizeMode,
        loadMode: loadMode,
        saveMode: saveMode,
        resolveAction: resolveAction,
        describeForAiDecode: describeForAiDecode
    };
})(typeof window !== 'undefined' ? window : this);
