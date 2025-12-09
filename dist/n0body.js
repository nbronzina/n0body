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
        if (sessions < 5) return 'newborn';
        if (sessions < 15) return 'learning';
        if (sessions < 30) return 'developing';
        if (sessions < 50) return 'skilled';
        if (sessions < 100) return 'experienced';
        return 'master';
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

    // ========== CONFIG v3.2 ==========
    var CONFIG = {
        session: { transitionCheckInterval: 10 },
        tempo: { bpm: { min: 70, max: 130 } },
        waveforms: ['sine', 'square', 'saw', 'triangle', 'pulse'],
        waveformChangeChance: 0.1,
        humanize: { timing: 50 },
        outro: { minDuration: 30, maxDuration: 60 },
        fxChangeInterval: { min: 45000, max: 90000 },
    };

    // State transitions (organic, probability-based) - faster settling
    var STATE_TRANSITIONS = {
        intro: { minDuration: 20, maxDuration: 90, transitions: { buildup: 0.8, intro: 0.2 } },
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
            drums: { probability: 0, pads: [1, 2] },
            synth: { probability: 0.02, noteDuration: { min: 2, max: 5 }, noteSpacing: { min: 6000, max: 15000 } },
            sequencer: { active: false },
            fx: { reverb: { min: 0.3, max: 0.5 }, delay: { min: 0, max: 0.2 }, filter: { min: 0.4, max: 0.6 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0, max: 0.15 }, crush: { min: 0, max: 0 } },
        },
        buildup: {
            drums: { probability: 0.005, pads: [1, 2] },
            synth: { probability: 0.03, noteDuration: { min: 1, max: 3 }, noteSpacing: { min: 3000, max: 8000 } },
            sequencer: { active: true, density: 0.15, tracksActive: [1, 2] },
            fx: { reverb: { min: 0.4, max: 0.6 }, delay: { min: 0.15, max: 0.35 }, filter: { min: 0.5, max: 0.7 }, distortion: { min: 0, max: 0.1 }, chorus: { min: 0.1, max: 0.25 }, crush: { min: 0, max: 0 } },
        },
        peak: {
            drums: { probability: 0.01, pads: [1, 2] },
            synth: { probability: 0.05, noteDuration: { min: 0.5, max: 2 }, noteSpacing: { min: 2000, max: 5000 } },
            sequencer: { active: true, density: 0.35, tracksActive: [1, 2, 3, 4] },
            fx: { reverb: { min: 0.5, max: 0.75 }, delay: { min: 0.25, max: 0.5 }, filter: { min: 0.6, max: 0.85 }, distortion: { min: 0.05, max: 0.2 }, chorus: { min: 0.15, max: 0.35 }, crush: { min: 0, max: 0.1 } },
        },
        breakdown: {
            drums: { probability: 0, pads: [1, 2] },
            synth: { probability: 0.03, noteDuration: { min: 1.5, max: 4 }, noteSpacing: { min: 4000, max: 10000 } },
            sequencer: { active: true, density: 0.1, tracksActive: [1, 2] },
            fx: { reverb: { min: 0.45, max: 0.6 }, delay: { min: 0.1, max: 0.25 }, filter: { min: 0.35, max: 0.55 }, distortion: { min: 0, max: 0.05 }, chorus: { min: 0.1, max: 0.2 }, crush: { min: 0, max: 0 } },
        },
        outro: {
            drums: { probability: 0, pads: [1] },
            synth: { probability: 0.01, noteDuration: { min: 3, max: 6 }, noteSpacing: { min: 8000, max: 20000 } },
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

        this.knowledge = loadKnowledge() || initKnowledge();
        this.shortTermMemory = new ShortTermMemory(30);
        this.explorationRate = 0.15;
    }

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
        var transitionKey = this.currentState + '_to_' + newState;
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
        var availablePads = stateConf.drums.pads;
        if (Math.random() < this.explorationRate) return randomFrom(availablePads);
        var weights = {};
        var self = this;
        availablePads.forEach(function(pad) { weights[pad] = (self.knowledge.drums[state] && self.knowledge.drums[state][pad]) || 1.0; });
        return weightedChoice(weights);
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

        // First note: start in the middle of the scale
        this.lastNote = scale[Math.floor(scale.length / 2)];
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
        if (Math.random() < this.explorationRate) {
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
            // Reduce variance when we find what works (more confident)
            bpmPref.variance = Math.max(5, bpmPref.variance * (1 - lr * 0.1));
        } else if (sessionReward < -0.5) {
            // Bad session: increase variance to explore more
            bpmPref.variance = Math.min(20, bpmPref.variance * (1 + lr * 0.1));
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
        if (Math.random() < this.explorationRate) {
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
        if (Math.random() < this.explorationRate) {
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
        if (Math.random() < this.explorationRate) {
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
            // Reduce variance (more confident)
            durPref.variance = Math.max(10, durPref.variance * (1 - lr * 0.1));
        } else if (reward < -0.5) {
            // Bad: increase variance to explore more
            durPref.variance = Math.min(durPref.max - durPref.min, durPref.variance * (1 + lr * 0.1));
        }
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

        // REST - let the base breathe
        var restChance = this.restProbability[this.currentState] || 0.6;
        if (Math.random() < restChance) {
            // Only check looper during rest, no other actions
            this._trackEnergy('rest');
            this._maybeUseLooper();
            return;
        }

        this._maybePlayDrum();
        if (Math.random() < 0.015) this._maybeModifySequencer();
        this._maybeUseLooper();
    };

    N0body.prototype._onStateChange = function(newState) {
        var stateConf = this.stateConfig[newState];
        if (stateConf.sequencer.active) { if (!MK1.sequencer.isPlaying()) MK1.sequencer.start(); }
        else { if (MK1.sequencer.isPlaying()) MK1.sequencer.stop(); }
        this._applyAllFx();
    };

    N0body.prototype._maybePlayDrum = function() {
        var stateConf = this.stateConfig[this.currentState];
        if (Math.random() < stateConf.drums.probability) {
            var pad = this._chooseDrumPad();
            MK1.drums.hit(pad);
            this.stats.drumsPlayed++;
            this._learn({ type: 'drum', pad: pad });
            this._trackEnergy('drum');
        }
    };

    N0body.prototype._scheduleSynth = function() {
        if (!this.isPlaying) return;
        var self = this;
        var stateConf = this.stateConfig[this.currentState];
        if (Math.random() < stateConf.synth.probability) {
            var note = this._chooseSynthNote();
            var duration = randomBetween(stateConf.synth.noteDuration.min, stateConf.synth.noteDuration.max);
            MK1.synth.play(note, duration);
            this.stats.synthNotesPlayed++;
            this._learn({ type: 'synth', note: note });
            this._trackEnergy('synth');
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

        // Rare waveform change
        if (Math.random() < this.config.waveformChangeChance / 100) {
            var newWaveform = randomFrom(this.config.waveforms);
            if (newWaveform !== this.currentWaveform) {
                this.currentWaveform = newWaveform;
                MK1.synth.setWaveform(this.currentWaveform);
                this.stats.waveformChanges++;
            }
        }

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
            experience: { sessions: this.knowledge.sessionsPlayed, totalMinutes: Math.round(this.knowledge.totalPlayTime), level: getLevel(this.knowledge.sessionsPlayed) }
        };
    };

    N0body.prototype.reset = function() {
        resetKnowledge();
        this.knowledge = initKnowledge();
        this.shortTermMemory.clear();
        console.log('n0body: reset to newborn state');
    };

    N0body.prototype.getKnowledge = function() { return this.knowledge; };

    if (typeof MK1 !== 'undefined') {
        window.n0body = new N0body();
        console.log('n0body v3.2: loaded (' + window.n0body.knowledge.sessionsPlayed + ' sessions, ' + Math.round(window.n0body.knowledge.totalPlayTime) + ' min)');
    }
})();
