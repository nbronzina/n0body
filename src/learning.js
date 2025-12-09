// learning.js — Learning system for n0body

/**
 * Initialize empty knowledge structure
 * @returns {Object}
 */
function initKnowledge() {
    const states = ['intro', 'buildup', 'peak', 'breakdown', 'outro'];

    // Initialize drums preferences per state
    const drums = {};
    states.forEach(state => {
        drums[state] = {};
        for (let i = 1; i <= 8; i++) {
            drums[state][i] = 1.0;
        }
    });

    // Initialize FX preferences per state
    const fx = {
        intro: { reverb: { preferred: 0.4, variance: 0.15 }, delay: { preferred: 0.1, variance: 0.1 }, filter: { preferred: 0.5, variance: 0.15 } },
        buildup: { reverb: { preferred: 0.5, variance: 0.15 }, delay: { preferred: 0.3, variance: 0.1 }, filter: { preferred: 0.6, variance: 0.15 } },
        peak: { reverb: { preferred: 0.65, variance: 0.15 }, delay: { preferred: 0.45, variance: 0.15 }, filter: { preferred: 0.75, variance: 0.15 } },
        breakdown: { reverb: { preferred: 0.5, variance: 0.15 }, delay: { preferred: 0.2, variance: 0.1 }, filter: { preferred: 0.4, variance: 0.15 } },
        outro: { reverb: { preferred: 0.7, variance: 0.1 }, delay: { preferred: 0.05, variance: 0.05 }, filter: { preferred: 0.3, variance: 0.1 } },
    };

    return {
        // Meta
        sessionsPlayed: 0,
        totalPlayTime: 0,  // minutes

        // Drum preferences per state (0.1 to 5.0, 1.0 is neutral)
        drums: drums,

        // Note preferences per scale+state combo
        notes: {},

        // Combo scores
        combos: {},

        // FX preferences per state
        fx: fx,

        // Scale success rates
        scaleSuccess: {},

        // BPM preferences per mood
        bpmPreference: {
            dark: { preferred: 82, variance: 10 },
            bright: { preferred: 110, variance: 15 },
            neutral: { preferred: 95, variance: 12 },
        },
    };
}

/**
 * Short-term memory for current session
 */
class ShortTermMemory {
    constructor(maxSize = 30) {
        this.actions = [];
        this.maxSize = maxSize;
    }

    add(action) {
        this.actions.push({
            ...action,
            timestamp: Date.now(),
        });

        // Maintain max size
        while (this.actions.length > this.maxSize) {
            this.actions.shift();
        }
    }

    getRecent(count = 10) {
        return this.actions.slice(-count);
    }

    clear() {
        this.actions = [];
    }

    get length() {
        return this.actions.length;
    }
}

/**
 * Evaluate how well the recent actions sound
 * @param {Array} recentActions - Last N actions
 * @returns {number} Score from -1 to +3
 */
function evaluateReward(recentActions) {
    if (recentActions.length < 3) return 0;

    const now = Date.now();
    let score = 0;

    // 1. Density check (optimal: 2-5 actions in last 2 seconds)
    const actionsLast2Sec = recentActions.filter(a => now - a.timestamp < 2000).length;
    if (actionsLast2Sec >= 2 && actionsLast2Sec <= 5) {
        score += 1;  // Good density
    } else if (actionsLast2Sec > 7) {
        score -= 1;  // Too chaotic
    } else if (actionsLast2Sec === 0) {
        score -= 0.5;  // Too sparse
    }

    // 2. Variety check (mix of element types)
    const types = new Set(recentActions.map(a => a.type));
    if (types.size >= 2) {
        score += 0.5;  // Good variety
    }
    if (types.size >= 3) {
        score += 0.3;  // Great variety
    }

    // 3. Rhythm check (regular spacing = more rhythmic)
    if (recentActions.length >= 4) {
        const intervals = [];
        for (let i = 1; i < recentActions.length; i++) {
            intervals.push(recentActions[i].timestamp - recentActions[i-1].timestamp);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // Low stdDev relative to average = more rhythmic
        if (avgInterval > 0 && stdDev < avgInterval * 0.5) {
            score += 1;  // Good rhythm
        } else if (avgInterval > 0 && stdDev < avgInterval * 0.3) {
            score += 0.5;  // Great rhythm
        }
    }

    // 4. Synth coherence (notes close in scale = melodic)
    const synthActions = recentActions.filter(a => a.type === 'synth' && a.note);
    if (synthActions.length >= 2) {
        // Bonus for having synth activity
        score += 0.3;
    }

    // 5. State-appropriate density
    const lastAction = recentActions[recentActions.length - 1];
    if (lastAction && lastAction.context) {
        const state = lastAction.context.state;
        const density = actionsLast2Sec;

        // Penalize if density doesn't match state expectations
        if (state === 'intro' && density > 3) {
            score -= 0.5;  // Too busy for intro
        } else if (state === 'peak' && density < 2) {
            score -= 0.3;  // Too sparse for peak
        } else if (state === 'outro' && density > 2) {
            score -= 0.3;  // Too busy for outro
        }
    }

    return Math.max(-1, Math.min(3, score));
}

/**
 * Calculate learning rate based on experience
 * @param {number} sessionsPlayed
 * @returns {number}
 */
function getLearningRate(sessionsPlayed) {
    const baseLR = 0.25;
    // Decreases with experience (like a human learning curve)
    const experienceFactor = Math.max(0.1, 1 - (sessionsPlayed / 100));
    return baseLR * experienceFactor;
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Weighted random choice based on weights object
 * @param {Object} weights - { key: weight, ... }
 * @returns {string|number} Chosen key
 */
function weightedChoice(weights) {
    const entries = Object.entries(weights);
    if (entries.length === 0) return null;

    const total = entries.reduce((sum, [_, w]) => sum + Math.max(0, w), 0);
    if (total === 0) return entries[0][0];

    let random = Math.random() * total;

    for (const [key, weight] of entries) {
        random -= Math.max(0, weight);
        if (random <= 0) {
            // Return as number if it looks like a number
            return isNaN(parseInt(key)) ? key : parseInt(key);
        }
    }

    // Fallback
    const fallbackKey = entries[0][0];
    return isNaN(parseInt(fallbackKey)) ? fallbackKey : parseInt(fallbackKey);
}

/**
 * Get experience level based on sessions
 * @param {number} sessions
 * @returns {string}
 */
function getLevel(sessions) {
    if (sessions < 5) return 'newborn';
    if (sessions < 15) return 'learning';
    if (sessions < 30) return 'developing';
    if (sessions < 50) return 'skilled';
    if (sessions < 100) return 'experienced';
    return 'master';
}

export {
    initKnowledge,
    ShortTermMemory,
    evaluateReward,
    getLearningRate,
    clamp,
    weightedChoice,
    getLevel,
};
