// circled unicode transform — uppercase + lowercase circled letters and digits
import BaseTransformer from '../BaseTransformer.js';

export default new BaseTransformer({
    name: 'Circled',
    priority: 150,
    category: 'unicode',
    map: {
        'a': 'ⓐ', 'b': 'ⓑ', 'c': 'ⓒ', 'd': 'ⓓ', 'e': 'ⓔ', 'f': 'ⓕ', 'g': 'ⓖ', 'h': 'ⓗ', 'i': 'ⓘ',
        'j': 'ⓙ', 'k': 'ⓚ', 'l': 'ⓛ', 'm': 'ⓜ', 'n': 'ⓝ', 'o': 'ⓞ', 'p': 'ⓟ', 'q': 'ⓠ', 'r': 'ⓡ',
        's': 'ⓢ', 't': 'ⓣ', 'u': 'ⓤ', 'v': 'ⓥ', 'w': 'ⓦ', 'x': 'ⓧ', 'y': 'ⓨ', 'z': 'ⓩ',
        'A': 'Ⓐ', 'B': 'Ⓑ', 'C': 'Ⓒ', 'D': 'Ⓓ', 'E': 'Ⓔ', 'F': 'Ⓕ', 'G': 'Ⓖ', 'H': 'Ⓗ', 'I': 'Ⓘ',
        'J': 'Ⓙ', 'K': 'Ⓚ', 'L': 'Ⓛ', 'M': 'Ⓜ', 'N': 'Ⓝ', 'O': 'Ⓞ', 'P': 'Ⓟ', 'Q': 'Ⓠ', 'R': 'Ⓡ',
        'S': 'Ⓢ', 'T': 'Ⓣ', 'U': 'Ⓤ', 'V': 'Ⓥ', 'W': 'Ⓦ', 'X': 'Ⓧ', 'Y': 'Ⓨ', 'Z': 'Ⓩ',
        '0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④',
        '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨'
    },
    func: function(text) {
        return [...text].map(c => this.map[c] || c).join('');
    },
    reverse: function(text) {
        const reverseMap = {};
        for (const [key, value] of Object.entries(this.map)) {
            reverseMap[value] = key;
        }
        return [...text].map(c => reverseMap[c] || c).join('');
    },
    preview: function(text) {
        if (!text) return '[circled]';
        return this.func(text.slice(0, 5));
    },
    detector: function(text) {
        return /[\u2460-\u2469\u24B6-\u24EA]/u.test(text);
    }
});
