// memory.js — Persistence for n0body's knowledge

const STORAGE_KEY = 'n0body_knowledge';

/**
 * Save knowledge to localStorage
 * @param {Object} knowledge
 */
function saveKnowledge(knowledge) {
    try {
        const data = JSON.stringify(knowledge);
        localStorage.setItem(STORAGE_KEY, data);
        console.log('n0body: knowledge saved');
        return true;
    } catch (e) {
        console.error('n0body: failed to save knowledge', e);
        return false;
    }
}

/**
 * Load knowledge from localStorage
 * @returns {Object|null}
 */
function loadKnowledge() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const knowledge = JSON.parse(data);
            console.log(`n0body: knowledge loaded (${knowledge.sessionsPlayed} sessions)`);
            return knowledge;
        }
    } catch (e) {
        console.error('n0body: failed to load knowledge', e);
    }
    return null;
}

/**
 * Reset all knowledge
 */
function resetKnowledge() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('n0body: knowledge reset');
        return true;
    } catch (e) {
        console.error('n0body: failed to reset knowledge', e);
        return false;
    }
}

/**
 * Check if knowledge exists
 * @returns {boolean}
 */
function hasKnowledge() {
    return localStorage.getItem(STORAGE_KEY) !== null;
}

export { saveKnowledge, loadKnowledge, resetKnowledge, hasKnowledge };
