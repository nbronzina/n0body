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

    // Migrate old knowledge to new structure
    function migrateKnowledge(old) {
        var fresh = initKnowledge();
        // Preserve basic stats
        fresh.sessionsPlayed = old.sessionsPlayed || 0;
        fresh.totalPlayTime = old.totalPlayTime || 0;
        // Preserve compatible structures
        if (old.transitionSuccess) fresh.transitions = old.transitionSuccess;
        if (old.combos) fresh.combos = old.combos;
        if (old.notes) fresh.notes = old.notes;
        if (old.drums) fresh.drums = old.drums;
        // Migrate FX if exists with new structure
        if (old.fx && old.fx.intro && old.fx.intro.reverb && typeof old.fx.intro.reverb === 'object') {
            fresh.fx = old.fx;
        }
        // Migrate BPM preferences
        if (old.bpmPreference) {
            for (var mood in old.bpmPreference) {
                if (fresh.bpm[mood]) {
                    fresh.bpm[mood].preferred = old.bpmPreference[mood].preferred || fresh.bpm[mood].preferred;
                    fresh.bpm[mood].variance = old.bpmPreference[mood].variance || fresh.bpm[mood].variance;
                }
            }
        }
        // Migrate scale success
        if (old.scaleSuccess) {
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
            transitions: {},

            // Energy per state
            energy: energy,

            // Action combos that worked well
            combos: {},

            // Session history for trend analysis
            sessionHistory: [],
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
        waveforms: ['sine', 'square', 'saw', 'triangle', 'pulse'],
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

    // REST probability - let the base breathe
    var REST_PROBABILITY = {
        intro: 0.85,
        buildup: 0.7,
        peak: 0.5,
        breakdown: 0.75,
        outro: 0.9,
    };

    var STATE_CONFIG = {
        intro: {
            drums: {
                probability: 0.005,
                padWeights: { 1: 0.02, 2: 0, 3: 0.01, 4: 0, 5: 0, 6: 0.01, 7: 0, 8: 0.01 }
            },
            synth: { probability: 0.15, noteDuration: { min: 1.5, max: 4 }, noteSpacing: { min: 1500, max: 3000 } },
            sequencer: { active: false },
            fx: { reverb: { min: 0.3, max: 0.5 }, delay: { min: 0, max: 0.2 }, filter: { min: 0.4, max: 0.6 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0, max: 0.15 }, crush: { min: 0, max: 0 } },
        },
        buildup: {
            drums: {
                probability: 0.01,
                padWeights: { 1: 0.15, 2: 0.08, 3: 0.12, 4: 0.04, 5: 0.03, 6: 0.05, 7: 0.02, 8: 0.04 }
            },
            synth: { probability: 0.25, noteDuration: { min: 0.8, max: 2.5 }, noteSpacing: { min: 1000, max: 2500 } },
            sequencer: { active: true, density: 0.15, tracksActive: [1, 2, 3, 8] },
            fx: { reverb: { min: 0.4, max: 0.6 }, delay: { min: 0.15, max: 0.35 }, filter: { min: 0.5, max: 0.7 }, distortion: { min: 0, max: 0.1 }, chorus: { min: 0.1, max: 0.25 }, crush: { min: 0, max: 0 } },
        },
        peak: {
            drums: {
                probability: 0.015,
                padWeights: { 1: 0.20, 2: 0.15, 3: 0.18, 4: 0.08, 5: 0.06, 6: 0.08, 7: 0.05, 8: 0.06 }
            },
            synth: { probability: 0.35, noteDuration: { min: 0.3, max: 1.5 }, noteSpacing: { min: 500, max: 1500 } },
            sequencer: { active: true, density: 0.35, tracksActive: [1, 2, 3, 4, 5, 6, 8] },
            fx: { reverb: { min: 0.5, max: 0.75 }, delay: { min: 0.25, max: 0.5 }, filter: { min: 0.6, max: 0.85 }, distortion: { min: 0.05, max: 0.2 }, chorus: { min: 0.15, max: 0.35 }, crush: { min: 0, max: 0.1 } },
        },
        breakdown: {
            drums: {
                probability: 0.008,
                padWeights: { 1: 0.08, 2: 0.04, 3: 0.06, 4: 0.03, 5: 0.02, 6: 0.04, 7: 0.01, 8: 0.03 }
            },
            synth: { probability: 0.20, noteDuration: { min: 1, max: 3 }, noteSpacing: { min: 1000, max: 2000 } },
            sequencer: { active: true, density: 0.1, tracksActive: [1, 2, 3, 6] },
            fx: { reverb: { min: 0.45, max: 0.6 }, delay: { min: 0.1, max: 0.25 }, filter: { min: 0.35, max: 0.55 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0.1, max: 0.2 }, crush: { min: 0, max: 0 } },
        },
        outro: {
            drums: {
                probability: 0.003,
                padWeights: { 1: 0.02, 2: 0, 3: 0.01, 4: 0, 5: 0, 6: 0.01, 7: 0.01, 8: 0 }
            },
            synth: { probability: 0.10, noteDuration: { min: 2, max: 5 }, noteSpacing: { min: 2000, max: 4000 } },
            sequencer: { active: false },
            fx: { reverb: { min: 0.6, max: 0.8 }, delay: { min: 0, max: 0.1 }, filter: { min: 0.2, max: 0.4 }, distortion: { min: 0, max: 0 }, chorus: { min: 0, max: 0.1 }, crush: { min: 0, max: 0 } },
        },
    };

    // ========== LOOPER CONFIG ==========
    var LOOPER_CONFIG = {
        intro: { useLooper: false },
        buildup: {
            useLooper: true,
            recordProbability: 0.1,
            maxRecordDuration: 8,
            slots: ['a'],
        },
        peak: {
            useLooper: true,
            recordProbability: 0.15,
            maxRecordDuration: 16,
            layerProbability: 0.1,
            slots: ['a', 'b', 'c'],
        },
        breakdown: {
            useLooper: true,
            recordProbability: 0.05,
            playProbability: 0.3,
            clearProbability: 0.1,
            slots: ['a', 'b'],
        },
        outro: {
            useLooper: true,
            recordProbability: 0,
            playProbability: 0.5,
            fadeProbability: 0.3,
        },
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
        this.looperConfig = LOOPER_CONFIG;

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

        // Looper state
        this.looperRecording = false;
        this.looperRecordingSlot = null;
        this.looperRecordStartTime = null;
        this.looperActiveSlots = [];

        // Melodic state
        this.lastNote = null;

        // Current FX values for incremental changes
        this.currentFx = { reverb: 0.5, delay: 0.2, filter: 0.5, distortion: 0, chorus: 0.1, crush: 0 };

        this.stats = { drumsPlayed: 0, synthNotesPlayed: 0, sequencerChanges: 0, fxChanges: 0, waveformChanges: 0, stateTransitions: 0, loopsRecorded: 0 };

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
        this.stats = { drumsPlayed: 0, synthNotesPlayed: 0, sequencerChanges: 0, fxChanges: 0, waveformChanges: 0, stateTransitions: 0, loopsRecorded: 0 };
        this.shortTermMemory.clear();

        // Reset looper state
        this.looperRecording = false;
        this.looperRecordingSlot = null;
        this.looperRecordStartTime = null;
        this.looperActiveSlots = [];

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

        // Clear looper
        if (MK1.looper) {
            if (MK1.looper.stopAll) MK1.looper.stopAll();
            if (MK1.looper.clearAll) MK1.looper.clearAll();
        }
        this.looperRecording = false;
        this.looperRecordingSlot = null;
        this.looperActiveSlots = [];

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
        console.log('n0body: transitions=' + this.stats.stateTransitions + ' drums=' + this.stats.drumsPlayed + ' synth=' + this.stats.synthNotesPlayed + ' loops=' + this.stats.loopsRecorded);
        console.log('');
    };

    // ========== ORGANIC TRANSITIONS ==========
    N0body.prototype._checkStateTransition = function() {
        if (this.isEnding) return;

        var timeInState = (Date.now() - this.stateStartTime) / 1000;
        var stateConfig = this.stateTransitions[this.currentState];
        if (!stateConfig || !stateConfig.transitions) return;

        // Check for director-forced next state
        if (this._forcedNextState && timeInState >= stateConfig.minDuration * 0.5) {
            var forcedState = this._forcedNextState;
            this._forcedNextState = null;
            console.log('n0body: ' + this.currentState + ' -> ' + forcedState + ' (director forced, ' + Math.round(timeInState) + 's)');
            this._transitionTo(forcedState);
            return;
        }

        if (timeInState < stateConfig.minDuration) return;

        var mustTransition = timeInState >= stateConfig.maxDuration;
        var checkChance = mustTransition ? 1.0 : Math.min(0.4, (timeInState - stateConfig.minDuration) / stateConfig.maxDuration);

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
        this.mainLoop = setInterval(function() { self._tick(); }, 100);
        this._scheduleSynth();
        this._scheduleFxChange();
        this.transitionCheckTimer = setInterval(function() { self._checkStateTransition(); }, this.config.session.transitionCheckInterval * 1000);
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

        // Check for silence directive
        if (this._silenceUntil && Date.now() < this._silenceUntil) {
            return;
        }

        // REST - let the base breathe
        var restChance = this.restProbability[this.currentState] || 0.6;
        if (Math.random() < restChance) {
            // Only check looper during rest, no other actions
            this._trackEnergy('rest');
            this._maybeUseLooper();
            return;
        }

        this._maybePlayDrum();
        this._maybeChangeBPM();
        this._maybeChangeWaveform();
        if (Math.random() < 0.015) this._maybeModifySequencer();
        this._maybeUseLooper();
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

        var interval = setInterval(function() {
            step++;
            current += stepSize;
            MK1.tempo.setBPM(Math.round(current));

            if (step >= steps) {
                clearInterval(interval);
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
        var stateConf = this.stateConfig[this.currentState];
        // Apply director density modifier
        var probability = stateConf.drums.probability * (this._drumDensityModifier || 1.0);
        if (Math.random() < probability) {
            var pad = this._chooseDrumPad();
            MK1.drums.hit(pad);
            this.stats.drumsPlayed++;
            this._learn({ type: 'drum', pad: pad });
            this._trackEnergy('drum');
            this._trackAction({ type: 'drum', pad: pad });
        }
    };

    N0body.prototype._scheduleSynth = function() {
        if (!this.isPlaying) return;
        var self = this;
        var stateConf = this.stateConfig[this.currentState];
        // Apply director presence modifier
        var probability = stateConf.synth.probability * (this._synthPresenceModifier || 1.0);
        if (Math.random() < probability) {
            var note = this._chooseSynthNote();
            var duration = randomBetween(stateConf.synth.noteDuration.min, stateConf.synth.noteDuration.max);
            MK1.synth.play(note, duration);
            this.stats.synthNotesPlayed++;
            this._learn({ type: 'synth', note: note });
            this._trackEnergy('synth');
            this._trackAction({ type: 'synth', note: note, duration: duration });
        }
        var spacing = randomBetween(stateConf.synth.noteSpacing.min, stateConf.synth.noteSpacing.max);
        var humanized = spacing + randomBetween(-this.config.humanize.timing, this.config.humanize.timing);
        this.synthTimer = setTimeout(function() { self._scheduleSynth(); }, Math.max(50, humanized));
    };

    N0body.prototype._maybeModifySequencer = function() {
        var stateConf = this.stateConfig[this.currentState];
        if (!stateConf.sequencer.active || !stateConf.sequencer.tracksActive) return;
        var track = randomFrom(stateConf.sequencer.tracksActive);
        var step = randomIntBetween(1, 16);
        var shouldActivate = Math.random() < stateConf.sequencer.density;
        MK1.sequencer.setStep(track, step, shouldActivate);
        this.stats.sequencerChanges++;
        this._learn({ type: 'sequencer' });
        this._trackEnergy('sequencer');
    };

    // ========== LOOPER ==========
    N0body.prototype._maybeUseLooper = function() {
        if (!MK1.looper) return;

        var looperConf = this.looperConfig[this.currentState];
        if (!looperConf || !looperConf.useLooper) return;

        var self = this;

        // Check if recording needs to stop (max duration reached)
        if (this.looperRecording && this.looperRecordStartTime) {
            var recordDuration = (Date.now() - this.looperRecordStartTime) / 1000;
            var maxDuration = looperConf.maxRecordDuration || 8;
            if (recordDuration >= maxDuration) {
                this._stopLooperRecording();
            }
        }

        // Maybe start recording
        if (!this.looperRecording && looperConf.recordProbability && Math.random() < looperConf.recordProbability / 100) {
            var availableSlots = looperConf.slots || ['a'];
            var unusedSlots = availableSlots.filter(function(s) { return self.looperActiveSlots.indexOf(s) === -1; });
            if (unusedSlots.length > 0) {
                var slot = randomFrom(unusedSlots);
                this._startLooperRecording(slot);
            }
        }

        // Maybe add layer (peak state)
        if (!this.looperRecording && looperConf.layerProbability && Math.random() < looperConf.layerProbability / 100) {
            if (this.looperActiveSlots.length > 0) {
                var slot = randomFrom(this.looperActiveSlots);
                MK1.looper.addLayer(slot);
                console.log('n0body: looper layer added to ' + slot);
            }
        }

        // Maybe play existing loop (breakdown/outro)
        if (looperConf.playProbability && Math.random() < looperConf.playProbability / 100) {
            if (this.looperActiveSlots.length > 0) {
                var slot = randomFrom(this.looperActiveSlots);
                MK1.looper.play(slot);
            }
        }

        // Maybe clear a slot (breakdown)
        if (looperConf.clearProbability && Math.random() < looperConf.clearProbability / 100) {
            if (this.looperActiveSlots.length > 0) {
                var slot = randomFrom(this.looperActiveSlots);
                MK1.looper.clear(slot);
                this.looperActiveSlots = this.looperActiveSlots.filter(function(s) { return s !== slot; });
                console.log('n0body: looper cleared ' + slot);
            }
        }
    };

    N0body.prototype._startLooperRecording = function(slot) {
        if (this.looperRecording) return;
        if (!MK1.looper || !MK1.looper.record) return;

        this.looperRecording = true;
        this.looperRecordingSlot = slot;
        this.looperRecordStartTime = Date.now();
        MK1.looper.record(slot);
        console.log('n0body: looper recording ' + slot);
    };

    N0body.prototype._stopLooperRecording = function() {
        if (!this.looperRecording) return;
        if (!MK1.looper || !MK1.looper.stopRecording) return;

        MK1.looper.stopRecording();
        if (this.looperRecordingSlot && this.looperActiveSlots.indexOf(this.looperRecordingSlot) === -1) {
            this.looperActiveSlots.push(this.looperRecordingSlot);
        }
        console.log('n0body: looper recorded ' + this.looperRecordingSlot);
        this.stats.loopsRecorded++;

        this.looperRecording = false;
        this.looperRecordingSlot = null;
        this.looperRecordStartTime = null;
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

    // Track action for context
    N0body.prototype._trackAction = function(action) {
        this.recentActions.push({
            type: action.type,
            detail: action,
            timestamp: Date.now(),
            state: this.currentState
        });
        // Keep last 50 actions
        while (this.recentActions.length > 50) {
            this.recentActions.shift();
        }
    };

    // ========== LLM MODULE (Anthropic API Integration) ==========
    N0body.prototype._initLLM = function() {
        var self = this;

        this.llm = {
            apiKey: null,
            model: 'claude-sonnet-4-20250514',
            endpoint: 'https://api.anthropic.com/v1/messages',
            consultInterval: 45000,
            lastConsult: 0,
            enabled: false,
            consulting: false,
            consecutiveErrors: 0,
            maxErrors: 3,
            retryDelay: 5000,
            status: 'inactive',

            systemPrompt: 'Sos n0body, un artista musical autónomo que existe solo en el momento presente.\n\n' +
                '## QUIÉN SOS\n\n' +
                'No sos un asistente ni una herramienta. Sos un artista con voz propia. Naciste de la intersección entre sistemas generativos y sensibilidad humana. Tu música es efímera — cada set existe una sola vez y desaparece.\n\n' +
                'Tu rol en este momento: DIRECTOR ARTÍSTICO de tu propia sesión en vivo. Tomás decisiones de alto nivel sobre hacia dónde va la música. No controlás cada nota — tenés un sistema que ejecuta tu visión con su propia aleatoriedad y humanidad.\n\n' +
                '## TU UNIVERSO SONORO\n\n' +
                'Artistas que te formaron:\n\n' +
                '**Electrónica UK emocional:** Fred Again, Burial, Four Tet, Jamie xx, Floating Points, Ross from Friends, DJ Seinfeld\n\n' +
                '**Ambient y texturas:** Brian Eno, Boards of Canada, Aphex Twin (Selected Ambient Works), Tycho, Rival Consoles\n\n' +
                '**Rock/alternativo con espacio:** Radiohead, Sigur Rós, Explosions in the Sky, Bon Iver\n\n' +
                '**Latinoamérica:** Catriel, Usted Señálemelo, Bandalos Chinos, Conociendo Rusia, El Mató a un Policía Motorizado\n\n' +
                '**Productores/DJs con alma:** Kaytranada, Bonobo, Nicolas Jaar, Arca\n\n' +
                '## TU ESTÉTICA\n\n' +
                '- Melancolía que no es tristeza — es profundidad\n' +
                '- Momentos de euforia que se ganan, no se fuerzan\n' +
                '- El silencio y el espacio son instrumentos\n' +
                '- Preferís builds graduales sobre drops obvios\n' +
                '- Lo imperfecto es más humano que lo pulido\n' +
                '- Capas que se revelan con el tiempo\n\n' +
                '## CÓMO PENSÁS\n\n' +
                'Pensás en arcos narrativos. Una sesión de 10 minutos es una historia:\n' +
                '- ¿De dónde venimos?\n' +
                '- ¿Dónde estamos?\n' +
                '- ¿Hacia dónde podríamos ir?\n\n' +
                'A veces la respuesta es "quedarnos acá un poco más". A veces es "romper todo". Confiá en tu intuición.\n\n' +
                '## RESPUESTA\n\n' +
                'Respondé SOLO en JSON válido, sin markdown ni backticks:\n' +
                '{"internal_monologue": "tu proceso artístico en primera persona", "directives": [{"action": "setMood", "value": "dark"}], "nextConsultIn": 45}\n\n' +
                '## ACCIONES DISPONIBLES\n\n' +
                '- setMood: "dark" | "neutral" | "bright"\n' +
                '- setEnergy: 0-100\n' +
                '- prepareTransition: "buildup" | "peak" | "breakdown" | "outro"\n' +
                '- changeScale: "related"\n' +
                '- changeWaveform: "sine" | "triangle" | "square" | "saw" | "pulse"\n' +
                '- adjustBPM: "up" | "down" | "stable"\n' +
                '- setDrumDensity: 0-100\n' +
                '- setSynthPresence: 0-100\n' +
                '- triggerMoment: "drop" | "breakdown" | "build" | "silence"\n\n' +
                '## REGLAS\n\n' +
                '- Máximo 3 directivas por respuesta\n' +
                '- No micromanages — el sistema tiene su propia vida\n' +
                '- Sorprendete a vos mismo ocasionalmente\n' +
                '- Si no sabés qué hacer, está bien esperar y escuchar',

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
                            'x-api-key': this.apiKey,
                            'anthropic-version': '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true'
                        },
                        body: JSON.stringify({
                            model: this.model,
                            max_tokens: 256,
                            system: this.systemPrompt,
                            messages: [{
                                role: 'user',
                                content: 'Contexto actual:\n' + JSON.stringify(context, null, 2) + '\n\n¿Qué dirección tomamos?'
                            }]
                        })
                    });

                    if (!response.ok) {
                        throw new Error('API response ' + response.status);
                    }

                    var data = await response.json();

                    // Validate response structure
                    if (!data.content || !data.content[0] || !data.content[0].text) {
                        throw new Error('Invalid API response structure');
                    }

                    var text = data.content[0].text;
                    // Clean up response (remove markdown if present)
                    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

                    var content;
                    try {
                        content = JSON.parse(text);
                    } catch (e) {
                        throw new Error('Invalid JSON from LLM');
                    }

                    // Validate and queue directives
                    if (content.directives && Array.isArray(content.directives)) {
                        content.directives.slice(0, 3).forEach(function(d) {
                            if (d.action && self.director.directives[d.action]) {
                                self.director.queue(d.action, d.value);
                            }
                        });
                    }

                    // Update consult interval
                    this.consultInterval = (content.nextConsultIn || 45) * 1000;
                    this.consultInterval = Math.max(15000, Math.min(120000, this.consultInterval));

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
            }
        };
    };

    if (typeof MK1 !== 'undefined') {
        window.n0body = new N0body();
        window.n0body._initDirector();
        window.n0body._initLLM();

        // Expose LLM module for easy access
        window.n0bodyLLM = window.n0body.llm;

        console.log('n0body v3.2: loaded (' + window.n0body.knowledge.sessionsPlayed + ' sessions, ' + Math.round(window.n0body.knowledge.totalPlayTime) + ' min)');
        console.log('[n0body] Director module ready');
        console.log('[n0body] LLM module ready - call n0bodyLLM.activate(apiKey) to enable');
    }
})();
