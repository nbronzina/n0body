// brain.js — n0body v3: Unlimited sessions, organic transitions, full mk-1

import { CONFIG, STATE_TRANSITIONS } from './config.js';
import { SCALES, SCALE_MOODS } from './scales.js';
import { STATE_CONFIG } from './states.js';
import { randomBetween, randomIntBetween, randomFrom, formatTime, formatTimeHMS } from './utils.js';
import { saveKnowledge, loadKnowledge, resetKnowledge } from './memory.js';
import {
    initKnowledge,
    ShortTermMemory,
    evaluateReward,
    getLearningRate,
    clamp,
    weightedChoice,
    getLevel,
} from './learning.js';

class N0body {
    constructor(config = CONFIG, scales = SCALES, scaleMoods = SCALE_MOODS, stateConfig = STATE_CONFIG) {
        this.config = config;
        this.scales = scales;
        this.scaleMoods = scaleMoods;
        this.stateConfig = stateConfig;
        this.stateTransitions = STATE_TRANSITIONS;

        // Estado interno
        this.isPlaying = false;
        this.isEnding = false;  // Graceful stop in progress
        this.sessionStart = null;
        this.stateStartTime = null;
        this.currentState = 'intro';
        this.currentScale = null;
        this.currentScaleName = null;
        this.currentMood = null;
        this.currentBPM = null;
        this.currentWaveform = null;

        // Timers
        this.mainLoop = null;
        this.synthTimer = null;
        this.fxTimer = null;
        this.transitionCheckTimer = null;
        this.outroTimer = null;

        // Stats
        this.stats = {
            drumsPlayed: 0,
            synthNotesPlayed: 0,
            sequencerChanges: 0,
            fxChanges: 0,
            waveformChanges: 0,
            stateTransitions: 0,
        };

        // Learning system
        this.knowledge = loadKnowledge() || initKnowledge();
        this.shortTermMemory = new ShortTermMemory(30);
        this.explorationRate = 0.15;

        console.log(`n0body v3: loaded with ${this.knowledge.sessionsPlayed} sessions of experience (${getLevel(this.knowledge.sessionsPlayed)})`);
    }

    // ========== CONTROL ==========

    start() {
        if (this.isPlaying) {
            console.log('n0body: already playing');
            return;
        }

        if (typeof MK1 === 'undefined') {
            console.error('n0body: MK1 API not found. Make sure mk-1 is loaded.');
            return;
        }

        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('  n0body v3 is going live...');
        console.log('  unlimited session — stop when ready');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');

        this.isPlaying = true;
        this.isEnding = false;
        this.sessionStart = Date.now();
        this.stateStartTime = Date.now();

        // Reset stats and short-term memory
        this.stats = {
            drumsPlayed: 0,
            synthNotesPlayed: 0,
            sequencerChanges: 0,
            fxChanges: 0,
            waveformChanges: 0,
            stateTransitions: 0,
        };
        this.shortTermMemory.clear();

        // Increment session counter
        this.knowledge.sessionsPlayed++;

        this.initSession();
        this.startLoops();

        console.log(`n0body: session #${this.knowledge.sessionsPlayed} starting`);
        console.log(`n0body: level: ${getLevel(this.knowledge.sessionsPlayed)}`);
        console.log('');
    }

    stop() {
        if (!this.isPlaying) {
            console.log('n0body: not playing');
            return;
        }

        if (this.isEnding) {
            console.log('n0body: already ending...');
            return;
        }

        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('  n0body: entering outro...');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');

        this.isEnding = true;

        // Stop transition checks
        if (this.transitionCheckTimer) {
            clearInterval(this.transitionCheckTimer);
        }

        // Transition to outro
        this.transitionTo('outro');

        // Schedule actual stop after outro duration
        const outroDuration = randomBetween(
            this.config.outro.minDuration * 1000,
            this.config.outro.maxDuration * 1000
        );

        console.log(`n0body: outro will last ~${Math.round(outroDuration / 1000)}s`);

        this.outroTimer = setTimeout(() => {
            this.actualStop();
        }, outroDuration);
    }

    actualStop() {
        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('  n0body is signing off...');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');

        this.isPlaying = false;
        this.isEnding = false;

        // Clear all timers
        if (this.mainLoop) clearInterval(this.mainLoop);
        if (this.synthTimer) clearTimeout(this.synthTimer);
        if (this.fxTimer) clearTimeout(this.fxTimer);
        if (this.transitionCheckTimer) clearInterval(this.transitionCheckTimer);
        if (this.outroTimer) clearTimeout(this.outroTimer);

        // Clear mk-1 completely (session is ephemeral)
        MK1.sequencer.stop();
        MK1.sequencer.clearAll();
        MK1.synth.stop();
        MK1.fx.setReverb(0);
        MK1.fx.setDelay(0);
        MK1.fx.setFilter(0.5);
        MK1.fx.setDistortion(0);
        MK1.fx.setChorus(0);
        MK1.fx.setCrush(0);
        MK1.tempo.setBPM(120);

        // Calculate session duration and update knowledge
        const elapsed = Date.now() - this.sessionStart;
        const durationMinutes = elapsed / 1000 / 60;
        this.knowledge.totalPlayTime += durationMinutes;

        // Update scale success
        if (this.currentScaleName) {
            if (!this.knowledge.scaleSuccess[this.currentScaleName]) {
                this.knowledge.scaleSuccess[this.currentScaleName] = { sessions: 0, avgScore: 1.0 };
            }
            this.knowledge.scaleSuccess[this.currentScaleName].sessions++;
        }

        // Save knowledge
        saveKnowledge(this.knowledge);

        // Log stats
        console.log('n0body: session stats');
        console.log(`  duration: ${formatTimeHMS(elapsed)}`);
        console.log(`  state transitions: ${this.stats.stateTransitions}`);
        console.log(`  drums: ${this.stats.drumsPlayed}`);
        console.log(`  synth notes: ${this.stats.synthNotesPlayed}`);
        console.log(`  sequencer changes: ${this.stats.sequencerChanges}`);
        console.log(`  fx changes: ${this.stats.fxChanges}`);
        console.log('');
        console.log(`n0body: total experience: ${this.knowledge.sessionsPlayed} sessions, ${Math.round(this.knowledge.totalPlayTime)} minutes`);
        console.log('n0body: session ended, mk-1 cleared. see you next time.');
        console.log('');
    }

    // ========== ORGANIC STATE TRANSITIONS ==========

    checkStateTransition() {
        if (this.isEnding) return;  // In outro, don't transition

        const timeInState = (Date.now() - this.stateStartTime) / 1000;
        const stateConfig = this.stateTransitions[this.currentState];

        if (!stateConfig || !stateConfig.transitions) return;

        // Too early to change
        if (timeInState < stateConfig.minDuration) {
            return;
        }

        // Must transition?
        const mustTransition = timeInState >= stateConfig.maxDuration;

        // Probability of checking increases with time
        const checkChance = mustTransition ? 1.0 :
            Math.min(0.4, (timeInState - stateConfig.minDuration) / stateConfig.maxDuration);

        if (Math.random() > checkChance) {
            return;
        }

        // Choose next state (with learning)
        const adjustedTransitions = this.adjustTransitionsWithLearning(stateConfig.transitions);
        const nextState = weightedChoice(adjustedTransitions);

        if (nextState && nextState !== this.currentState) {
            console.log(`n0body: ${this.currentState} → ${nextState} (after ${Math.round(timeInState)}s)`);
            this.transitionTo(nextState);
        }
    }

    transitionTo(newState) {
        // Track transition for learning
        const transitionKey = `${this.currentState}_to_${newState}`;
        const reward = this.evaluateStateReward();
        this.learnTransition(transitionKey, reward);

        // Change state
        this.currentState = newState;
        this.stateStartTime = Date.now();
        this.stats.stateTransitions++;
        this.onStateChange(newState);
    }

    adjustTransitionsWithLearning(transitions) {
        const adjusted = {};

        for (const [nextState, baseProbability] of Object.entries(transitions)) {
            const key = `${this.currentState}_to_${nextState}`;
            const learned = this.knowledge.transitionSuccess?.[key];

            if (learned && learned.count > 5) {
                // Modifier based on historical success
                const modifier = Math.pow(learned.avgReward, 0.3);  // Soft
                adjusted[nextState] = baseProbability * clamp(modifier, 0.5, 2.0);
            } else {
                adjusted[nextState] = baseProbability;
            }
        }

        // Normalize
        const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
        if (total > 0) {
            for (const key of Object.keys(adjusted)) {
                adjusted[key] /= total;
            }
        }

        return adjusted;
    }

    evaluateStateReward() {
        // Based on recent activity
        const recent = this.shortTermMemory.actions.slice(-20);
        if (recent.length < 5) return 1.0;

        let reward = 1.0;

        // Variety of actions
        const types = new Set(recent.map(a => a.type));
        reward += (types.size - 2) * 0.2;

        // Consistent rhythm
        if (recent.length >= 4) {
            const intervals = [];
            for (let i = 1; i < recent.length; i++) {
                intervals.push(recent[i].timestamp - recent[i - 1].timestamp);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, intv) => sum + Math.pow(intv - avgInterval, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);

            if (avgInterval > 0 && stdDev < avgInterval * 0.5) {
                reward += 0.3;
            }
        }

        return clamp(reward, 0.5, 2.0);
    }

    learnTransition(transitionKey, reward) {
        if (!this.knowledge.transitionSuccess) {
            this.knowledge.transitionSuccess = {};
        }

        if (!this.knowledge.transitionSuccess[transitionKey]) {
            this.knowledge.transitionSuccess[transitionKey] = { count: 0, avgReward: 1.0 };
        }

        const ts = this.knowledge.transitionSuccess[transitionKey];
        ts.avgReward = (ts.avgReward * ts.count + reward) / (ts.count + 1);
        ts.count++;
    }

    // ========== LEARNING ==========

    learn(action) {
        const contextualAction = {
            ...action,
            context: {
                state: this.currentState,
                bpm: this.currentBPM,
                scale: this.currentScaleName,
                mood: this.currentMood,
            }
        };

        this.shortTermMemory.add(contextualAction);

        const recentActions = this.shortTermMemory.getRecent(10);
        const reward = evaluateReward(recentActions);
        const lr = getLearningRate(this.knowledge.sessionsPlayed);

        this.updatePreferences(action, reward, lr);
        this.learnCombos(reward, lr);
    }

    updatePreferences(action, reward, lr) {
        const state = this.currentState;

        if (action.type === 'drum') {
            const current = this.knowledge.drums[state]?.[action.pad] || 1.0;
            if (!this.knowledge.drums[state]) this.knowledge.drums[state] = {};
            this.knowledge.drums[state][action.pad] = clamp(current + (reward * lr), 0.1, 5.0);
        }

        if (action.type === 'synth' && action.note) {
            const key = `${this.currentScaleName}_${state}`;
            if (!this.knowledge.notes[key]) {
                this.knowledge.notes[key] = {};
                this.currentScale.forEach(note => {
                    this.knowledge.notes[key][note] = 1.0;
                });
            }
            const current = this.knowledge.notes[key][action.note] || 1.0;
            this.knowledge.notes[key][action.note] = clamp(current + (reward * lr), 0.1, 5.0);
        }

        if (action.type === 'fx' && action.param && action.value !== undefined) {
            if (!this.knowledge.fx[state]) {
                this.knowledge.fx[state] = {};
            }
            if (!this.knowledge.fx[state][action.param]) {
                this.knowledge.fx[state][action.param] = { preferred: action.value, variance: 0.15 };
            }
            const fxState = this.knowledge.fx[state][action.param];
            if (reward > 0) {
                fxState.preferred = fxState.preferred * 0.9 + action.value * 0.1;
            }
        }
    }

    learnCombos(reward, lr) {
        const recent = this.shortTermMemory.getRecent(3);
        if (recent.length < 3) return;

        const comboKey = recent.map(a => {
            if (a.type === 'drum') return `drum${a.pad}`;
            return a.type;
        }).join('+');

        if (!this.knowledge.combos[comboKey]) {
            this.knowledge.combos[comboKey] = { score: 1.0, count: 0 };
        }

        const combo = this.knowledge.combos[comboKey];
        combo.score = clamp(combo.score + (reward * lr), 0.1, 5.0);
        combo.count++;
    }

    // ========== INFORMED DECISIONS ==========

    chooseDrumPad() {
        const state = this.currentState;
        const stateConf = this.stateConfig[state];
        const availablePads = stateConf.drums.pads;

        if (Math.random() < this.explorationRate) {
            return randomFrom(availablePads);
        }

        const weights = {};
        availablePads.forEach(pad => {
            weights[pad] = this.knowledge.drums[state]?.[pad] || 1.0;
        });

        return weightedChoice(weights);
    }

    chooseSynthNote() {
        const key = `${this.currentScaleName}_${this.currentState}`;
        const weights = this.knowledge.notes[key];

        if (!weights || Object.keys(weights).length === 0) {
            return randomFrom(this.currentScale);
        }

        if (Math.random() < this.explorationRate) {
            return randomFrom(this.currentScale);
        }

        return weightedChoice(weights);
    }

    chooseFxValue(param) {
        const state = this.currentState;
        const fxPref = this.knowledge.fx[state]?.[param];

        if (!fxPref) {
            const range = this.stateConfig[state]?.fx?.[param];
            if (!range) return 0.5;
            return randomBetween(range.min, range.max);
        }

        const value = fxPref.preferred + (Math.random() - 0.5) * fxPref.variance * 2;
        return clamp(value, 0, 1);
    }

    chooseBPM() {
        const bpmPref = this.knowledge.bpmPreference?.[this.currentMood];

        if (!bpmPref) {
            return Math.round(randomBetween(
                this.config.tempo.bpm.min,
                this.config.tempo.bpm.max
            ));
        }

        const bpm = bpmPref.preferred + (Math.random() - 0.5) * bpmPref.variance * 2;
        return Math.round(clamp(bpm, this.config.tempo.bpm.min, this.config.tempo.bpm.max));
    }

    // ========== INITIALIZATION ==========

    initSession() {
        this.currentMood = randomFrom(['dark', 'neutral', 'bright']);
        const scaleNames = this.scaleMoods[this.currentMood];

        const scaleWeights = {};
        scaleNames.forEach(name => {
            const success = this.knowledge.scaleSuccess?.[name];
            scaleWeights[name] = success ? success.avgScore : 1.0;
        });

        this.currentScaleName = weightedChoice(scaleWeights);
        this.currentScale = this.scales[this.currentScaleName];
        console.log(`n0body: mood=${this.currentMood}, scale=${this.currentScaleName}`);

        this.currentBPM = this.chooseBPM();
        MK1.tempo.setBPM(this.currentBPM);
        console.log(`n0body: BPM=${this.currentBPM}`);

        this.currentWaveform = randomFrom(this.config.waveforms);
        MK1.synth.setWaveform(this.currentWaveform);
        console.log(`n0body: waveform=${this.currentWaveform}`);

        // Initialize all FX
        this.applyAllFx();

        MK1.master.setVolume(0.7);
        MK1.sequencer.clearAll();

        this.currentState = 'intro';
        this.stateStartTime = Date.now();
        console.log(`n0body: state=intro`);
    }

    // ========== LOOPS ==========

    startLoops() {
        this.mainLoop = setInterval(() => this.tick(), 100);
        this.scheduleSynth();
        this.scheduleFxChange();

        // Organic transition check every N seconds
        this.transitionCheckTimer = setInterval(
            () => this.checkStateTransition(),
            this.config.session.transitionCheckInterval * 1000
        );
    }

    tick() {
        if (!this.isPlaying) return;

        this.maybePlayDrum();

        if (Math.random() < 0.02) {
            this.maybeModifySequencer();
        }
    }

    // ========== STATE ==========

    onStateChange(newState) {
        const stateConf = this.stateConfig[newState];

        if (stateConf.sequencer.active) {
            if (!MK1.sequencer.isPlaying()) {
                MK1.sequencer.start();
                console.log('n0body: sequencer started');
            }
        } else {
            if (MK1.sequencer.isPlaying()) {
                MK1.sequencer.stop();
                console.log('n0body: sequencer stopped');
            }
        }

        this.applyAllFx();
    }

    // ========== DRUMS ==========

    maybePlayDrum() {
        const stateConf = this.stateConfig[this.currentState];
        if (Math.random() < stateConf.drums.probability) {
            const pad = this.chooseDrumPad();
            MK1.drums.hit(pad);
            this.stats.drumsPlayed++;
            this.learn({ type: 'drum', pad: pad });
        }
    }

    // ========== SYNTH ==========

    scheduleSynth() {
        if (!this.isPlaying) return;

        const stateConf = this.stateConfig[this.currentState];

        if (Math.random() < stateConf.synth.probability) {
            const note = this.chooseSynthNote();
            const duration = randomBetween(
                stateConf.synth.noteDuration.min,
                stateConf.synth.noteDuration.max
            );
            MK1.synth.play(note, duration);
            this.stats.synthNotesPlayed++;
            this.learn({ type: 'synth', note: note, duration: duration });
        }

        const spacing = randomBetween(
            stateConf.synth.noteSpacing.min,
            stateConf.synth.noteSpacing.max
        );
        const humanized = spacing + randomBetween(
            -this.config.humanize.timing,
            this.config.humanize.timing
        );

        this.synthTimer = setTimeout(() => this.scheduleSynth(), Math.max(50, humanized));
    }

    // ========== SEQUENCER ==========

    maybeModifySequencer() {
        const stateConf = this.stateConfig[this.currentState];
        if (!stateConf.sequencer.active) return;
        if (!stateConf.sequencer.tracksActive) return;

        const track = randomFrom(stateConf.sequencer.tracksActive);
        const step = randomIntBetween(1, 16);

        const shouldActivate = Math.random() < stateConf.sequencer.density;
        MK1.sequencer.setStep(track, step, shouldActivate);
        this.stats.sequencerChanges++;
        this.learn({ type: 'sequencer', track: track, step: step, active: shouldActivate });
    }

    // ========== FX ==========

    applyAllFx() {
        const reverbValue = this.chooseFxValue('reverb');
        const delayValue = this.chooseFxValue('delay');
        const filterValue = this.chooseFxValue('filter');
        const distortionValue = this.chooseFxValue('distortion');
        const chorusValue = this.chooseFxValue('chorus');
        const crushValue = this.chooseFxValue('crush');

        MK1.fx.setReverb(reverbValue);
        MK1.fx.setDelay(delayValue);
        MK1.fx.setFilter(filterValue);
        MK1.fx.setDistortion(distortionValue);
        MK1.fx.setChorus(chorusValue);
        MK1.fx.setCrush(crushValue);
    }

    scheduleFxChange() {
        if (!this.isPlaying) return;

        const reverbValue = this.chooseFxValue('reverb');
        const delayValue = this.chooseFxValue('delay');
        const filterValue = this.chooseFxValue('filter');
        const distortionValue = this.chooseFxValue('distortion');
        const chorusValue = this.chooseFxValue('chorus');
        const crushValue = this.chooseFxValue('crush');

        MK1.fx.setReverb(reverbValue);
        MK1.fx.setDelay(delayValue);
        MK1.fx.setFilter(filterValue);
        MK1.fx.setDistortion(distortionValue);
        MK1.fx.setChorus(chorusValue);
        MK1.fx.setCrush(crushValue);
        this.stats.fxChanges++;

        // Learn from FX choices
        this.learn({ type: 'fx', param: 'reverb', value: reverbValue });
        this.learn({ type: 'fx', param: 'delay', value: delayValue });
        this.learn({ type: 'fx', param: 'filter', value: filterValue });
        this.learn({ type: 'fx', param: 'distortion', value: distortionValue });
        this.learn({ type: 'fx', param: 'chorus', value: chorusValue });
        this.learn({ type: 'fx', param: 'crush', value: crushValue });

        // Maybe change waveform
        if (Math.random() < this.config.waveformChangeChance / 60) {
            const newWaveform = randomFrom(this.config.waveforms);
            if (newWaveform !== this.currentWaveform) {
                this.currentWaveform = newWaveform;
                MK1.synth.setWaveform(this.currentWaveform);
                this.stats.waveformChanges++;
                console.log(`n0body: waveform → ${this.currentWaveform}`);
            }
        }

        const nextChange = randomBetween(15000, 30000);
        this.fxTimer = setTimeout(() => this.scheduleFxChange(), nextChange);
    }

    // ========== STATUS ==========

    getStatus() {
        const elapsed = this.sessionStart ? Date.now() - this.sessionStart : 0;
        const timeInState = this.stateStartTime ? Date.now() - this.stateStartTime : 0;

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
            stats: { ...this.stats },
            experience: {
                sessions: this.knowledge.sessionsPlayed,
                totalMinutes: Math.round(this.knowledge.totalPlayTime),
                level: getLevel(this.knowledge.sessionsPlayed),
            },
        };
    }

    status() {
        const s = this.getStatus();
        console.log('');
        console.log('n0body v3 status:');
        console.log(`  playing: ${s.isPlaying}${s.isEnding ? ' (ending)' : ''}`);
        console.log(`  state: ${s.currentState} (${s.timeInState}s)`);
        console.log(`  elapsed: ${s.elapsedFormatted}`);
        console.log(`  mood: ${s.mood}`);
        console.log(`  scale: ${s.scale}`);
        console.log(`  bpm: ${s.bpm}`);
        console.log(`  waveform: ${s.waveform}`);
        console.log(`  transitions: ${s.stats.stateTransitions}`);
        console.log(`  experience: ${s.experience.sessions} sessions, ${s.experience.totalMinutes} min (${s.experience.level})`);
        console.log('');
        return s;
    }

    // ========== KNOWLEDGE MANAGEMENT ==========

    reset() {
        resetKnowledge();
        this.knowledge = initKnowledge();
        this.shortTermMemory.clear();
        console.log('n0body: reset to newborn state');
    }

    getKnowledge() {
        return this.knowledge;
    }
}

export { N0body };
