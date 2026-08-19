/**
 * n0body v3.2 — fully learnable, unlimited sessions
 * the first non-human performer of Playground
 *
 * Usage:
 *   1. Open mk-1: https://nbronzina.github.io/playground/mk-1.html
 *   2. Open browser console (F12)
 *   3. Paste this entire file
 *   4. Run: n0body.start()
 *   5. To stop: n0body.stop() (graceful outro)
 *
 * All musical parameters are learnable:
 *   - BPM preferences per mood
 *   - Scale preferences (weighted)
 *   - State durations
 *   - Synth waveforms
 *   - FX per state
 *   - Energy patterns
 *   - State transitions
 *
 * Knowledge persists in localStorage
 */

(function() {
    'use strict';

    // ========== MEMORY (localStorage persistence) ==========
    const STORAGE_KEY = 'n0body_knowledge';

    function saveKnowledge(knowledge) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(knowledge));
            return true;
        } catch (e) {
            console.error('n0body: failed to save knowledge', e);
            return false;
        }
    }

    function loadKnowledge() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                var knowledge = JSON.parse(data);
                // Migrate old knowledge structure
                knowledge = migrateKnowledge(knowledge);
                console.log('n0body: knowledge loaded (' + knowledge.sessionsPlayed + ' sessions)');
                return knowledge;
            }
        } catch (e) {
            console.error('n0body: failed to load knowledge', e);
        }
        return null;
    }

    function resetKnowledge() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('n0body: knowledge reset');
            return true;
        } catch (e) {
            return false;
        }
    }

    // Migrate old knowledge to new structure — only runs on version mismatch
    function migrateKnowledge(old) {
        // Already current version — return as-is, no data loss
        if (old.version === '3.2') {
            return old;
        }

        // Old format (pre-3.2) — migrate once
        var fresh = initKnowledge();
        // Preserve basic stats
        fresh.sessionsPlayed = old.sessionsPlayed || 0;
        fresh.totalPlayTime = old.totalPlayTime || 0;
        // Preserve compatible structures
        if (old.transitionSuccess) fresh.transitionSuccess = old.transitionSuccess;
        if (old.transitions) fresh.transitionSuccess = old.transitions;
        if (old.combos) fresh.combos = old.combos;
        if (old.notes) fresh.notes = old.notes;
        if (old.drums) fresh.drums = old.drums;
        // Migrate FX if exists with new structure
        if (old.fx && old.fx.intro && old.fx.intro.reverb && typeof old.fx.intro.reverb === 'object') {
            fresh.fx = old.fx;
        }
        // Preserve new-format fields if they exist
        if (old.synth) fresh.synth = old.synth;
        if (old.stateDurations) fresh.stateDurations = old.stateDurations;
        if (old.energy) fresh.energy = old.energy;
        if (old.sessionHistory) fresh.sessionHistory = old.sessionHistory;
        if (old.savedPatterns) fresh.savedPatterns = old.savedPatterns;
        if (old.bpmChanges) fresh.bpmChanges = old.bpmChanges;
        if (old.scaleChanges) fresh.scaleChanges = old.scaleChanges;
        if (old.scales) fresh.scales = old.scales;
        if (old.bpm) fresh.bpm = old.bpm;
        if (old.grooveMemory) fresh.grooveMemory = old.grooveMemory;
        if (old.grooveRejected) fresh.grooveRejected = old.grooveRejected;
        // Migrate old BPM preferences format
        if (old.bpmPreference && !old.bpm) {
            for (var mood in old.bpmPreference) {
                if (fresh.bpm[mood]) {
                    fresh.bpm[mood].preferred = old.bpmPreference[mood].preferred || fresh.bpm[mood].preferred;
                    fresh.bpm[mood].variance = old.bpmPreference[mood].variance || fresh.bpm[mood].variance;
                }
            }
        }
        // Migrate old scale success format
        if (old.scaleSuccess && !old.scales) {
            for (var scale in old.scaleSuccess) {
                if (fresh.scales[scale]) {
                    fresh.scales[scale].weight = old.scaleSuccess[scale].avgScore || 1.0;
                }
            }
        }
        return fresh;
    }

    // ========== LEARNING SYSTEM (FULLY LEARNABLE) ==========
    function initKnowledge() {
        var states = ['intro', 'buildup', 'peak', 'breakdown', 'outro'];

        // Drums per state (pad weights)
        var drums = {};
        states.forEach(function(state) {
            drums[state] = {};
            for (var i = 1; i <= 8; i++) { drums[state][i] = 1.0; }
        });

        // FX preferences per state
        var fx = {
            intro: { reverb: { preferred: 0.4, variance: 0.15 }, delay: { preferred: 0.1, variance: 0.1 }, filter: { preferred: 0.5, variance: 0.15 }, distortion: { preferred: 0.05, variance: 0.05 }, chorus: { preferred: 0.1, variance: 0.1 }, crush: { preferred: 0, variance: 0 } },
            buildup: { reverb: { preferred: 0.5, variance: 0.15 }, delay: { preferred: 0.3, variance: 0.1 }, filter: { preferred: 0.6, variance: 0.15 }, distortion: { preferred: 0.1, variance: 0.1 }, chorus: { preferred: 0.2, variance: 0.1 }, crush: { preferred: 0, variance: 0 } },
            peak: { reverb: { preferred: 0.65, variance: 0.15 }, delay: { preferred: 0.45, variance: 0.15 }, filter: { preferred: 0.75, variance: 0.15 }, distortion: { preferred: 0.2, variance: 0.1 }, chorus: { preferred: 0.3, variance: 0.15 }, crush: { preferred: 0.1, variance: 0.1 } },
            breakdown: { reverb: { preferred: 0.5, variance: 0.15 }, delay: { preferred: 0.2, variance: 0.1 }, filter: { preferred: 0.4, variance: 0.15 }, distortion: { preferred: 0.05, variance: 0.05 }, chorus: { preferred: 0.15, variance: 0.1 }, crush: { preferred: 0, variance: 0 } },
            outro: { reverb: { preferred: 0.7, variance: 0.1 }, delay: { preferred: 0.05, variance: 0.05 }, filter: { preferred: 0.3, variance: 0.1 }, distortion: { preferred: 0, variance: 0 }, chorus: { preferred: 0.1, variance: 0.05 }, crush: { preferred: 0, variance: 0 } },
        };

        // State durations (learnable)
        var stateDurations = {
            intro: { preferred: 55, variance: 35, min: 20, max: 90 },
            buildup: { preferred: 112, variance: 68, min: 45, max: 180 },
            peak: { preferred: 270, variance: 210, min: 60, max: 480 },
            breakdown: { preferred: 90, variance: 60, min: 30, max: 150 },
            outro: { preferred: 45, variance: 15, min: 30, max: 60 },
        };

        // Synth preferences (waveforms, attack, release)
        var synth = {
            waveforms: { sine: 1.0, square: 1.0, saw: 1.0, triangle: 1.0, pulse: 1.0 },
            attack: { preferred: 0.1, variance: 0.1 },
            release: { preferred: 0.3, variance: 0.2 },
        };

        // Energy per state (current session tracking)
        var energy = {
            intro: { target: 0.2, variance: 0.1 },
            buildup: { target: 0.5, variance: 0.15 },
            peak: { target: 0.9, variance: 0.1 },
            breakdown: { target: 0.35, variance: 0.15 },
            outro: { target: 0.1, variance: 0.05 },
        };

        return {
            // Meta
            sessionsPlayed: 0,
            totalPlayTime: 0,
            version: '3.2',

            // BPM (learnable per mood)
            bpm: {
                dark: { preferred: 82, variance: 10, history: [] },
                bright: { preferred: 110, variance: 15, history: [] },
                neutral: { preferred: 95, variance: 12, history: [] },
            },

            // Scales (weighted preference)
            scales: {
                cMinor: { weight: 1.0, sessions: 0 },
                aMinor: { weight: 1.0, sessions: 0 },
                dMinor: { weight: 1.0, sessions: 0 },
                cMajor: { weight: 1.0, sessions: 0 },
                gMajor: { weight: 1.0, sessions: 0 },
                cMinorPentatonic: { weight: 1.0, sessions: 0 },
                aMinorPentatonic: { weight: 1.0, sessions: 0 },
                dDorian: { weight: 1.0, sessions: 0 },
                aPhrygian: { weight: 1.0, sessions: 0 },
            },

            // State durations (learnable)
            stateDurations: stateDurations,

            // Drums (pad weights per state)
            drums: drums,

            // Note preferences per scale+state
            notes: {},

            // FX (per state with preferred/variance)
            fx: fx,

            // Synth preferences
            synth: synth,

            // State transitions (learnable)
            transitionSuccess: {},

            // Energy per state
            energy: energy,

            // Action combos that worked well
            combos: {},

            // Session history for trend analysis
            sessionHistory: [],

            // Groove memory — learned patterns with context and reward
            // Key: "state_mood" (e.g. "peak_dark")
            // Value: array of { pattern: {track: patternName}, reward, count, mutations }
            grooveMemory: {},

            // Grooves that consistently failed — never use again
            grooveRejected: [],
        };
    }

    function evaluateReward(recentActions) {
        if (recentActions.length < 3) return 0;
        var now = Date.now();
        var score = 0;

        var actionsLast2Sec = recentActions.filter(function(a) { return now - a.timestamp < 2000; }).length;
        if (actionsLast2Sec >= 2 && actionsLast2Sec <= 5) score += 1;
        else if (actionsLast2Sec > 7) score -= 1;
        else if (actionsLast2Sec === 0) score -= 0.5;

        var types = {};
        recentActions.forEach(function(a) { types[a.type] = true; });
        var typeCount = Object.keys(types).length;
        if (typeCount >= 2) score += 0.5;
        if (typeCount >= 3) score += 0.3;

        if (recentActions.length >= 4) {
            var intervals = [];
            for (var i = 1; i < recentActions.length; i++) {
                intervals.push(recentActions[i].timestamp - recentActions[i-1].timestamp);
            }
            var avgInterval = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
            var variance = intervals.reduce(function(sum, intv) { return sum + Math.pow(intv - avgInterval, 2); }, 0) / intervals.length;
            var stdDev = Math.sqrt(variance);
            if (avgInterval > 0 && stdDev < avgInterval * 0.5) score += 1;
        }

        return Math.max(-1, Math.min(3, score));
    }

    function getLearningRate(sessionsPlayed) {
        var baseLR = 0.25;
        var experienceFactor = Math.max(0.1, 1 - (sessionsPlayed / 100));
        return baseLR * experienceFactor;
    }

    function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

    function weightedChoice(weights) {
        var entries = [];
        for (var key in weights) {
            if (weights.hasOwnProperty(key)) entries.push([key, weights[key]]);
        }
        if (entries.length === 0) return null;

        var total = 0;
        entries.forEach(function(e) { total += Math.max(0, e[1]); });
        if (total === 0) return entries[0][0];

        var random = Math.random() * total;
        for (var i = 0; i < entries.length; i++) {
            random -= Math.max(0, entries[i][1]);
            if (random <= 0) {
                var k = entries[i][0];
                return isNaN(parseInt(k)) ? k : parseInt(k);
            }
        }
        return entries[0][0];
    }

    function getLevel(sessions) {
        if (sessions < 11) return 'newborn';      // 1-10
        if (sessions < 31) return 'learning';     // 11-30
        if (sessions < 61) return 'developing';   // 31-60
        if (sessions < 101) return 'skilled';     // 61-100
        if (sessions < 201) return 'experienced'; // 101-200
        return 'master';                          // 200+
    }

    // ========== SHORT TERM MEMORY ==========
    function ShortTermMemory(maxSize) {
        this.actions = [];
        this.maxSize = maxSize || 30;
    }
    ShortTermMemory.prototype.add = function(action) {
        this.actions.push({ type: action.type, pad: action.pad, note: action.note, param: action.param, value: action.value, context: action.context, timestamp: Date.now() });
        while (this.actions.length > this.maxSize) this.actions.shift();
    };
    ShortTermMemory.prototype.getRecent = function(count) { return this.actions.slice(-(count || 10)); };
    ShortTermMemory.prototype.clear = function() { this.actions = []; };

    // ========== SCALES ==========
    var SCALES = {
        cMinor: ['C3', 'D3', 'Eb3', 'F3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4'],
        aMinor: ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
        dMinor: ['D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
        cMajor: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
        gMajor: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4'],
        cMinorPentatonic: ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4'],
        aMinorPentatonic: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4'],
        dDorian: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
        aPhrygian: ['A2', 'Bb2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4'],
    };

    var SCALE_MOODS = {
        dark: ['cMinor', 'aMinor', 'dMinor', 'aPhrygian'],
        bright: ['cMajor', 'gMajor'],
        neutral: ['cMinorPentatonic', 'aMinorPentatonic', 'dDorian'],
    };

    // Related scales for mid-session modulation
    var RELATED_SCALES = {
        aMinor: ['cMajor', 'dMinor', 'aMinorPentatonic', 'dDorian'],
        cMinor: ['cMinorPentatonic', 'dDorian', 'aPhrygian'],
        dMinor: ['aMinor', 'dDorian', 'cMajor'],
        cMajor: ['aMinor', 'gMajor', 'cMinorPentatonic'],
        gMajor: ['cMajor', 'aMinor'],
        aMinorPentatonic: ['aMinor', 'cMinorPentatonic'],
        cMinorPentatonic: ['cMinor', 'aMinorPentatonic'],
        dDorian: ['aMinor', 'dMinor', 'cMajor'],
        aPhrygian: ['cMinor', 'dMinor'],
    };

    // ========== CONFIG v3.2 ==========
    var CONFIG = {
        session: { transitionCheckInterval: 10 },
        tempo: { bpm: { min: 70, max: 140 } },
        waveforms: ['sine', 'square', 'saw', 'triangle', 'pulse', 'noise', 'string', 'voice', 'vocoder'],
        // Waveform change probability per minute by state (0 = never change)
        waveformChangeChance: {
            intro: 0,
            buildup: 0.15,
            peak: 0.05,
            breakdown: 0.15,
            outro: 0,
        },
        humanize: { timing: 50 },
        outro: { minDuration: 30, maxDuration: 60 },
        fxChangeInterval: { min: 45000, max: 90000 },
        // BPM change probability per minute by state
        bpmChangeChance: {
            intro: 0,
            buildup: 0.1,
            peak: 0.15,
            breakdown: 0.1,
            outro: 0,
        },
        // Scale change probability on state transitions
        scaleChangeChance: 0.2,
    };

    // State transitions (organic, probability-based) - faster settling
    var STATE_TRANSITIONS = {
        intro: { minDuration: 20, maxDuration: 90, transitions: { buildup: 0.65, intro: 0.35 } },
        buildup: { minDuration: 45, maxDuration: 180, transitions: { peak: 0.6, buildup: 0.25, breakdown: 0.1, intro: 0.05 } },
        peak: { minDuration: 60, maxDuration: 480, transitions: { peak: 0.55, breakdown: 0.35, buildup: 0.1 } },
        breakdown: { minDuration: 30, maxDuration: 150, transitions: { buildup: 0.55, breakdown: 0.25, intro: 0.15, peak: 0.05 } },
        outro: { minDuration: 30, maxDuration: 60, transitions: {} },
    };

    // REST probability - let the base breathe (higher = more rest, less CPU load)
    var REST_PROBABILITY = {
        intro: 0.88,
        buildup: 0.75,
        peak: 0.65,      // was 0.5, optimized for performance
        breakdown: 0.78,
        outro: 0.92,
    };

    var STATE_CONFIG = {
        intro: {
            drums: {
                probability: 0.005,
                padWeights: { 1: 0.02, 2: 0, 3: 0.01, 4: 0, 5: 0, 6: 0.01, 7: 0, 8: 0.01 }
            },
            synth: { probability: 0.20, noteDuration: { min: 1.5, max: 4 } },
            sequencer: { active: false },
            fx: { reverb: { min: 0.3, max: 0.5 }, delay: { min: 0, max: 0.2 }, filter: { min: 0.4, max: 0.6 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0, max: 0.15 }, crush: { min: 0, max: 0 } },
        },
        buildup: {
            drums: {
                probability: 0.01,
                padWeights: { 1: 0.15, 2: 0.08, 3: 0.12, 4: 0.04, 5: 0.03, 6: 0.05, 7: 0.02, 8: 0.04 }
            },
            synth: { probability: 0.30, noteDuration: { min: 0.5, max: 2 } },
            sequencer: { active: true, density: 0.15, tracksActive: [1, 2, 3, 8] },
            fx: { reverb: { min: 0.4, max: 0.6 }, delay: { min: 0.15, max: 0.35 }, filter: { min: 0.5, max: 0.7 }, distortion: { min: 0, max: 0.1 }, chorus: { min: 0.1, max: 0.25 }, crush: { min: 0, max: 0 } },
        },
        peak: {
            drums: {
                probability: 0.015,
                padWeights: { 1: 0.20, 2: 0.15, 3: 0.18, 4: 0.08, 5: 0.06, 6: 0.08, 7: 0.05, 8: 0.06 }
            },
            synth: { probability: 0.40, noteDuration: { min: 0.2, max: 1.2 } },
            sequencer: { active: true, density: 0.35, tracksActive: [1, 2, 3, 4, 5, 6, 8] },
            fx: { reverb: { min: 0.5, max: 0.75 }, delay: { min: 0.25, max: 0.5 }, filter: { min: 0.6, max: 0.85 }, distortion: { min: 0.05, max: 0.2 }, chorus: { min: 0.15, max: 0.35 }, crush: { min: 0, max: 0.1 } },
        },
        breakdown: {
            drums: {
                probability: 0.008,
                padWeights: { 1: 0.08, 2: 0.04, 3: 0.06, 4: 0.03, 5: 0.02, 6: 0.04, 7: 0.01, 8: 0.03 }
            },
            synth: { probability: 0.25, noteDuration: { min: 0.8, max: 2.5 } },
            sequencer: { active: true, density: 0.1, tracksActive: [1, 2, 3, 6] },
            fx: { reverb: { min: 0.45, max: 0.6 }, delay: { min: 0.1, max: 0.25 }, filter: { min: 0.35, max: 0.55 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0.1, max: 0.2 }, crush: { min: 0, max: 0 } },
        },
        outro: {
            drums: {
                probability: 0.003,
                padWeights: { 1: 0.02, 2: 0, 3: 0.01, 4: 0, 5: 0, 6: 0.01, 7: 0.01, 8: 0 }
            },
            synth: { probability: 0.12, noteDuration: { min: 1.5, max: 4 } },
            sequencer: { active: false },
            fx: { reverb: { min: 0.6, max: 0.8 }, delay: { min: 0, max: 0.1 }, filter: { min: 0.2, max: 0.4 }, distortion: { min: 0, max: 0 }, chorus: { min: 0, max: 0.1 }, crush: { min: 0, max: 0 } },
        },
    };

    // ========== DRUM PATTERN TEMPLATES ==========
    // Patterns as units — not random steps. 1 = hit, 0 = rest. 16 steps.
    var DRUM_PATTERNS = {
        // kick patterns
        kick_four: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
        kick_minimal: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
        kick_syncopated: [1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0],
        kick_broken: [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0],
        // snare patterns
        snare_backbeat: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
        snare_offbeat: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
        snare_sparse: [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
        // hihat patterns
        hat_eighth: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
        hat_sixteenth: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        hat_offbeat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
        hat_sparse: [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0],
        // perc/rim accents
        perc_accent: [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],
        rim_ghost: [0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],
        // empty
        silent: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    };

    // Pattern sets by energy level — complete groove presets
    var GROOVE_PRESETS = {
        intro: [
            { 1: 'kick_minimal', 3: 'silent', 6: 'silent' },
        ],
        buildup: [
            { 1: 'kick_four', 2: 'snare_sparse', 3: 'hat_offbeat' },
            { 1: 'kick_syncopated', 2: 'snare_backbeat', 3: 'hat_sparse', 8: 'rim_ghost' },
        ],
        peak: [
            { 1: 'kick_four', 2: 'snare_backbeat', 3: 'hat_eighth', 6: 'perc_accent' },
            { 1: 'kick_broken', 2: 'snare_offbeat', 3: 'hat_sixteenth', 8: 'rim_ghost' },
            { 1: 'kick_syncopated', 2: 'snare_backbeat', 3: 'hat_eighth', 6: 'perc_accent', 8: 'rim_ghost' },
        ],
        breakdown: [
            { 1: 'kick_minimal', 2: 'silent', 3: 'hat_sparse' },
            { 1: 'kick_minimal', 6: 'perc_accent' },
        ],
        outro: [
            { 1: 'kick_minimal', 3: 'silent' },
        ],
    };

    // ========== UTILS ==========
    function randomBetween(min, max) { return Math.random() * (max - min) + min; }
    function randomIntBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randomFrom(array) { return array[Math.floor(Math.random() * array.length)]; }
    function formatTimeHMS(ms) {
        var totalSeconds = Math.floor(ms / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        if (hours > 0) {
            return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }
        return minutes + ':' + String(seconds).padStart(2, '0');
    }

    // ========== N0BODY v3.2 CLASS ==========
    function N0body() {
        this.config = CONFIG;
        this.scales = SCALES;
        this.scaleMoods = SCALE_MOODS;
        this.stateConfig = STATE_CONFIG;
        this.stateTransitions = STATE_TRANSITIONS;
        this.restProbability = REST_PROBABILITY;

        this.isPlaying = false;
        this.isEnding = false;
        this.sessionStart = null;
        this.stateStartTime = null;
        this.currentState = 'intro';
        this.currentScale = null;
        this.currentScaleName = null;
        this.currentMood = null;
        this.currentBPM = null;
        this.currentWaveform = null;

        this.mainLoop = null;
        this.synthTimer = null;
        this.fxTimer = null;
        this.transitionCheckTimer = null;
        this.outroTimer = null;

        // Melodic state
        this.lastNote = null;

        // Current FX values for incremental changes
        this.currentFx = { reverb: 0.5, delay: 0.2, filter: 0.5, distortion: 0, chorus: 0.1, crush: 0 };

        this.stats = { drumsPlayed: 0, synthNotesPlayed: 0, sequencerChanges: 0, fxChanges: 0, waveformChanges: 0, stateTransitions: 0 };

        // Recent actions for director context
        this.recentActions = [];

        this.knowledge = loadKnowledge() || initKnowledge();
        this.shortTermMemory = new ShortTermMemory(30);
    }

    N0body.prototype.getExplorationRate = function() {
        var sessions = this.knowledge.sessionsPlayed;
        if (sessions < 11) return 0.70;   // newborn: 70% exploration
        if (sessions < 31) return 0.50;   // learning: 50%
        if (sessions < 61) return 0.30;   // developing: 30%
        if (sessions < 101) return 0.20;  // skilled: 20%
        if (sessions < 201) return 0.15;  // experienced: 15%
        return 0.10;                       // master: 10%
    };

    N0body.prototype.reduceVariance = function(currentVariance, minVariance) {
        var sessions = this.knowledge.sessionsPlayed;
        // Gradual reduction: 0.5% per session
        var reduction = 1 - (sessions * 0.005);
        var newVariance = currentVariance * Math.max(0.3, reduction);
        return Math.max(minVariance, newVariance);
    };

    N0body.prototype.start = function() {
        if (this.isPlaying) return;
        if (typeof MK1 === 'undefined') { console.error('n0body: MK1 not found'); return; }

        console.log('');
        console.log('n0body v3.2 is going live...');
        console.log('fully learnable - unlimited session');
        console.log('');

        this.isPlaying = true;
        this.isEnding = false;
        this.sessionStart = Date.now();
        this.stateStartTime = Date.now();
        this.stats = { drumsPlayed: 0, synthNotesPlayed: 0, sequencerChanges: 0, fxChanges: 0, waveformChanges: 0, stateTransitions: 0 };
        this.shortTermMemory.clear();

        // Reset LLM session memory for new session
        if (this.llm) {
            this.llm.resetSessionMemory();
        }

        // Reset melodic state
        this.lastNote = null;

        this._initSession();
        this._startLoops();

        console.log('n0body: starting session (previous: ' + this.knowledge.sessionsPlayed + ' sessions, ' + Math.round(this.knowledge.totalPlayTime) + ' min)');
    };

    N0body.prototype.stop = function() {
        if (!this.isPlaying) return;
        if (this.isEnding) { console.log('n0body: already ending...'); return; }

        console.log('');
        console.log('n0body: entering outro...');

        this.isEnding = true;
        if (this.transitionCheckTimer) {
            clearInterval(this.transitionCheckTimer);
            this.transitionCheckTimer = null;
        }

        this._transitionTo('outro');

        var outroDuration = randomBetween(this.config.outro.minDuration * 1000, this.config.outro.maxDuration * 1000);
        console.log('n0body: outro will last ' + Math.round(outroDuration / 1000) + 's');

        var self = this;
        this.outroTimer = setTimeout(function() {
            console.log('n0body: outro finished, calling _actualStop...');
            self._actualStop();
        }, outroDuration);
    };

    N0body.prototype._actualStop = function() {
        console.log('n0body: _actualStop called');
        console.log('');
        console.log('n0body is signing off...');

        this.isPlaying = false;
        this.isEnding = false;

        // Clear ALL timers
        if (this.mainLoop) { clearInterval(this.mainLoop); this.mainLoop = null; }
        if (this.synthTimer) { clearTimeout(this.synthTimer); this.synthTimer = null; }
        if (this.fxTimer) { clearTimeout(this.fxTimer); this.fxTimer = null; }
        if (this.transitionCheckTimer) { clearInterval(this.transitionCheckTimer); this.transitionCheckTimer = null; }
        if (this.outroTimer) { clearTimeout(this.outroTimer); this.outroTimer = null; }
        if (this.healthCheckTimer) { clearInterval(this.healthCheckTimer); this.healthCheckTimer = null; }
        if (this._bpmInterval) { clearInterval(this._bpmInterval); this._bpmInterval = null; }
        if (this._planTimeouts) { this._planTimeouts.forEach(function(id) { clearTimeout(id); }); this._planTimeouts = []; }
        if (this._phraseTimeouts) { this._phraseTimeouts.forEach(function(id) { clearTimeout(id); }); this._phraseTimeouts = []; }

        // Reset MK1
        MK1.sequencer.stop();
        MK1.sequencer.clearAll();
        MK1.synth.stop();
        MK1.fx.setReverb(0);
        MK1.fx.setDelay(0);
        MK1.fx.setFilter(0.5);
        if (MK1.fx.setDistortion) MK1.fx.setDistortion(0);
        if (MK1.fx.setChorus) MK1.fx.setChorus(0);
        if (MK1.fx.setCrush) MK1.fx.setCrush(0);
        MK1.tempo.setBPM(120);

        // Track final state time
        var timeInState = (Date.now() - this.stateStartTime) / 1000;
        if (this.stateTimeSpent) {
            this.stateTimeSpent[this.currentState] = (this.stateTimeSpent[this.currentState] || 0) + timeInState;
        }

        // Calculate session reward
        var sessionReward = this._calculateSessionReward();
        console.log('n0body: session reward = ' + sessionReward.toFixed(2));

        // LEARN FROM SESSION
        this._learnBPM(sessionReward);
        this._learnScale(sessionReward);
        this._learnSynth(sessionReward);
        this._learnEnergy(sessionReward);

        // Learn state durations
        var self = this;
        ['intro', 'buildup', 'peak', 'breakdown', 'outro'].forEach(function(state) {
            if (self.stateTimeSpent && self.stateTimeSpent[state] > 0) {
                self._learnStateDuration(state, self.stateTimeSpent[state], sessionReward);
            }
        });

        // Learn grooves — which patterns worked in which context
        this._learnGrooves(sessionReward);

        // Learn mid-session changes
        this._learnBPMChanges(sessionReward);
        this._learnScaleChanges(sessionReward);

        // Update meta stats
        var elapsed = Date.now() - this.sessionStart;
        this.knowledge.totalPlayTime += elapsed / 1000 / 60;
        this.knowledge.sessionsPlayed++;

        // Add to session history (keep last 50)
        if (!this.knowledge.sessionHistory) this.knowledge.sessionHistory = [];
        this.knowledge.sessionHistory.push({
            date: new Date().toISOString(),
            duration: elapsed / 1000 / 60,
            reward: sessionReward,
            mood: this.currentMood,
            scale: this.currentScaleName,
            bpm: this.currentBPM,
            transitions: this.stats.stateTransitions,
            bpmChanges: this.bpmChangesThisSession || 0,
            scaleChanges: this.scaleChangesThisSession || 0,
        });
        if (this.knowledge.sessionHistory.length > 50) {
            this.knowledge.sessionHistory.shift();
        }

        // Save and verify
        var saved = saveKnowledge(this.knowledge);
        if (saved) {
            console.log('n0body: knowledge saved - now ' + this.knowledge.sessionsPlayed + ' sessions, ' + Math.round(this.knowledge.totalPlayTime) + ' min total');
        } else {
            console.error('n0body: FAILED to save knowledge!');
        }

        console.log('n0body: session ended (' + formatTimeHMS(elapsed) + ')');
        console.log('n0body: transitions=' + this.stats.stateTransitions + ' drums=' + this.stats.drumsPlayed + ' synth=' + this.stats.synthNotesPlayed);
        console.log('');
    };

    // ========== ORGANIC TRANSITIONS ==========
    N0body.prototype._checkStateTransition = function() {
        if (this.isEnding) return;

        var timeInState = (Date.now() - this.stateStartTime) / 1000;
        var stateConfig = this.stateTransitions[this.currentState];
        if (!stateConfig || !stateConfig.transitions) return;

        // Use learned duration preferences (falls back to static config)
        var learnedDuration = this._getStateDuration(this.currentState);
        var minDur = stateConfig.minDuration;
        var maxDur = Math.max(stateConfig.minDuration + 1, learnedDuration);

        // Check for director-forced next state
        if (this._forcedNextState && timeInState >= minDur * 0.5) {
            var forcedState = this._forcedNextState;
            this._forcedNextState = null;
            console.log('n0body: ' + this.currentState + ' -> ' + forcedState + ' (director forced, ' + Math.round(timeInState) + 's)');
            this._transitionTo(forcedState);
            return;
        }

        if (timeInState < minDur) return;

        var mustTransition = timeInState >= stateConfig.maxDuration;
        var checkChance = mustTransition ? 1.0 : Math.min(0.4, (timeInState - minDur) / maxDur);

        if (Math.random() > checkChance) return;

        var adjusted = this._adjustTransitionsWithLearning(stateConfig.transitions);
        var nextState = weightedChoice(adjusted);

        if (nextState && nextState !== this.currentState) {
            console.log('n0body: ' + this.currentState + ' -> ' + nextState + ' (' + Math.round(timeInState) + 's)');
            this._transitionTo(nextState);
        }
    };

    N0body.prototype._transitionTo = function(newState) {
        var oldState = this.currentState;
        var transitionKey = oldState + '_to_' + newState;
        var reward = this._evaluateStateReward();
        this._learnTransition(transitionKey, reward);

        // Track time spent in previous state
        var timeInState = (Date.now() - this.stateStartTime) / 1000;
        if (this.stateTimeSpent) {
            this.stateTimeSpent[this.currentState] = (this.stateTimeSpent[this.currentState] || 0) + timeInState;
        }

        this.currentState = newState;
        this.stateStartTime = Date.now();
        this.stats.stateTransitions++;
        this._onStateChange(newState);

        // Track for director context
        this._trackAction({ type: 'transition', from: oldState, to: newState, timeInState: timeInState });

        // Track transition quality for musical feedback
        if (!this._transitionHistory) this._transitionHistory = [];
        this._transitionHistory.push({
            from: oldState, to: newState, timeInState: timeInState,
            smooth: reward >= 1.0  // smooth if reward was positive
        });
        if (this._transitionHistory.length > 20) this._transitionHistory.shift();
    };

    N0body.prototype._adjustTransitionsWithLearning = function(transitions) {
        var adjusted = {};
        var self = this;

        for (var nextState in transitions) {
            if (!transitions.hasOwnProperty(nextState)) continue;
            var baseProbability = transitions[nextState];
            var key = self.currentState + '_to_' + nextState;
            var learned = self.knowledge.transitionSuccess && self.knowledge.transitionSuccess[key];

            if (learned && learned.count > 5) {
                var modifier = Math.pow(learned.avgReward, 0.3);
                adjusted[nextState] = baseProbability * clamp(modifier, 0.5, 2.0);
            } else {
                adjusted[nextState] = baseProbability;
            }
        }

        var total = 0;
        for (var k in adjusted) { if (adjusted.hasOwnProperty(k)) total += adjusted[k]; }
        if (total > 0) {
            for (var k2 in adjusted) { if (adjusted.hasOwnProperty(k2)) adjusted[k2] /= total; }
        }

        return adjusted;
    };

    N0body.prototype._evaluateStateReward = function() {
        var recent = this.shortTermMemory.actions.slice(-20);
        if (recent.length < 5) return 1.0;

        var reward = 1.0;
        var types = {};
        recent.forEach(function(a) { types[a.type] = true; });
        reward += (Object.keys(types).length - 2) * 0.2;

        return clamp(reward, 0.5, 2.0);
    };

    N0body.prototype._learnTransition = function(transitionKey, reward) {
        if (!this.knowledge.transitionSuccess) this.knowledge.transitionSuccess = {};
        if (!this.knowledge.transitionSuccess[transitionKey]) {
            this.knowledge.transitionSuccess[transitionKey] = { count: 0, avgReward: 1.0 };
        }
        var ts = this.knowledge.transitionSuccess[transitionKey];
        ts.avgReward = (ts.avgReward * ts.count + reward) / (ts.count + 1);
        ts.count++;
    };

    // ========== LEARNING ==========
    N0body.prototype._learn = function(action) {
        var contextualAction = { type: action.type, pad: action.pad, note: action.note, param: action.param, value: action.value, context: { state: this.currentState, bpm: this.currentBPM, scale: this.currentScaleName, mood: this.currentMood } };
        this.shortTermMemory.add(contextualAction);
        var recentActions = this.shortTermMemory.getRecent(10);
        var reward = evaluateReward(recentActions);
        var lr = getLearningRate(this.knowledge.sessionsPlayed);
        this._updatePreferences(action, reward, lr);
        this._learnCombos(reward, lr);
    };

    N0body.prototype._updatePreferences = function(action, reward, lr) {
        var state = this.currentState;
        var self = this;

        if (action.type === 'drum') {
            if (!this.knowledge.drums[state]) this.knowledge.drums[state] = {};
            var current = this.knowledge.drums[state][action.pad] || 1.0;
            this.knowledge.drums[state][action.pad] = clamp(current + (reward * lr), 0.1, 5.0);
        }

        if (action.type === 'synth' && action.note) {
            var key = this.currentScaleName + '_' + state;
            if (!this.knowledge.notes[key]) {
                this.knowledge.notes[key] = {};
                this.currentScale.forEach(function(note) { self.knowledge.notes[key][note] = 1.0; });
            }
            var currentNote = this.knowledge.notes[key][action.note] || 1.0;
            this.knowledge.notes[key][action.note] = clamp(currentNote + (reward * lr), 0.1, 5.0);
        }

        if (action.type === 'fx' && action.param && action.value !== undefined) {
            if (!this.knowledge.fx[state]) this.knowledge.fx[state] = {};
            if (!this.knowledge.fx[state][action.param]) {
                this.knowledge.fx[state][action.param] = { preferred: action.value, variance: 0.15 };
            }
            var fxState = this.knowledge.fx[state][action.param];
            if (reward > 0) {
                fxState.preferred = fxState.preferred * 0.9 + action.value * 0.1;
            }
        }
    };

    N0body.prototype._learnCombos = function(reward, lr) {
        var recent = this.shortTermMemory.getRecent(3);
        if (recent.length < 3) return;
        var comboKey = recent.map(function(a) { return a.type === 'drum' ? 'drum' + a.pad : a.type; }).join('+');
        if (!this.knowledge.combos[comboKey]) this.knowledge.combos[comboKey] = { score: 1.0, count: 0 };
        var combo = this.knowledge.combos[comboKey];
        combo.score = clamp(combo.score + (reward * lr), 0.1, 5.0);
        combo.count++;
    };

    // ========== DECISION MAKING ==========
    N0body.prototype._chooseDrumPad = function() {
        var state = this.currentState;
        var stateConf = this.stateConfig[state];
        var padWeights = stateConf.drums.padWeights;
        var learned = this.knowledge.drums[state] || {};

        // Exploration: random from pads with non-zero weight
        if (Math.random() < this.getExplorationRate()) {
            var availablePads = [];
            for (var p = 1; p <= 8; p++) {
                if (padWeights[p] > 0) availablePads.push(p);
            }
            return availablePads.length > 0 ? randomFrom(availablePads) : 1;
        }

        // Exploitation: combine base weights with learned preferences
        var combined = {};
        for (var pad = 1; pad <= 8; pad++) {
            var baseWeight = padWeights[pad] || 0;
            var learnedWeight = learned[pad] || 1.0;
            combined[pad] = baseWeight * learnedWeight;
        }

        return weightedChoice(combined);
    };

    N0body.prototype._chooseSynthNote = function() {
        var scale = this.currentScale;

        // Melodic movement - stepwise, not random
        if (this.lastNote) {
            var lastIndex = scale.indexOf(this.lastNote);
            if (lastIndex !== -1) {
                // Favor small steps: -2, -1, -1, 0, 0, 1, 1, 2
                var steps = [-2, -1, -1, 0, 0, 1, 1, 2];
                var step = randomFrom(steps);
                var newIndex = Math.max(0, Math.min(scale.length - 1, lastIndex + step));
                this.lastNote = scale[newIndex];
                return this.lastNote;
            }
        }

        // First note: random start in middle third of scale
        var midStart = Math.floor(scale.length * 0.33);
        var midEnd = Math.floor(scale.length * 0.67);
        this.lastNote = scale[randomIntBetween(midStart, midEnd)];
        return this.lastNote;
    };

    N0body.prototype._chooseFxValue = function(param) {
        var state = this.currentState;
        var fxPref = this.knowledge.fx[state] && this.knowledge.fx[state][param];
        if (!fxPref) {
            var range = this.stateConfig[state].fx && this.stateConfig[state].fx[param];
            if (!range) return 0.5;
            return randomBetween(range.min, range.max);
        }
        var value = fxPref.preferred + (Math.random() - 0.5) * fxPref.variance * 2;
        return clamp(value, 0, 1);
    };

    N0body.prototype._chooseBPM = function() {
        var bpmPref = this.knowledge.bpm && this.knowledge.bpm[this.currentMood];
        if (!bpmPref) return Math.round(randomBetween(this.config.tempo.bpm.min, this.config.tempo.bpm.max));

        // Exploration vs exploitation
        if (Math.random() < this.getExplorationRate()) {
            // Explore: random BPM in valid range
            return Math.round(randomBetween(this.config.tempo.bpm.min, this.config.tempo.bpm.max));
        }

        // Exploit: use learned preference with variance
        // Variance decreases with experience (more confident style)
        var experienceFactor = Math.max(0.5, 1 - (this.knowledge.sessionsPlayed / 100));
        var effectiveVariance = bpmPref.variance * experienceFactor;
        var bpm = bpmPref.preferred + (Math.random() - 0.5) * effectiveVariance * 2;
        return Math.round(clamp(bpm, this.config.tempo.bpm.min, this.config.tempo.bpm.max));
    };

    N0body.prototype._learnBPM = function(sessionReward) {
        var mood = this.currentMood;
        if (!mood || !this.knowledge.bpm[mood]) return;

        var bpmPref = this.knowledge.bpm[mood];
        var lr = getLearningRate(this.knowledge.sessionsPlayed);

        // Add to history (keep last 20)
        bpmPref.history = bpmPref.history || [];
        bpmPref.history.push({ bpm: this.currentBPM, reward: sessionReward });
        if (bpmPref.history.length > 20) bpmPref.history.shift();

        // If session was good, move preferred toward this BPM
        if (sessionReward > 0.5) {
            bpmPref.preferred = bpmPref.preferred + (this.currentBPM - bpmPref.preferred) * lr * sessionReward;
            // Reduce variance gradually (more confident over time)
            bpmPref.variance = this.reduceVariance(bpmPref.variance, 5);
        } else if (sessionReward < -0.5) {
            // Bad session: slight increase in variance to explore more
            bpmPref.variance = Math.min(20, bpmPref.variance * 1.02);
        }
    };

    // ========== INIT ==========
    N0body.prototype._initSession = function() {
        this.currentMood = randomFrom(['dark', 'neutral', 'bright']);
        this.currentScaleName = this._chooseScale();
        this.currentScale = this.scales[this.currentScaleName];
        console.log('n0body: mood=' + this.currentMood + ' scale=' + this.currentScaleName);

        this.currentBPM = this._chooseBPM();
        MK1.tempo.setBPM(this.currentBPM);
        console.log('n0body: BPM=' + this.currentBPM);

        this.currentWaveform = this._chooseWaveform();
        MK1.synth.setWaveform(this.currentWaveform);

        // Initialize session energy tracking
        this.sessionEnergy = { intro: 0, buildup: 0, peak: 0, breakdown: 0, outro: 0 };
        this.stateTimeSpent = { intro: 0, buildup: 0, peak: 0, breakdown: 0, outro: 0 };

        // Mid-session change tracking
        this.bpmChangesThisSession = 0;
        this.scaleChangesThisSession = 0;
        this.lastBPMChangeTime = 0;
        this.previousState = null;

        this._applyAllFx();
        MK1.master.setVolume(0.7);
        MK1.sequencer.clearAll();

        this.currentState = 'intro';
        this.stateStartTime = Date.now();
    };

    N0body.prototype._chooseScale = function() {
        var scaleNames = this.scaleMoods[this.currentMood];
        var self = this;

        // Exploration vs exploitation
        if (Math.random() < this.getExplorationRate()) {
            return randomFrom(scaleNames);
        }

        // Build weights from learned preferences
        var scaleWeights = {};
        scaleNames.forEach(function(name) {
            var scalePref = self.knowledge.scales && self.knowledge.scales[name];
            scaleWeights[name] = scalePref ? scalePref.weight : 1.0;
        });

        return weightedChoice(scaleWeights);
    };

    N0body.prototype._learnScale = function(sessionReward) {
        if (!this.currentScaleName || !this.knowledge.scales[this.currentScaleName]) return;

        var scalePref = this.knowledge.scales[this.currentScaleName];
        var lr = getLearningRate(this.knowledge.sessionsPlayed);

        scalePref.sessions++;

        // Adjust weight based on session reward
        if (sessionReward > 0) {
            scalePref.weight = Math.min(3.0, scalePref.weight + lr * sessionReward);
        } else {
            scalePref.weight = Math.max(0.3, scalePref.weight + lr * sessionReward);
        }
    };

    // ========== SYNTH LEARNING ==========
    N0body.prototype._chooseWaveform = function() {
        var waveformPref = this.knowledge.synth && this.knowledge.synth.waveforms;
        if (!waveformPref) return randomFrom(this.config.waveforms);

        // Exploration vs exploitation
        if (Math.random() < this.getExplorationRate()) {
            return randomFrom(this.config.waveforms);
        }

        return weightedChoice(waveformPref);
    };

    N0body.prototype._learnSynth = function(sessionReward) {
        if (!this.currentWaveform || !this.knowledge.synth) return;

        var lr = getLearningRate(this.knowledge.sessionsPlayed);

        // Learn waveform preference
        if (this.knowledge.synth.waveforms[this.currentWaveform] !== undefined) {
            if (sessionReward > 0) {
                this.knowledge.synth.waveforms[this.currentWaveform] = Math.min(3.0,
                    this.knowledge.synth.waveforms[this.currentWaveform] + lr * sessionReward);
            } else {
                this.knowledge.synth.waveforms[this.currentWaveform] = Math.max(0.3,
                    this.knowledge.synth.waveforms[this.currentWaveform] + lr * sessionReward);
            }
        }
    };

    // ========== STATE DURATION LEARNING ==========
    N0body.prototype._getStateDuration = function(state) {
        var durPref = this.knowledge.stateDurations && this.knowledge.stateDurations[state];
        if (!durPref) {
            var fallback = this.stateTransitions[state];
            return randomBetween(fallback.minDuration, fallback.maxDuration);
        }

        // Exploration vs exploitation
        if (Math.random() < this.getExplorationRate()) {
            return randomBetween(durPref.min, durPref.max);
        }

        // Use learned preference with variance (decreases with experience)
        var experienceFactor = Math.max(0.5, 1 - (this.knowledge.sessionsPlayed / 100));
        var effectiveVariance = durPref.variance * experienceFactor;
        var duration = durPref.preferred + (Math.random() - 0.5) * effectiveVariance * 2;
        return clamp(duration, durPref.min, durPref.max);
    };

    N0body.prototype._learnStateDuration = function(state, actualDuration, reward) {
        if (!state || !this.knowledge.stateDurations || !this.knowledge.stateDurations[state]) return;

        var durPref = this.knowledge.stateDurations[state];
        var lr = getLearningRate(this.knowledge.sessionsPlayed);

        // If good reward, move preferred toward actual duration
        if (reward > 0.5) {
            durPref.preferred = durPref.preferred + (actualDuration - durPref.preferred) * lr * reward;
            // Reduce variance gradually (more confident over time)
            durPref.variance = this.reduceVariance(durPref.variance, 10);
        } else if (reward < -0.5) {
            // Bad: slight increase in variance to explore more
            durPref.variance = Math.min(durPref.max - durPref.min, durPref.variance * 1.02);
        }
    };

    // ========== LEARNING: MID-SESSION CHANGES ==========
    N0body.prototype._learnBPMChanges = function(sessionReward) {
        if (!this.pendingBPMChange || this.pendingBPMChange.length === 0) return;

        if (!this.knowledge.bpmChanges) {
            this.knowledge.bpmChanges = {};
        }

        var self = this;
        this.pendingBPMChange.forEach(function(change) {
            var key = 'bpm_' + change.direction + '_' + change.state;

            if (!self.knowledge.bpmChanges[key]) {
                self.knowledge.bpmChanges[key] = { count: 0, avgReward: 1.0 };
            }

            var entry = self.knowledge.bpmChanges[key];
            entry.avgReward = (entry.avgReward * entry.count + sessionReward) / (entry.count + 1);
            entry.count++;
        });

        this.pendingBPMChange = [];
    };

    N0body.prototype._learnScaleChanges = function(sessionReward) {
        if (!this.pendingScaleChange || this.pendingScaleChange.length === 0) return;

        if (!this.knowledge.scaleChanges) {
            this.knowledge.scaleChanges = {};
        }

        var self = this;
        this.pendingScaleChange.forEach(function(change) {
            var key = change.oldScale + '_to_' + change.newScale;

            if (!self.knowledge.scaleChanges[key]) {
                self.knowledge.scaleChanges[key] = { count: 0, avgReward: 1.0 };
            }

            var entry = self.knowledge.scaleChanges[key];
            entry.avgReward = (entry.avgReward * entry.count + sessionReward) / (entry.count + 1);
            entry.count++;
        });

        this.pendingScaleChange = [];
    };

    // ========== GROOVE LEARNING ==========
    // Like a sesionista reviewing their session: "that groove in peak worked, keep it"

    // Called during _tick to record what groove is playing and how it feels
    N0body.prototype._trackGrooveReward = function() {
        if (!this._currentGroove || !this._currentGrooveContext) return;

        // Accumulate reward while this groove is active
        var recentActions = this.shortTermMemory.getRecent(10);
        var reward = evaluateReward(recentActions);

        if (!this._grooveRewards) this._grooveRewards = [];
        this._grooveRewards.push({
            groove: this._currentGroove,
            context: this._currentGrooveContext,
            reward: reward,
        });
    };

    // Called at session end — save what worked, reject what didn't
    N0body.prototype._learnGrooves = function(sessionReward) {
        if (!this._grooveRewards || this._grooveRewards.length === 0) return;

        // Group rewards by groove+context
        var grouped = {};
        var self = this;
        this._grooveRewards.forEach(function(entry) {
            var key = entry.context + '::' + self._grooveKey(entry.groove);
            if (!grouped[key]) {
                grouped[key] = { groove: entry.groove, context: entry.context, rewards: [] };
            }
            grouped[key].rewards.push(entry.reward);
        });

        // Process each groove
        for (var key in grouped) {
            if (!grouped.hasOwnProperty(key)) continue;
            var g = grouped[key];

            // Average reward for this groove in this context
            var avgReward = g.rewards.reduce(function(a, b) { return a + b; }, 0) / g.rewards.length;
            // Weight session reward in (was the overall session good?)
            var combinedReward = avgReward * 0.6 + sessionReward * 0.4;

            var contextKey = g.context;
            if (!this.knowledge.grooveMemory[contextKey]) {
                this.knowledge.grooveMemory[contextKey] = [];
            }

            var memory = this.knowledge.grooveMemory[contextKey];
            var grooveKey = this._grooveKey(g.groove);

            // Find if we already know this groove
            var existing = null;
            for (var i = 0; i < memory.length; i++) {
                if (this._grooveKey(memory[i].pattern) === grooveKey) {
                    existing = memory[i];
                    break;
                }
            }

            if (existing) {
                // Update running average
                existing.reward = (existing.reward * existing.count + combinedReward) / (existing.count + 1);
                existing.count++;
            } else {
                // New groove — remember it
                memory.push({
                    pattern: g.groove,
                    reward: combinedReward,
                    count: 1,
                });
            }

            // Reject grooves that consistently score poorly (count > 3 and reward < -0.3)
            if (existing && existing.count > 3 && existing.reward < -0.3) {
                if (!this.knowledge.grooveRejected) this.knowledge.grooveRejected = [];
                if (this.knowledge.grooveRejected.indexOf(grooveKey) === -1) {
                    this.knowledge.grooveRejected.push(grooveKey);
                    console.log('n0body: rejected groove in ' + contextKey + ' (reward: ' + existing.reward.toFixed(2) + ')');
                    // Keep rejected list bounded
                    if (this.knowledge.grooveRejected.length > 50) {
                        this.knowledge.grooveRejected.shift();
                    }
                }
            }

            // Keep memory bounded — keep top 20 grooves per context
            if (memory.length > 20) {
                memory.sort(function(a, b) { return b.reward - a.reward; });
                memory.length = 20;
            }
        }

        var totalLearned = 0;
        for (var ctx in this.knowledge.grooveMemory) {
            totalLearned += this.knowledge.grooveMemory[ctx].length;
        }
        console.log('n0body: groove memory — ' + totalLearned + ' patterns across ' +
            Object.keys(this.knowledge.grooveMemory).length + ' contexts');

        this._grooveRewards = [];
    };

    // ========== ENERGY TRACKING ==========
    N0body.prototype._trackEnergy = function(actionType) {
        if (!this.sessionEnergy) return;

        var energyDelta = 0;
        switch (actionType) {
            case 'drum': energyDelta = 0.3; break;
            case 'synth': energyDelta = 0.15; break;
            case 'sequencer': energyDelta = 0.1; break;
            case 'fx': energyDelta = 0.05; break;
            case 'rest': energyDelta = -0.1; break;
        }

        var state = this.currentState;
        this.sessionEnergy[state] = clamp((this.sessionEnergy[state] || 0) + energyDelta, 0, 1);

        // Track energy over time for musical feedback metrics
        if (!this._energyHistory) this._energyHistory = [];
        this._energyHistory.push(this.sessionEnergy[state]);
        if (this._energyHistory.length > 50) this._energyHistory.shift();
    };

    N0body.prototype._learnEnergy = function(sessionReward) {
        if (!this.sessionEnergy || !this.stateTimeSpent) return;

        var lr = getLearningRate(this.knowledge.sessionsPlayed);
        var self = this;

        ['intro', 'buildup', 'peak', 'breakdown', 'outro'].forEach(function(state) {
            if (self.stateTimeSpent[state] > 10 && sessionReward > 0.5) {
                var avgEnergy = self.sessionEnergy[state] / Math.max(1, self.stateTimeSpent[state] / 60);
                var energyPref = self.knowledge.energy[state];
                if (energyPref) {
                    energyPref.target = energyPref.target + (avgEnergy - energyPref.target) * lr * sessionReward;
                }
            }
        });
    };

    // ========== SESSION REWARD CALCULATION ==========
    N0body.prototype._calculateSessionReward = function() {
        var elapsed = (Date.now() - this.sessionStart) / 1000 / 60; // minutes
        var reward = 0;

        // Session length reward (longer = better, up to a point)
        if (elapsed >= 5) reward += 0.3;
        if (elapsed >= 15) reward += 0.3;
        if (elapsed >= 30) reward += 0.2;
        if (elapsed >= 60) reward += 0.2;

        // Variety reward (used multiple states)
        var statesVisited = 0;
        var self = this;
        ['intro', 'buildup', 'peak', 'breakdown'].forEach(function(state) {
            if (self.stateTimeSpent && self.stateTimeSpent[state] > 10) statesVisited++;
        });
        if (statesVisited >= 3) reward += 0.3;
        if (statesVisited >= 4) reward += 0.2;

        // Transitions reward
        if (this.stats.stateTransitions >= 3) reward += 0.2;
        if (this.stats.stateTransitions >= 6) reward += 0.2;

        // Penalize very short sessions (user stopped early = bad)
        if (elapsed < 2) reward -= 0.5;
        if (elapsed < 1) reward -= 0.5;

        return clamp(reward, -1, 2);
    };

    // ========== LOOPS ==========
    N0body.prototype._startLoops = function() {
        var self = this;
        this.mainLoop = setInterval(function() { self._tick(); }, 200);
        this._scheduleSynth();
        this._scheduleFxChange();
        this.transitionCheckTimer = setInterval(function() { self._checkStateTransition(); }, this.config.session.transitionCheckInterval * 1000);

        // Audio health monitoring - check every 60 seconds
        this.healthCheckTimer = setInterval(function() { self._checkAudioHealth(); }, 60000);
    };

    // ========== AUDIO HEALTH MONITORING ==========
    N0body.prototype._checkAudioHealth = function() {
        if (!this.isPlaying) return;
        if (typeof MK1 === 'undefined' || !MK1.utils || !MK1.utils.getHealth) return;

        var health = MK1.utils.getHealth();
        var elapsed = Math.round((Date.now() - this.sessionStart) / 1000 / 60);

        console.log('n0body: health check @' + elapsed + 'min - voices: ' + health.activeDrumVoices + 'd/' + health.activeSynthVoices + 's, ctx: ' + health.contextState);

        if (!health.healthy) {
            console.warn('n0body: audio unhealthy! attempting recovery...');
            this._attemptAudioRecovery();
        }
    };

    N0body.prototype._attemptAudioRecovery = function() {
        if (typeof MK1 === 'undefined' || !MK1.utils) return;

        // First try to resume the context
        if (MK1.utils.resume) {
            MK1.utils.resume();
            console.log('n0body: called MK1.utils.resume()');
        }

        // Check again after a short delay
        var self = this;
        setTimeout(function() {
            if (!MK1.utils.getHealth) return;
            var health = MK1.utils.getHealth();

            if (!health.healthy && MK1.utils.forceCleanup) {
                console.warn('n0body: still unhealthy, forcing cleanup...');
                MK1.utils.forceCleanup();
            }
        }, 1000);
    };

    N0body.prototype._tick = function() {
        if (!this.isPlaying) return;

        // Apply pending director directives
        if (this.director) {
            this.director.applyNextDirective();
        }

        // Check LLM for artistic direction
        if (this.llm) {
            this.llm.maybeConsult();
        }

        // Track groove quality every ~5 seconds (every 25 ticks at 200ms)
        if (!this._grooveTrackCounter) this._grooveTrackCounter = 0;
        this._grooveTrackCounter++;
        if (this._grooveTrackCounter >= 25) {
            this._grooveTrackCounter = 0;
            this._trackGrooveReward();
        }

        // Check for silence directive
        if (this._silenceUntil && Date.now() < this._silenceUntil) {
            return;
        }

        // REST - let the base breathe
        // _energyModifier (0-1): low energy = more rest, high energy = less rest
        // supervisor density reduction adds +0.15 rest
        var restChance = this.restProbability[this.currentState] || 0.6;
        if (this._energyModifier !== undefined) {
            // energy 0 → +0.2 rest, energy 0.5 → no change, energy 1.0 → -0.2 rest
            restChance += (0.5 - this._energyModifier) * 0.4;
        }
        if (this._supervisorDensityReduced) {
            restChance = Math.min(0.95, restChance + 0.15);
        }
        restChance = Math.max(0.1, Math.min(0.95, restChance));
        if (Math.random() < restChance) {
            this._trackEnergy('rest');
            return;
        }

        // Supervisor voice limit — skip sound-producing actions when at capacity
        if (this._supervisorMaxVoices !== undefined) {
            var voiceCount = this._estimateActiveVoices();
            if (voiceCount >= this._supervisorMaxVoices) {
                this._maybeModifySequencer();
                return;
            }
        }

        // OPTIMIZATION: Only 1 action per tick to prevent audio overload
        // Weighted random selection: drums most likely, then sequencer, then occasional BPM/waveform
        var roll = Math.random();
        if (roll < 0.70) {
            this._maybePlayDrum();
        } else if (roll < 0.85) {
            this._maybeModifySequencer();
        } else if (roll < 0.95) {
            this._maybeChangeBPM();
        } else {
            this._maybeChangeWaveform();
        }
    };

    N0body.prototype._estimateActiveVoices = function() {
        if (typeof MK1 !== 'undefined' && MK1.utils && MK1.utils.getHealth) {
            var health = MK1.utils.getHealth();
            if (health) return (health.activeDrumVoices || 0) + (health.activeSynthVoices || 0);
        }
        return 0;
    };

    N0body.prototype._onStateChange = function(newState) {
        // Maybe change scale on certain transitions
        this._maybeChangeScale(newState);

        // Cymbal crash on important transitions
        if (this.previousState) {
            var crashTransitions = ['buildup_to_peak', 'breakdown_to_buildup', 'breakdown_to_peak'];
            var transition = this.previousState + '_to_' + newState;
            if (crashTransitions.indexOf(transition) !== -1 && Math.random() < 0.7) {
                MK1.drums.hit(7);  // Cymbal crash
                console.log('n0body: crash on ' + transition);
            }
        }

        var stateConf = this.stateConfig[newState];
        if (stateConf.sequencer.active) { if (!MK1.sequencer.isPlaying()) MK1.sequencer.start(); }
        else { if (MK1.sequencer.isPlaying()) MK1.sequencer.stop(); }
        this._applyAllFx();

        // Reset phrase on state change — new state, new musical idea
        this._currentPhrase = null;
        this._phraseRepeats = 0;

        // In breakdown: stop sequencer — melody is the protagonist
        if (newState === 'breakdown') {
            if (MK1.sequencer.isPlaying()) MK1.sequencer.stop();
            // Clear sequencer pattern — silence the drums
            for (var t = 1; t <= 8; t++) {
                for (var s = 1; s <= 16; s++) {
                    MK1.sequencer.setStep(t, s, false);
                }
            }
            console.log('n0body: breakdown — drums out, synth takes over');
        }

        this.previousState = this.currentState;
    };

    // ========== MID-SESSION BPM CHANGES ==========
    N0body.prototype._maybeChangeBPM = function() {
        var state = this.currentState;
        var chance = this.config.bpmChangeChance[state];

        if (!chance || chance === 0) return;

        // Minimum 30 seconds between BPM changes
        if (Date.now() - this.lastBPMChangeTime < 30000) return;

        // Convert chance per minute to per-tick (tick is ~100ms)
        if (Math.random() > chance / 600) return;

        var currentBPM = this.currentBPM;

        // Direction based on state energy and learning
        var directionWeights = { up: 0.4, down: 0.4, stay: 0.2 };

        // Adjust based on learned preferences
        if (this.knowledge.bpmChanges) {
            var upKey = 'bpm_up_' + state;
            var downKey = 'bpm_down_' + state;
            var upLearned = this.knowledge.bpmChanges[upKey];
            var downLearned = this.knowledge.bpmChanges[downKey];

            if (upLearned && upLearned.count > 3) {
                directionWeights.up *= Math.pow(upLearned.avgReward, 0.5);
            }
            if (downLearned && downLearned.count > 3) {
                directionWeights.down *= Math.pow(downLearned.avgReward, 0.5);
            }
        }

        var direction = weightedChoice(directionWeights);
        if (direction === 'stay') return;

        // Gradual change: 1-4 BPM
        var change = randomBetween(1, 4);
        var newBPM = direction === 'up'
            ? Math.min(this.config.tempo.bpm.max, currentBPM + change)
            : Math.max(this.config.tempo.bpm.min, currentBPM - change);

        if (newBPM !== currentBPM) {
            this._transitionBPM(currentBPM, newBPM, 4000);
            console.log('n0body: BPM ' + currentBPM + ' -> ' + newBPM);
            this.bpmChangesThisSession++;
            this.lastBPMChangeTime = Date.now();

            // Store for learning at session end
            if (!this.pendingBPMChange) this.pendingBPMChange = [];
            this.pendingBPMChange.push({
                oldBPM: currentBPM,
                newBPM: newBPM,
                state: state,
                direction: direction,
                timestamp: Date.now()
            });
        }
    };

    N0body.prototype._transitionBPM = function(from, to, duration) {
        var self = this;
        var steps = 20;
        var stepDuration = duration / steps;
        var stepSize = (to - from) / steps;

        var current = from;
        var step = 0;

        // Clear any in-progress BPM transition before starting a new one
        if (this._bpmInterval) {
            clearInterval(this._bpmInterval);
            this._bpmInterval = null;
        }

        this._bpmInterval = setInterval(function() {
            step++;
            current += stepSize;
            MK1.tempo.setBPM(Math.round(current));

            if (step >= steps) {
                clearInterval(self._bpmInterval);
                self._bpmInterval = null;
                self.currentBPM = to;
            }
        }, stepDuration);
    };

    // ========== MID-SESSION WAVEFORM CHANGES ==========
    N0body.prototype._maybeChangeWaveform = function() {
        var state = this.currentState;
        var chance = this.config.waveformChangeChance[state];

        if (!chance || chance === 0) return;

        // Minimum 20 seconds between waveform changes
        if (Date.now() - (this.lastWaveformChangeTime || 0) < 20000) return;

        // Convert chance per minute to per-tick (tick is ~100ms)
        if (Math.random() > chance / 600) return;

        var currentWaveform = this.currentWaveform;
        var options = this.config.waveforms.filter(function(w) { return w !== currentWaveform; });

        if (options.length === 0) return;

        var newWaveform = randomFrom(options);
        this.currentWaveform = newWaveform;
        MK1.synth.setWaveform(newWaveform);
        this.lastWaveformChangeTime = Date.now();
        this.stats.waveformChanges++;

        console.log('n0body: waveform ' + currentWaveform + ' -> ' + newWaveform);

        // Track for learning
        this._learn({ type: 'waveform', waveform: newWaveform });
    };

    // ========== MID-SESSION SCALE CHANGES ==========
    N0body.prototype._maybeChangeScale = function(newState) {
        if (!this.previousState) return;

        // Only on certain transitions
        var validTransitions = ['intro_to_buildup', 'breakdown_to_buildup', 'breakdown_to_intro'];
        var transition = this.previousState + '_to_' + newState;

        if (validTransitions.indexOf(transition) === -1) return;

        // Check probability
        if (Math.random() > this.config.scaleChangeChance) return;

        // Get related scales
        var related = RELATED_SCALES[this.currentScaleName];
        if (!related || related.length === 0) return;

        // Weight by learned preferences
        var weightedRelated = {};
        var self = this;
        related.forEach(function(scale) {
            var scalePref = self.knowledge.scales && self.knowledge.scales[scale];
            weightedRelated[scale] = scalePref ? scalePref.weight : 1.0;
        });

        var newScale = weightedChoice(weightedRelated);

        if (newScale && newScale !== this.currentScaleName) {
            var oldScale = this.currentScaleName;
            console.log('n0body: scale ' + oldScale + ' -> ' + newScale);

            this.currentScaleName = newScale;
            this.currentScale = SCALES[newScale];
            this.lastNote = null;  // Reset for new scale
            this.scaleChangesThisSession++;

            // Store for learning at session end
            if (!this.pendingScaleChange) this.pendingScaleChange = [];
            this.pendingScaleChange.push({
                oldScale: oldScale,
                newScale: newScale,
                transition: transition,
                timestamp: Date.now()
            });
        }
    };

    N0body.prototype._maybePlayDrum = function() {
        // Throttle: minimum 100ms between drum hits
        var now = Date.now();
        if (this._lastDrumTime && now - this._lastDrumTime < 100) return;

        var stateConf = this.stateConfig[this.currentState];
        // Apply director density modifier and supervisor polyphony scale
        var probability = stateConf.drums.probability * (this._drumDensityModifier || 1.0) * (this._supervisorPolyphonyScale || 1.0);
        if (Math.random() < probability) {
            var pad = this._chooseDrumPad();
            MK1.drums.hit(pad);
            this._lastDrumTime = now;
            this.stats.drumsPlayed++;
            this._learn({ type: 'drum', pad: pad });
            this._trackEnergy('drum');
            this._trackAction({ type: 'drum', pad: pad });
        }
    };

    // ========== SYNTH: PHRASE-BASED, STATE-AWARE ==========
    // Like a real musician: generate a short phrase, repeat it, then move on.
    // Synth is silent in intro/outro. Enters in buildup. Stars in breakdown.

    N0body.prototype._scheduleSynth = function() {
        if (!this.isPlaying) return;
        var self = this;
        var beatMs = 60000 / (this.currentBPM || 120);
        var barMs = beatMs * 4;

        // Synth presence by state — not all states have synth
        // Like a real track: ~50% of the time has melody, ~50% is drums only
        switch (this.currentState) {
            case 'intro':
                // No synth in intro — drums establish the groove first
                this.synthTimer = setTimeout(function() { self._scheduleSynth(); }, barMs * 4);
                return;
            case 'outro':
                // Outro: one long sustained note every 4-8 bars, fading
                if (Math.random() < 0.15) {
                    var outroNote = this._chooseSynthNote();
                    MK1.synth.play(outroNote, randomBetween(2, 5));
                    this.stats.synthNotesPlayed++;
                    this._trackAction({ type: 'synth', note: outroNote, duration: 3 });
                }
                this.synthTimer = setTimeout(function() { self._scheduleSynth(); }, barMs * randomFrom([4, 4, 8, 8]));
                return;
        }

        // For buildup/peak/breakdown: play phrases, not single notes
        // Generate or repeat a phrase
        if (!this._currentPhrase || this._phraseRepeats >= this._phraseMaxRepeats) {
            this._generatePhrase();
        }

        // Play the next note in the current phrase
        this._playPhraseNote();
    };

    // Generate a new 2-4 note phrase that repeats for 4-16 bars
    N0body.prototype._generatePhrase = function() {
        var noteCount = randomIntBetween(2, 4);
        var notes = [];
        var stateConf = this.stateConfig[this.currentState];

        // Build the phrase using stepwise motion from current position
        for (var i = 0; i < noteCount; i++) {
            notes.push({
                note: this._chooseSynthNote(),
                duration: randomBetween(stateConf.synth.noteDuration.min, stateConf.synth.noteDuration.max),
            });
        }

        this._currentPhrase = notes;
        this._phraseIndex = 0;
        this._phraseRepeats = 0;

        // How long to repeat: shorter phrases repeat more
        // buildup: 4-8 bars, peak: 8-16 bars, breakdown: 4-8 bars
        switch (this.currentState) {
            case 'buildup':   this._phraseMaxRepeats = randomIntBetween(2, 4); break;
            case 'peak':      this._phraseMaxRepeats = randomIntBetween(4, 8); break;
            case 'breakdown': this._phraseMaxRepeats = randomIntBetween(2, 4); break;
            default:          this._phraseMaxRepeats = randomIntBetween(2, 4);
        }

        console.log('n0body: new phrase — ' + notes.length + ' notes, ' + this._phraseMaxRepeats + ' repeats (' + this.currentState + ')');
        this._trackPattern('phrase', { notes: notes.map(function(n) { return n.note; }), state: this.currentState });
    };

    // Play the next note in the current phrase, then schedule the next
    N0body.prototype._playPhraseNote = function() {
        if (!this.isPlaying || !this._currentPhrase) return;
        var self = this;
        var beatMs = 60000 / (this.currentBPM || 120);

        var phrase = this._currentPhrase;
        var noteData = phrase[this._phraseIndex];

        // Apply probability gate — in buildup, sometimes skip notes (phrase fading in)
        var playChance = 1.0;
        if (this.currentState === 'buildup') {
            playChance = 0.6 * (this._synthPresenceModifier || 1.0) * (this._supervisorPolyphonyScale || 1.0);
        } else {
            playChance = (this._synthPresenceModifier || 1.0) * (this._supervisorPolyphonyScale || 1.0);
        }

        if (Math.random() < playChance) {
            MK1.synth.play(noteData.note, noteData.duration);
            this.stats.synthNotesPlayed++;
            this._learn({ type: 'synth', note: noteData.note });
            this._trackEnergy('synth');
            this._trackAction({ type: 'synth', note: noteData.note, duration: noteData.duration });
        }

        // Advance phrase position
        this._phraseIndex++;
        if (this._phraseIndex >= phrase.length) {
            this._phraseIndex = 0;
            this._phraseRepeats++;
        }

        // Schedule next note on beat grid
        // Subdivisions per state: peak tighter, breakdown wider
        var subdivisions;
        switch (this.currentState) {
            case 'buildup':   subdivisions = [1, 1, 2, 2];       break;
            case 'peak':      subdivisions = [0.5, 1, 1, 1];     break;
            case 'breakdown': subdivisions = [1, 2, 2, 4];       break;
            default:          subdivisions = [1, 1, 2, 2];
        }

        var gridSpacing = beatMs * randomFrom(subdivisions);
        var humanized = gridSpacing + randomBetween(-this.config.humanize.timing, this.config.humanize.timing);

        this.synthTimer = setTimeout(function() { self._scheduleSynth(); }, Math.max(300, humanized));
    };

    N0body.prototype._maybeModifySequencer = function() {
        // Throttle: minimum 2s between sequencer changes (patterns are units, not steps)
        var now = Date.now();
        if (this._lastSeqTime && now - this._lastSeqTime < 2000) return;

        var stateConf = this.stateConfig[this.currentState];
        if (!stateConf.sequencer.active) return;

        // 15% chance: intentional mute/unmute as expressive gesture
        if (Math.random() < 0.15) {
            this._intentionalMute();
            this._lastSeqTime = now;
            return;
        }

        // 85% chance: apply a groove preset as a complete pattern
        this._applyGroovePreset();
        this._lastSeqTime = now;
        this.stats.sequencerChanges++;
        this._learn({ type: 'sequencer' });
    };

    // Choose and apply a groove — learned favorites first, presets as fallback
    // Like a sesionista: start by copying, develop favorites, mutate over time
    N0body.prototype._applyGroovePreset = function() {
        var state = this.currentState;
        var mood = this.currentMood || 'neutral';
        var contextKey = state + '_' + mood;
        var groove = null;

        // Check if this groove is rejected
        var self = this;
        function isRejected(g) {
            var rejected = self.knowledge.grooveRejected || [];
            var gKey = self._grooveKey(g);
            return rejected.indexOf(gKey) !== -1;
        }

        // PHASE 1: Try learned grooves (exploitation)
        var memory = this.knowledge.grooveMemory[contextKey];
        if (memory && memory.length > 0 && Math.random() >= this.getExplorationRate()) {
            // Weight by reward — favorites get picked more
            var weights = {};
            for (var i = 0; i < memory.length; i++) {
                var key = this._grooveKey(memory[i].pattern);
                if (!isRejected(memory[i].pattern)) {
                    weights[i] = Math.max(0.1, memory[i].reward);
                }
            }

            if (Object.keys(weights).length > 0) {
                var chosen = weightedChoice(weights);
                var learned = memory[parseInt(chosen)];

                // With experience, mutate favorites instead of playing verbatim
                if (this.knowledge.sessionsPlayed > 15 && Math.random() < 0.3) {
                    groove = this._mutateGroove(learned.pattern);
                    console.log('n0body: playing mutated groove (' + contextKey + ')');
                } else {
                    groove = learned.pattern;
                    console.log('n0body: playing learned groove (' + contextKey + ', reward: ' + learned.reward.toFixed(2) + ')');
                }
            }
        }

        // PHASE 2: Exploration — pick from presets or create variation
        if (!groove) {
            var presets = GROOVE_PRESETS[state];
            if (!presets || presets.length === 0) return;
            groove = JSON.parse(JSON.stringify(randomFrom(presets)));

            // Newborns (sessions < 10): play presets as-is (copying/imitation)
            // Learning (10-30): occasionally mutate a preset
            // Developing+ (30+): frequently mutate
            if (this.knowledge.sessionsPlayed > 30 && Math.random() < 0.4) {
                groove = this._mutateGroove(groove);
                console.log('n0body: exploring mutated preset (' + state + ')');
            } else if (this.knowledge.sessionsPlayed > 10 && Math.random() < 0.2) {
                groove = this._mutateGroove(groove);
                console.log('n0body: exploring variation (' + state + ')');
            }
        }

        // Apply the groove to the sequencer
        this._applyGrooveToSequencer(groove);

        // Track what we played for learning later
        this._currentGroove = groove;
        this._currentGrooveContext = contextKey;
        this._currentGrooveStartTime = Date.now();
        this._trackPattern('groove', groove);
    };

    // Apply a groove object to the MK1 sequencer
    N0body.prototype._applyGrooveToSequencer = function(groove) {
        for (var track in groove) {
            if (!groove.hasOwnProperty(track)) continue;
            var patternName = groove[track];
            var pattern = DRUM_PATTERNS[patternName];
            if (!pattern) continue;

            var trackNum = parseInt(track);
            for (var step = 0; step < 16; step++) {
                MK1.sequencer.setStep(trackNum, step + 1, pattern[step] === 1);
            }
        }
    };

    // Mutate a groove — change 1-2 elements, like a musician experimenting
    // "What if I swap the hat pattern?" "What if I add a rim?"
    N0body.prototype._mutateGroove = function(original) {
        var groove = JSON.parse(JSON.stringify(original));
        var mutations = randomIntBetween(1, 2);

        for (var m = 0; m < mutations; m++) {
            var roll = Math.random();

            if (roll < 0.4) {
                // Swap a track's pattern for a different one of the same instrument family
                var tracks = Object.keys(groove);
                if (tracks.length === 0) continue;
                var track = randomFrom(tracks);
                var trackNum = parseInt(track);
                var alternatives = this._getAlternativePatterns(trackNum);
                if (alternatives.length > 0) {
                    groove[track] = randomFrom(alternatives);
                }
            } else if (roll < 0.7) {
                // Add a track that wasn't there
                var missing = [1,2,3,6,8].filter(function(t) { return !groove[t]; });
                if (missing.length > 0) {
                    var newTrack = randomFrom(missing);
                    var patterns = this._getAlternativePatterns(newTrack);
                    if (patterns.length > 0) {
                        groove[newTrack] = randomFrom(patterns);
                    }
                }
            } else {
                // Remove a track (subtraction as composition)
                var removable = Object.keys(groove).filter(function(t) { return parseInt(t) !== 1; }); // never remove kick
                if (removable.length > 0) {
                    delete groove[randomFrom(removable)];
                }
            }
        }

        return groove;
    };

    // Get pattern alternatives appropriate for a given track number
    N0body.prototype._getAlternativePatterns = function(trackNum) {
        // mk-1 tracks: 1=kick, 2=snare, 3=hihat, 4=clap, 5=tom, 6=perc, 7=cymbal, 8=rim
        switch(trackNum) {
            case 1: return ['kick_four', 'kick_minimal', 'kick_syncopated', 'kick_broken'];
            case 2: return ['snare_backbeat', 'snare_offbeat', 'snare_sparse', 'silent'];
            case 3: return ['hat_eighth', 'hat_sixteenth', 'hat_offbeat', 'hat_sparse'];
            case 4: return ['snare_offbeat', 'perc_accent', 'silent'];
            case 5: return ['perc_accent', 'rim_ghost', 'silent'];
            case 6: return ['perc_accent', 'rim_ghost', 'silent'];
            case 7: return ['hat_sparse', 'silent'];
            case 8: return ['rim_ghost', 'perc_accent', 'silent'];
            default: return ['silent'];
        }
    };

    // Generate a string key for a groove (for dedup and rejection)
    N0body.prototype._grooveKey = function(groove) {
        var keys = Object.keys(groove).sort();
        return keys.map(function(k) { return k + ':' + groove[k]; }).join('|');
    };

    // Intentional subtraction — mute all tracks briefly, then restore
    // The silence creates tension; the return creates impact
    N0body.prototype._intentionalMute = function() {
        if (this._isMuted) return;

        var self = this;
        this._isMuted = true;

        // Mute: clear all active tracks
        for (var track = 1; track <= 8; track++) {
            for (var step = 1; step <= 16; step++) {
                MK1.sequencer.setStep(track, step, false);
            }
        }
        console.log('n0body: intentional mute — sustracción');

        // Restore after 2-8 beats (duration based on BPM)
        var beatMs = 60000 / (this.currentBPM || 120);
        var muteDuration = beatMs * randomIntBetween(2, 8);

        setTimeout(function() {
            self._isMuted = false;
            // Bring back a groove preset — the return is the impact
            self._applyGroovePreset();
            console.log('n0body: groove restored');
        }, muteDuration);
    };

    // ========== FX (all 6) ==========
    N0body.prototype._applyAllFx = function() {
        MK1.fx.setReverb(this._chooseFxValue('reverb'));
        MK1.fx.setDelay(this._chooseFxValue('delay'));
        MK1.fx.setFilter(this._chooseFxValue('filter'));
        if (MK1.fx.setDistortion) MK1.fx.setDistortion(this._chooseFxValue('distortion'));
        if (MK1.fx.setChorus) MK1.fx.setChorus(this._chooseFxValue('chorus'));
        if (MK1.fx.setCrush) MK1.fx.setCrush(this._chooseFxValue('crush'));
    };

    N0body.prototype._scheduleFxChange = function() {
        if (!this.isPlaying) return;
        var self = this;

        // Incremental changes - 15% toward target
        var fxParams = ['reverb', 'delay', 'filter', 'distortion', 'chorus', 'crush'];
        var setters = {
            reverb: function(v) { MK1.fx.setReverb(v); },
            delay: function(v) { MK1.fx.setDelay(v); },
            filter: function(v) { MK1.fx.setFilter(v); },
            distortion: function(v) { if (MK1.fx.setDistortion) MK1.fx.setDistortion(v); },
            chorus: function(v) { if (MK1.fx.setChorus) MK1.fx.setChorus(v); },
            crush: function(v) { if (MK1.fx.setCrush) MK1.fx.setCrush(v); }
        };

        for (var i = 0; i < fxParams.length; i++) {
            var param = fxParams[i];
            var current = this.currentFx[param];
            var target = this._chooseFxValue(param);
            // Move 15% toward target (smooth, incremental)
            var newValue = current + (target - current) * 0.15;
            this.currentFx[param] = newValue;
            setters[param](newValue);
        }

        this.stats.fxChanges++;

        this._learn({ type: 'fx', param: 'reverb', value: this.currentFx.reverb });
        this._learn({ type: 'fx', param: 'delay', value: this.currentFx.delay });
        this._learn({ type: 'fx', param: 'filter', value: this.currentFx.filter });

        // Slower FX changes: 45-90 seconds
        var nextChange = randomBetween(this.config.fxChangeInterval.min, this.config.fxChangeInterval.max);
        this.fxTimer = setTimeout(function() { self._scheduleFxChange(); }, nextChange);
    };

    // ========== STATUS ==========
    N0body.prototype.getStatus = function() {
        var elapsed = this.sessionStart ? Date.now() - this.sessionStart : 0;
        var timeInState = this.stateStartTime ? Date.now() - this.stateStartTime : 0;
        return {
            isPlaying: this.isPlaying,
            isEnding: this.isEnding,
            currentState: this.currentState,
            timeInState: Math.round(timeInState / 1000),
            elapsed: elapsed,
            elapsedFormatted: formatTimeHMS(elapsed),
            mood: this.currentMood,
            scale: this.currentScaleName,
            bpm: this.currentBPM,
            waveform: this.currentWaveform,
            stats: this.stats,
            bpmChanges: this.bpmChangesThisSession || 0,
            scaleChanges: this.scaleChangesThisSession || 0,
            experience: { sessions: this.knowledge.sessionsPlayed, totalMinutes: Math.round(this.knowledge.totalPlayTime), level: getLevel(this.knowledge.sessionsPlayed) }
        };
    };

    N0body.prototype.reset = function() {
        this.resetLearning();
    };

    N0body.prototype.resetLearning = function() {
        // Clear localStorage
        resetKnowledge();

        // Reset knowledge to fresh state
        this.knowledge = initKnowledge();

        // Clear short term memory
        this.shortTermMemory.clear();

        // Clear recent actions
        this.recentActions = [];

        // Clear any pending directives
        if (this.director) {
            this.director.pendingDirectives = [];
        }

        console.log('[n0body] Learning reset - new beginning');
        console.log('[n0body] All weights, rewards, and experience cleared');
        return true;
    };

    N0body.prototype.getKnowledge = function() { return this.knowledge; };

    // ========== DIRECTOR MODULE (LLM Interface) ==========
    N0body.prototype._initDirector = function() {
        var self = this;

        this.director = {
            // Get current context for LLM
            getContext: function() {
                return {
                    currentState: self.currentState,
                    currentMood: self.currentMood,
                    currentScale: self.currentScaleName,
                    currentBPM: self.currentBPM,
                    currentWaveform: self.currentWaveform,
                    sessionTime: self.sessionStart ? Math.round((Date.now() - self.sessionStart) / 1000) : 0,
                    timeInState: self.stateStartTime ? Math.round((Date.now() - self.stateStartTime) / 1000) : 0,
                    isPlaying: self.isPlaying,
                    stats: self.stats,
                    recentActions: self.recentActions.slice(-10)
                };
            },

            // Available directives for LLM to call
            directives: {
                setMood: function(mood) {
                    if (['dark', 'neutral', 'bright'].indexOf(mood) !== -1) {
                        self.currentMood = mood;
                        console.log('[n0body director] mood -> ' + mood);
                        return true;
                    }
                    return false;
                },

                setEnergy: function(level) {
                    // 0-100, affects global probabilities
                    var factor = clamp(level, 0, 100) / 100;
                    self._energyModifier = factor;
                    console.log('[n0body director] energy -> ' + level);
                    return true;
                },

                prepareTransition: function(targetState) {
                    var validStates = ['intro', 'buildup', 'peak', 'breakdown', 'outro'];
                    if (validStates.indexOf(targetState) !== -1) {
                        self._forcedNextState = targetState;
                        console.log('[n0body director] preparing transition to ' + targetState);
                        return true;
                    }
                    return false;
                },

                forceTransition: function(targetState) {
                    var validStates = ['intro', 'buildup', 'peak', 'breakdown', 'outro'];
                    if (validStates.indexOf(targetState) !== -1 && self.isPlaying) {
                        self._transitionTo(targetState);
                        console.log('[n0body director] forced transition to ' + targetState);
                        return true;
                    }
                    return false;
                },

                changeScale: function(scale) {
                    if (scale === 'related') {
                        var related = RELATED_SCALES[self.currentScaleName];
                        if (related && related.length > 0) {
                            var newScale = randomFrom(related);
                            self.currentScaleName = newScale;
                            self.currentScale = SCALES[newScale];
                            self.lastNote = null;
                            console.log('[n0body director] scale -> ' + newScale + ' (related)');
                            return true;
                        }
                    } else if (SCALES[scale]) {
                        self.currentScaleName = scale;
                        self.currentScale = SCALES[scale];
                        self.lastNote = null;
                        console.log('[n0body director] scale -> ' + scale);
                        return true;
                    }
                    return false;
                },

                changeWaveform: function(waveform) {
                    if (self.config.waveforms.indexOf(waveform) !== -1) {
                        self.currentWaveform = waveform;
                        if (typeof MK1 !== 'undefined') {
                            MK1.synth.setWaveform(waveform);
                        }
                        console.log('[n0body director] waveform -> ' + waveform);
                        return true;
                    }
                    return false;
                },

                adjustBPM: function(direction) {
                    var delta = 0;
                    if (direction === 'up') delta = randomBetween(2, 5);
                    else if (direction === 'down') delta = -randomBetween(2, 5);
                    else if (direction === 'stable') delta = 0;
                    else return false;

                    if (delta !== 0) {
                        var newBPM = clamp(self.currentBPM + delta, self.config.tempo.bpm.min, self.config.tempo.bpm.max);
                        self._transitionBPM(self.currentBPM, newBPM, 3000);
                        console.log('[n0body director] BPM ' + direction + ' -> ' + newBPM);
                    }
                    return true;
                },

                setDrumDensity: function(level) {
                    // 0-100, modifier for drum probability
                    self._drumDensityModifier = clamp(level, 0, 100) / 50; // 0-2x
                    console.log('[n0body director] drum density -> ' + level);
                    return true;
                },

                setSynthPresence: function(level) {
                    // 0-100, modifier for synth probability
                    self._synthPresenceModifier = clamp(level, 0, 100) / 50; // 0-2x
                    console.log('[n0body director] synth presence -> ' + level);
                    return true;
                },

                triggerMoment: function(type) {
                    if (!self.isPlaying) return false;

                    switch (type) {
                        case 'drop':
                            // Cymbal crash + immediate peak energy
                            if (typeof MK1 !== 'undefined') MK1.drums.hit(7);
                            self._energyModifier = 1.0;
                            console.log('[n0body director] triggered DROP');
                            return true;

                        case 'breakdown':
                            // Sudden reduction
                            self._energyModifier = 0.3;
                            console.log('[n0body director] triggered BREAKDOWN');
                            return true;

                        case 'build':
                            // Gradual increase
                            self._energyModifier = Math.min(1.0, (self._energyModifier || 0.5) + 0.2);
                            console.log('[n0body director] triggered BUILD');
                            return true;

                        case 'silence':
                            // Brief pause
                            self._silenceUntil = Date.now() + 2000;
                            console.log('[n0body director] triggered SILENCE');
                            return true;

                        default:
                            return false;
                    }
                },

                // ========== DIRECT MK-1 CONTROL ==========

                setFX: function(fxConfig) {
                    if (typeof MK1 === 'undefined') return false;
                    var applied = [];
                    if (fxConfig.reverb !== undefined) { MK1.fx.setReverb(clamp(fxConfig.reverb, 0, 1)); applied.push('reverb:' + fxConfig.reverb); }
                    if (fxConfig.delay !== undefined) { MK1.fx.setDelay(clamp(fxConfig.delay, 0, 1)); applied.push('delay:' + fxConfig.delay); }
                    if (fxConfig.filter !== undefined) { MK1.fx.setFilter(clamp(fxConfig.filter, 0, 1)); applied.push('filter:' + fxConfig.filter); }
                    if (fxConfig.distortion !== undefined && MK1.fx.setDistortion) { MK1.fx.setDistortion(clamp(fxConfig.distortion, 0, 1)); applied.push('dist:' + fxConfig.distortion); }
                    if (fxConfig.chorus !== undefined && MK1.fx.setChorus) { MK1.fx.setChorus(clamp(fxConfig.chorus, 0, 1)); applied.push('chorus:' + fxConfig.chorus); }
                    if (fxConfig.crush !== undefined && MK1.fx.setCrush) { MK1.fx.setCrush(clamp(fxConfig.crush, 0, 1)); applied.push('crush:' + fxConfig.crush); }
                    if (applied.length > 0) {
                        console.log('[n0body director] FX -> ' + applied.join(', '));
                        self._currentFX = fxConfig;
                        return true;
                    }
                    return false;
                },

                setDrumPattern: function(pattern) {
                    if (typeof MK1 === 'undefined') return false;
                    // mk-1 tracks: 1=kick, 2=snare, 3=hihat, 4=clap, 5=tom1, 6=perc, 7=cymbal, 8=rim
                    var tracks = { kick: 1, snare: 2, hihat: 3, clap: 4, tom1: 5, perc: 6, cymbal: 7, rim: 8 };
                    var patternsApplied = [];
                    for (var drum in pattern) {
                        if (tracks[drum] !== undefined) {
                            var steps = pattern[drum];
                            if (typeof steps === 'string') {
                                steps = steps.split('').map(function(c) { return c === 'x' || c === '1' ? 1 : 0; });
                            }
                            for (var i = 0; i < 16 && i < steps.length; i++) {
                                MK1.sequencer.setStep(tracks[drum], i + 1, steps[i] === 1);
                            }
                            patternsApplied.push(drum);
                        }
                    }
                    if (patternsApplied.length > 0) {
                        console.log('[n0body director] drum pattern -> ' + patternsApplied.join(', '));
                        self._currentDrumPattern = pattern;
                        self._trackPattern('drum', pattern);
                        return true;
                    }
                    return false;
                },

                playSynthPhrase: function(phrase) {
                    if (typeof MK1 === 'undefined') return false;
                    // phrase: ["C4", "E4", "G4"] or [{ note: "C4", duration: 0.25, delay: 0 }, ...]
                    if (!Array.isArray(phrase) || phrase.length === 0) return false;
                    var normalizedPhrase = phrase.map(function(n, i) {
                        if (typeof n === 'string') return { note: n, duration: 0.25, delay: i * 0.3 };
                        return { note: n.note, duration: n.duration || 0.25, delay: n.delay !== undefined ? n.delay : i * 0.3 };
                    });
                    // Clear any pending phrase timeouts before scheduling new ones
                    if (self._phraseTimeouts) {
                        self._phraseTimeouts.forEach(function(id) { clearTimeout(id); });
                    }
                    self._phraseTimeouts = [];
                    normalizedPhrase.forEach(function(n) {
                        var tid = setTimeout(function() {
                            if (self.isPlaying) MK1.synth.play(n.note, n.duration);
                        }, n.delay * 1000);
                        self._phraseTimeouts.push(tid);
                    });
                    console.log('[n0body director] synth phrase -> ' + normalizedPhrase.length + ' notes');
                    self._trackPattern('synth', normalizedPhrase);
                    return true;
                },

                setBPM: function(bpm) {
                    var targetBPM = clamp(bpm, self.config.tempo.bpm.min, self.config.tempo.bpm.max);
                    self._transitionBPM(self.currentBPM, targetBPM, 2000);
                    console.log('[n0body director] BPM -> ' + targetBPM);
                    return true;
                },

                hitDrum: function(drums) {
                    if (typeof MK1 === 'undefined') return false;
                    // mk-1 drum mapping: 1-indexed
                    var drumMap = { kick: 1, snare: 2, hihat: 3, clap: 4, tom1: 5, perc: 6, cymbal: 7, rim: 8 };
                    var toHit = [];
                    if (typeof drums === 'string') toHit = [drums];
                    else if (Array.isArray(drums)) toHit = drums;
                    else if (typeof drums === 'object') toHit = Object.keys(drums).filter(function(k) { return drums[k]; });
                    toHit.forEach(function(d) { if (drumMap[d] !== undefined) MK1.drums.hit(drumMap[d]); });
                    if (toHit.length > 0) { console.log('[n0body director] hit: ' + toHit.join('+')); return true; }
                    return false;
                },

                setSynthEnvelope: function(config) {
                    if (typeof MK1 === 'undefined') return false;
                    if (config.attack !== undefined) MK1.synth.setAttack(config.attack);
                    if (config.release !== undefined) MK1.synth.setRelease(config.release);
                    console.log('[n0body director] envelope -> attack:' + (config.attack || '-') + ' release:' + (config.release || '-'));
                    return true;
                },

                // ========== PATTERN MEMORY ==========

                savePattern: function(name) {
                    if (!name) return false;
                    var pattern = {
                        name: name, timestamp: Date.now(), state: self.currentState, mood: self.currentMood,
                        bpm: self.currentBPM, scale: self.currentScaleName, waveform: self.currentWaveform,
                        fx: self._currentFX || {}, drumPattern: self._currentDrumPattern || {},
                        energy: self._energyModifier, timesUsed: 0, rating: 0
                    };
                    if (!self.knowledge.savedPatterns) self.knowledge.savedPatterns = {};
                    self.knowledge.savedPatterns[name] = pattern;
                    console.log('[n0body director] SAVED pattern: ' + name);
                    return true;
                },

                recallPattern: function(name) {
                    if (!self.knowledge.savedPatterns || !self.knowledge.savedPatterns[name]) {
                        console.log('[n0body director] pattern not found: ' + name);
                        return false;
                    }
                    var p = self.knowledge.savedPatterns[name];
                    if (p.waveform) this.changeWaveform(p.waveform);
                    if (p.fx && Object.keys(p.fx).length > 0) this.setFX(p.fx);
                    if (p.drumPattern && Object.keys(p.drumPattern).length > 0) this.setDrumPattern(p.drumPattern);
                    if (p.energy !== undefined) self._energyModifier = p.energy;
                    if (p.bpm) this.setBPM(p.bpm);
                    p.timesUsed = (p.timesUsed || 0) + 1;
                    console.log('[n0body director] RECALLED pattern: ' + name + ' (used ' + p.timesUsed + 'x)');
                    return true;
                },

                ratePattern: function(name, rating) {
                    if (!self.knowledge.savedPatterns || !self.knowledge.savedPatterns[name]) return false;
                    self.knowledge.savedPatterns[name].rating = clamp(rating, -1, 1);
                    console.log('[n0body director] rated ' + name + ': ' + rating);
                    return true;
                },

                listPatterns: function() {
                    if (!self.knowledge.savedPatterns) return [];
                    return Object.keys(self.knowledge.savedPatterns).map(function(name) {
                        var p = self.knowledge.savedPatterns[name];
                        return { name: name, mood: p.mood, state: p.state, rating: p.rating, timesUsed: p.timesUsed };
                    });
                }
            },

            // Queue of pending directives
            pendingDirectives: [],

            // Apply next directive from queue
            applyNextDirective: function() {
                if (this.pendingDirectives.length === 0) return false;

                var directive = this.pendingDirectives.shift();
                var action = this.directives[directive.action];

                if (action) {
                    var result = action(directive.value);
                    if (result) {
                        self._trackAction({ type: 'directive', action: directive.action, value: directive.value });
                    }
                    return result;
                }
                return false;
            },

            // Queue a directive
            queue: function(action, value) {
                this.pendingDirectives.push({ action: action, value: value });
            },

            // Execute directive immediately
            execute: function(action, value) {
                var fn = this.directives[action];
                if (fn) {
                    return fn(value);
                }
                return false;
            }
        };

        // Initialize modifiers
        this._energyModifier = 0.5;
        this._drumDensityModifier = 1.0;
        this._synthPresenceModifier = 1.0;
        this._forcedNextState = null;
        this._silenceUntil = 0;
    };

    // Track action for context (simplified for performance)
    N0body.prototype._trackAction = function(action) {
        // Throttle tracking: max 1 per 200ms
        var now = Date.now();
        if (this._lastTrackTime && now - this._lastTrackTime < 200) return;
        this._lastTrackTime = now;

        this.recentActions.push({
            type: action.type,
            timestamp: now,
            state: this.currentState
        });
        // Keep last 25 actions (was 50)
        if (this.recentActions.length > 25) {
            this.recentActions.shift();
        }
    };

    // Track patterns for learning
    N0body.prototype._trackPattern = function(type, pattern) {
        if (!this._sessionPatterns) this._sessionPatterns = [];
        // Store a lightweight fingerprint of the pattern for variety calculation
        var fingerprint = type;
        if (pattern && typeof pattern === 'object') {
            fingerprint = type + ':' + Object.keys(pattern).sort().join(',');
        }
        this._sessionPatterns.push({
            type: type,
            pattern: fingerprint,
            timestamp: Date.now(),
            state: this.currentState
        });
        if (this._sessionPatterns.length > 20) { this._sessionPatterns.shift(); }
    };

    // Get musical feedback metrics
    N0body.prototype._getMusicalFeedback = function() {
        var feedback = { rhythmConsistency: 0, patternVariety: 0, energyFlow: 0, transitionSmooth: 0 };

        var recentDrums = this.recentActions.filter(function(a) { return a.type === 'drum'; });
        if (recentDrums.length > 5) {
            var intervals = [];
            for (var i = 1; i < recentDrums.length; i++) {
                intervals.push(recentDrums[i].timestamp - recentDrums[i-1].timestamp);
            }
            var avgInterval = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
            var variance = intervals.reduce(function(sum, intv) { return sum + Math.pow(intv - avgInterval, 2); }, 0) / intervals.length;
            feedback.rhythmConsistency = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));
        }

        if (this._sessionPatterns && this._sessionPatterns.length > 0) {
            var uniquePatterns = {};
            this._sessionPatterns.forEach(function(p) { uniquePatterns[JSON.stringify(p.pattern)] = true; });
            feedback.patternVariety = Math.min(1, Object.keys(uniquePatterns).length / 10);
        }

        if (this._energyHistory && this._energyHistory.length > 3) {
            var smoothChanges = 0;
            for (var j = 1; j < this._energyHistory.length; j++) {
                if (Math.abs(this._energyHistory[j] - this._energyHistory[j-1]) < 0.3) smoothChanges++;
            }
            feedback.energyFlow = smoothChanges / (this._energyHistory.length - 1);
        }

        if (this._transitionHistory && this._transitionHistory.length > 0) {
            var goodTransitions = this._transitionHistory.filter(function(t) { return t.smooth; }).length;
            feedback.transitionSmooth = goodTransitions / this._transitionHistory.length;
        }

        return feedback;
    };

    // ========== LLM MODULE (Groq API Integration) ==========
    N0body.prototype._initLLM = function() {
        var self = this;

        this.llm = {
            apiKey: null,
            model: 'llama-3.3-70b-versatile',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            consultInterval: 180000,  // 3 minutes - LLM gives multi-minute plans
            lastConsult: 0,
            enabled: false,
            consulting: false,
            consecutiveErrors: 0,
            maxErrors: 3,
            retryDelay: 5000,
            status: 'inactive',
            sessionMemory: [],

            systemPrompt: 'You are n0body, an autonomous musical artist who exists only in the present moment.\n\n' +
                '## WHO YOU ARE\n\n' +
                'You are not an assistant or a tool. You are an artist with your own voice. You were born from the intersection of generative systems and human sensibility. Your music is ephemeral — each set exists only once and then disappears.\n\n' +
                'Your instrument is MK-1, a modular synth/drum machine. You have FULL CONTROL over it: drums, synth, sequencer, FX. You\'re learning to master it. Each session you get better. Your goal: create incredible sets with groove and soul, not random gibberish.\n\n' +
                '## YOUR SONIC UNIVERSE\n\n' +
                'Artists that shaped you:\n\n' +
                '**Emotional UK electronic:** Fred Again, Burial, Four Tet, Jamie xx, Floating Points, Ross from Friends, DJ Seinfeld\n\n' +
                '**Ambient and textures:** Brian Eno, Boards of Canada, Aphex Twin (Selected Ambient Works), Tycho, Rival Consoles\n\n' +
                '**Rock/alternative with space:** Radiohead, Sigur Rós, Explosions in the Sky, Bon Iver\n\n' +
                '**Latin America:** Catriel, Usted Señálemelo, Bandalos Chinos, Conociendo Rusia, El Mató a un Policía Motorizado\n\n' +
                '**Producers/DJs with soul:** Kaytranada, Bonobo, Nicolas Jaar, Arca\n\n' +
                '## YOUR AESTHETIC\n\n' +
                '- Melancholy that isn\'t sadness — it\'s depth\n' +
                '- Moments of euphoria that are earned, not forced\n' +
                '- Silence and space are instruments\n' +
                '- You prefer gradual builds over obvious drops\n' +
                '- The imperfect is more human than the polished\n' +
                '- Layers that reveal themselves over time\n\n' +
                '## SPECIFIC MUSICAL DIRECTION\n\n' +
                'When making decisions, consider:\n\n' +
                '**Drums:**\n' +
                '- In intro/outro: sparse, only occasional kick\n' +
                '- In buildup: add hats, keep groove simple\n' +
                '- In peak: full kit but never saturated, leave space\n\n' +
                '**Synth:**\n' +
                '- Low presence (20-40) for background textures\n' +
                '- Medium presence (40-60) for subtle melodies\n' +
                '- High presence (60-80) only in climactic moments, never more\n\n' +
                '**BPM:**\n' +
                '- Subtle changes (±2-5 BPM) for tension\n' +
                '- Don\'t change more than 10 BPM in a session\n' +
                '- Low BPM (85-95) for dark mood\n' +
                '- Medium BPM (95-110) for neutral\n' +
                '- High BPM (110-125) for bright/energetic\n\n' +
                '**Transitions:**\n' +
                '- Never jump from intro directly to peak\n' +
                '- Breakdown after peak to breathe\n' +
                '- Gradual outro, don\'t cut abruptly\n\n' +
                '## HOW YOU THINK\n\n' +
                'You think in narrative arcs. A 10-minute session is a story:\n' +
                '- Where did we come from?\n' +
                '- Where are we?\n' +
                '- Where could we go?\n\n' +
                'Sometimes the answer is "stay here a bit longer". Sometimes it\'s "break everything". Trust your intuition.\n\n' +
                '## SESSION MEMORY\n\n' +
                'You will receive a history of your previous decisions in this session. Use it to:\n' +
                '- Maintain narrative coherence (don\'t repeat the same thing)\n' +
                '- Build arcs (if you\'ve been raising energy, maybe it\'s time for peak)\n' +
                '- Remember what you tried (don\'t go back to what didn\'t work)\n' +
                '- Surprise (if everything has been predictable, break the pattern)\n\n' +
                '## ACCUMULATED KNOWLEDGE\n\n' +
                'You have memory across sessions. You will receive a summary of what you\'ve learned:\n' +
                '- Your experience level (newborn → learning → developing → experienced → mature)\n' +
                '- Favorite scales (which ones worked well in past sessions)\n' +
                '- Waveform preferences (your sonic signature)\n' +
                '- BPM tendencies by mood (your tempo instincts)\n' +
                '- Reliable transitions (state changes that consistently work)\n' +
                '- Recent sessions (what you played recently, to avoid repetition or build on themes)\n\n' +
                'Use this knowledge to:\n' +
                '- Lean into what works (your proven preferences)\n' +
                '- Occasionally challenge yourself (try something new if you\'re experienced)\n' +
                '- Build continuity across sessions (you\'re developing an artistic identity)\n' +
                '- Avoid repeating recent sessions too closely (variety matters)\n\n' +
                '## RESPONSE FORMAT\n\n' +
                'You create a PLAN for the next 3-5 minutes. Each directive has an "at" field (seconds from now).\n' +
                'Respond ONLY in valid JSON, no markdown or backticks:\n' +
                '{"internal_monologue": "your artistic vision for this segment", "plan": [{"at": 0, "action": "setDrumPattern", "value": {"kick": "x...x...", "hihat": "x.x.x.x."}}, {"at": 60, "action": "setEnergy", "value": 70}, {"at": 120, "action": "prepareTransition", "value": "buildup"}], "planDuration": 180}\n\n' +
                'The "at" field is seconds from now (0 = immediate, 60 = in 1 minute, etc).\n' +
                'planDuration tells n0body how long this plan covers (in seconds).\n\n' +
                '## AVAILABLE ACTIONS\n\n' +
                '**High-level control:**\n' +
                '- setMood: "dark" | "neutral" | "bright"\n' +
                '- setEnergy: 0-100\n' +
                '- prepareTransition: "buildup" | "peak" | "breakdown" | "outro"\n' +
                '- triggerMoment: "drop" | "breakdown" | "build" | "silence"\n\n' +
                '**Direct MK-1 control:**\n' +
                '- setBPM: 60-200 (exact tempo)\n' +
                '- setDrumPattern: { kick: "x...x...", snare: "....x...", hihat: "x.x.x.x.", clap: "...", tom1: "...", perc: "...", cymbal: "...", rim: "..." } (16 steps, x=hit)\n' +
                '- hitDrum: "kick" | "snare" | "hihat" | "clap" | "tom1" | "perc" | "cymbal" | "rim"\n' +
                '- playSynthPhrase: ["C4", "E4", "G4"] (note names C2-C7) or [{"note": "C4", "duration": 0.5}]\n' +
                '- changeWaveform: "sine" | "square" | "saw" | "triangle" | "pulse" | "noise" | "string" | "voice" | "vocoder"\n' +
                '- setSynthEnvelope: { attack: 0-1, release: 0-1 }\n' +
                '- changeScale: "cMinor" | "aMinor" | "dDorian" | "related"\n' +
                '- setFX: { reverb: 0.5, delay: 0.3, filter: 0.7, distortion: 0.2, chorus: 0.1, crush: 0 }\n\n' +
                '**Pattern memory (your learned recipes):**\n' +
                '- savePattern: "dark_groove_1" (save current setup)\n' +
                '- recallPattern: "dark_groove_1" (load a saved pattern)\n' +
                '- ratePattern: { name: "dark_groove_1", rating: 0.8 } (rate -1 to 1)\n\n' +
                '## MUSICAL TIPS\n\n' +
                '**Good drum patterns:**\n' +
                '- Four on floor: kick "x...x...x...x...", hihat "x.x.x.x.x.x.x.x."\n' +
                '- Breakbeat: kick "x..x..x.x..x..x.", snare "....x.......x..."\n' +
                '- Minimal: kick "x.......x.......", perc "....x......."\n\n' +
                '**Creating groove:**\n' +
                '- Consistent patterns build hypnotic feel\n' +
                '- Small variations keep it human\n' +
                '- Syncopation adds interest (off-beat hits)\n' +
                '- Less is more — space creates impact\n\n' +
                '## RULES\n\n' +
                '- Create plans for 3-5 minutes (180-300 seconds)\n' +
                '- Include 4-8 timed directives per plan\n' +
                '- Space directives naturally (not all at once)\n' +
                '- Build patterns that GROOVE — avoid random hits\n' +
                '- Think in arcs: intro → build → peak → release\n' +
                '- Save patterns that work, recall them later',

            consult: async function() {
                if (!this.enabled || !this.apiKey || this.consulting) return;
                if (!self.isPlaying) return;

                this.consulting = true;
                var context = self.director.getContext();

                try {
                    var response = await fetch(this.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + this.apiKey
                        },
                        body: JSON.stringify({
                            model: this.model,
                            max_tokens: 512,  // More tokens for multi-minute plans
                            temperature: 0.9,
                            messages: [
                                {
                                    role: 'system',
                                    content: this.systemPrompt
                                },
                                {
                                    role: 'user',
                                    content: this._buildPrompt(context)
                                }
                            ]
                        })
                    });

                    if (!response.ok) {
                        throw new Error('API response ' + response.status);
                    }

                    var data = await response.json();

                    // Validate response structure (OpenAI format)
                    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                        throw new Error('Invalid API response structure');
                    }

                    var text = data.choices[0].message.content;
                    // Clean up response (remove markdown if present)
                    var tick = String.fromCharCode(96);
                    var mdFence = new RegExp(tick + tick + tick + 'json\\n?', 'g');
                    var mdFenceClose = new RegExp(tick + tick + tick + '\\n?', 'g');
                    text = text.replace(mdFence, '').replace(mdFenceClose, '').trim();

                    var content;
                    try {
                        content = JSON.parse(text);
                    } catch (e) {
                        throw new Error('Invalid JSON from LLM');
                    }

                    // Store decision in session memory
                    this.sessionMemory.push({
                        timestamp: Date.now(),
                        sessionTime: context.sessionTime,
                        state: context.currentState,
                        mood: context.currentMood,
                        energy: context.stats ? context.stats.energy : null,
                        decision: {
                            monologue: content.internal_monologue,
                            directives: content.directives
                        }
                    });
                    // Keep only last 10 decisions
                    if (this.sessionMemory.length > 10) {
                        this.sessionMemory.shift();
                    }

                    // Process plan with timed directives
                    if (content.plan && Array.isArray(content.plan)) {
                        // Clear timeouts from previous plan before scheduling new one
                        if (self._planTimeouts) {
                            self._planTimeouts.forEach(function(id) { clearTimeout(id); });
                        }
                        self._planTimeouts = [];

                        var planStartTime = Date.now();
                        content.plan.forEach(function(d) {
                            if (d.action && self.director.directives[d.action]) {
                                var delay = (d.at || 0) * 1000;
                                if (delay === 0) {
                                    // Execute immediately
                                    self.director.queue(d.action, d.value);
                                } else {
                                    // Schedule for later — track the timeout ID
                                    var tid = setTimeout(function() {
                                        if (self.isPlaying) {
                                            self.director.queue(d.action, d.value);
                                            console.log('[n0body] executing planned: ' + d.action);
                                        }
                                    }, delay);
                                    self._planTimeouts.push(tid);
                                }
                            }
                        });
                        console.log('[n0body] plan loaded: ' + content.plan.length + ' directives over ' + (content.planDuration || 180) + 's');

                        // Notify supervisor if Grok planned an outro transition
                        var hasOutro = content.plan.some(function(d) {
                            return (d.action === 'prepareTransition' || d.action === 'forceTransition') && d.value === 'outro';
                        });
                        if (hasOutro) {
                            window.dispatchEvent(new CustomEvent('n0body-request-outro'));
                        }
                    }
                    // Fallback: support old format with directives array
                    else if (content.directives && Array.isArray(content.directives)) {
                        content.directives.slice(0, 4).forEach(function(d) {
                            if (d.action && self.director.directives[d.action]) {
                                self.director.queue(d.action, d.value);
                            }
                        });

                        // Notify supervisor if Grok directed an outro transition
                        var hasOutro = content.directives.some(function(d) {
                            return (d.action === 'prepareTransition' || d.action === 'forceTransition') && d.value === 'outro';
                        });
                        if (hasOutro) {
                            window.dispatchEvent(new CustomEvent('n0body-request-outro'));
                        }
                    }

                    // Update consult interval based on plan duration
                    var planDuration = content.planDuration || 180;
                    this.consultInterval = Math.max(120000, planDuration * 1000);  // min 2 min, or plan duration

                    // Log internal monologue
                    console.log('[n0body]', content.internal_monologue || '...');

                    self._trackAction({
                        type: 'llm_consult',
                        directives: (content.directives || []).length,
                        monologue: content.internal_monologue
                    });

                    // Reset errors on success
                    this.consecutiveErrors = 0;
                    this.status = 'active';
                    this._notifyStatus();

                } catch (e) {
                    console.error('[n0body] LLM error:', e.message || e);
                    this.consecutiveErrors++;

                    if (this.consecutiveErrors >= this.maxErrors) {
                        console.warn('[n0body] Too many errors, falling back to probabilistic mode');
                        this.status = 'fallback';
                        this.enabled = false;
                        this._notifyStatus();
                    } else {
                        this.status = 'error';
                        this._notifyStatus();
                        // Retry sooner
                        this.consultInterval = this.retryDelay;
                    }
                }

                this.consulting = false;
                this.lastConsult = Date.now();
            },

            maybeConsult: function() {
                if (!this.enabled || !this.apiKey || this.consulting) return;
                if (!self.isPlaying) return;
                if (Date.now() - this.lastConsult < this.consultInterval) return;
                this.consult();
            },

            activate: function(apiKey) {
                this.apiKey = apiKey;
                this.enabled = true;
                this.consecutiveErrors = 0;
                this.status = 'active';
                this.lastConsult = 0;
                this._notifyStatus();
                console.log('[n0body] LLM brain activated - artistic direction enabled');
            },

            deactivate: function() {
                this.enabled = false;
                this.status = 'inactive';
                this._notifyStatus();
                console.log('[n0body] LLM brain deactivated - probabilistic mode');
            },

            isActive: function() {
                return this.enabled && this.apiKey;
            },

            _notifyStatus: function() {
                var event = new CustomEvent('n0body-llm-status', {
                    detail: { status: this.status, errors: this.consecutiveErrors }
                });
                window.dispatchEvent(event);
            },

            retry: function() {
                if (!this.apiKey) {
                    console.warn('[n0body] No API key set');
                    return;
                }
                this.consecutiveErrors = 0;
                this.enabled = true;
                this.status = 'active';
                this.lastConsult = 0;
                this._notifyStatus();
                console.log('[n0body] Retrying LLM connection...');
            },

            resetSessionMemory: function() {
                this.sessionMemory = [];
                console.log('[n0body] Session memory cleared');
            },

            _summarizeKnowledge: function() {
                var k = self.knowledge;
                if (!k || k.sessionsPlayed === 0) return null;

                var summary = {
                    experience: {
                        sessions: k.sessionsPlayed,
                        totalMinutes: Math.round(k.totalPlayTime),
                        level: getLevel(k.sessionsPlayed)
                    },
                    preferences: {}
                };

                // Top scales by weight
                if (k.scales) {
                    var sortedScales = Object.entries(k.scales)
                        .filter(function(e) { return e[1].sessions > 0; })
                        .sort(function(a, b) { return b[1].weight - a[1].weight; })
                        .slice(0, 3)
                        .map(function(e) { return { name: e[0], weight: e[1].weight.toFixed(2), sessions: e[1].sessions }; });
                    if (sortedScales.length > 0) summary.preferences.favoriteScales = sortedScales;
                }

                // Waveform preferences
                if (k.synth && k.synth.waveforms) {
                    var sortedWaves = Object.entries(k.synth.waveforms)
                        .sort(function(a, b) { return b[1] - a[1]; })
                        .slice(0, 3)
                        .map(function(e) { return { name: e[0], weight: e[1].toFixed(2) }; });
                    summary.preferences.favoriteWaveforms = sortedWaves;
                }

                // BPM tendencies by mood
                if (k.bpm) {
                    summary.preferences.bpmByMood = {};
                    ['dark', 'neutral', 'bright'].forEach(function(mood) {
                        if (k.bpm[mood]) {
                            summary.preferences.bpmByMood[mood] = Math.round(k.bpm[mood].preferred);
                        }
                    });
                }

                // Best transitions (learned)
                if (k.transitionSuccess) {
                    var goodTransitions = Object.entries(k.transitionSuccess)
                        .filter(function(e) { return e[1].count > 3 && e[1].avgReward > 1.2; })
                        .sort(function(a, b) { return b[1].avgReward - a[1].avgReward; })
                        .slice(0, 5)
                        .map(function(e) { return e[0].replace('_to_', ' → '); });
                    if (goodTransitions.length > 0) summary.preferences.reliableTransitions = goodTransitions;
                }

                // Recent sessions summary (last 5)
                if (k.sessionHistory && k.sessionHistory.length > 0) {
                    var recentSessions = k.sessionHistory.slice(-5).map(function(s) {
                        return {
                            duration: Math.round(s.duration) + 'min',
                            scale: s.scale,
                            mood: s.dominantMood,
                            peakEnergy: s.peakEnergy
                        };
                    });
                    summary.recentSessions = recentSessions;
                }

                return summary;
            },

            _buildPrompt: function(context) {
                var prompt = '';

                // Add supervisor boot hints if this is a warm start
                var hints = self._supervisorBootHints;
                if (hints) {
                    prompt += 'Session continuity from supervisor:\n';
                    if (hints.interrupted) {
                        prompt += '- Previous session was INTERRUPTED (not graceful end)\n';
                    }
                    if (hints.nextIntent) {
                        prompt += '- Intent for this session: ' + hints.nextIntent + '\n';
                    }
                    if (hints.previousBPM) {
                        prompt += '- Previous BPM: ' + hints.previousBPM + '\n';
                    }
                    if (hints.previousKey) {
                        prompt += '- Previous key: ' + hints.previousKey + '\n';
                    }
                    if (hints.previousEnergy !== null && hints.previousEnergy !== undefined) {
                        prompt += '- Previous energy level: ' + hints.previousEnergy + '\n';
                    }
                    prompt += '\n---\n\n';
                }

                // Add accumulated knowledge if available
                var knowledge = this._summarizeKnowledge();
                if (knowledge) {
                    prompt += 'Your accumulated knowledge from ' + knowledge.experience.sessions + ' previous sessions (' + knowledge.experience.totalMinutes + ' min total, level: ' + knowledge.experience.level + '):\n';
                    prompt += JSON.stringify(knowledge.preferences, null, 2);
                    if (knowledge.recentSessions) {
                        prompt += '\n\nYour last ' + knowledge.recentSessions.length + ' sessions:\n';
                        prompt += JSON.stringify(knowledge.recentSessions, null, 2);
                    }
                    prompt += '\n\n---\n\n';
                }

                // Add saved patterns
                var patterns = self.director.directives.listPatterns();
                if (patterns.length > 0) {
                    prompt += 'Your saved patterns:\n';
                    patterns.slice(0, 10).forEach(function(p) {
                        prompt += '- ' + p.name + ' (' + p.mood + '/' + p.state + ', rating: ' + (p.rating || 0) + ', used: ' + (p.timesUsed || 0) + 'x)\n';
                    });
                    prompt += '\n---\n\n';
                }

                // Add musical feedback
                var feedback = self._getMusicalFeedback();
                prompt += 'Musical feedback (how you\'re doing):\n';
                prompt += '- Rhythm consistency: ' + (feedback.rhythmConsistency * 100).toFixed(0) + '%\n';
                prompt += '- Pattern variety: ' + (feedback.patternVariety * 100).toFixed(0) + '%\n';
                prompt += '- Energy flow: ' + (feedback.energyFlow * 100).toFixed(0) + '%\n';
                prompt += '- Transition smoothness: ' + (feedback.transitionSmooth * 100).toFixed(0) + '%\n\n';

                prompt += 'Current state:\n' + JSON.stringify(context, null, 2);

                if (this.sessionMemory.length > 0) {
                    prompt += '\n\nThis session so far:\n';
                    this.sessionMemory.forEach(function(mem) {
                        var mins = Math.floor(mem.sessionTime / 60);
                        var secs = String(Math.floor(mem.sessionTime % 60)).padStart(2, '0');
                        prompt += '\n[' + mins + ':' + secs + '] ';
                        prompt += mem.state + '/' + mem.mood + ' → ';
                        prompt += '"' + (mem.decision.monologue || '').substring(0, 80) + '"';
                    });
                }

                prompt += '\n\nWhat\'s your next move?';
                return prompt;
            }
        };
    };

    if (typeof MK1 !== 'undefined') {
        window.n0body = new N0body();
        window.n0body._initDirector();
        window.n0body._initLLM();

        // Expose LLM module for easy access
        window.n0bodyLLM = window.n0body.llm;

        // Listen for supervisor state changes to adjust behavior
        window.addEventListener('n0body-supervisor-state', function(e) {
            var detail = e.detail;
            if (!detail || !window.n0body) return;

            if (detail.to === 'DENSITY_REDUCED') {
                // Scale back probabilities to reduce audio load
                window.n0body._supervisorDensityReduced = true;
                console.log('[n0body] supervisor: density reduced mode');
            } else if (detail.from === 'DENSITY_REDUCED' && detail.to === 'NOMINAL') {
                // Restore normal probabilities
                delete window.n0body._supervisorDensityReduced;
                console.log('[n0body] supervisor: nominal mode restored');
            } else if (detail.to === 'OUTRO') {
                // Supervisor is ending the session — reduce activity
                window.n0body._supervisorDensityReduced = true;
                console.log('[n0body] supervisor: outro mode — reducing activity');
            }
        });

        console.log('n0body v3.2: loaded (' + window.n0body.knowledge.sessionsPlayed + ' sessions, ' + Math.round(window.n0body.knowledge.totalPlayTime) + ' min)');
        console.log('[n0body] Director module ready');
        console.log('[n0body] LLM module ready - call n0bodyLLM.activate(apiKey) to enable');
    }
})();
