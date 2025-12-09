// brain.js — Main N0body class with learning

import { CONFIG } from './config.js';
import { SCALES, SCALE_MOODS } from './scales.js';
import { STATE_CONFIG } from './states.js';
import { randomBetween, randomIntBetween, randomFrom, formatTime } from './utils.js';
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

        // Estado interno
        this.isPlaying = false;
        this.sessionStart = null;
        this.sessionDuration = null;
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

        // Stats
        this.stats = {
            drumsPlayed: 0,
            synthNotesPlayed: 0,
            sequencerChanges: 0,
            fxChanges: 0,
            waveformChanges: 0,
        };

        // Learning system
        this.knowledge = loadKnowledge() || initKnowledge();
        this.shortTermMemory = new ShortTermMemory(30);
        this.explorationRate = 0.15;  // 15% exploration, 85% exploitation

        console.log(`n0body: loaded with ${this.knowledge.sessionsPlayed} sessions of experience (${getLevel(this.knowledge.sessionsPlayed)})`);
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
        console.log('  n0body is going live...');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');

        this.isPlaying = true;
        this.sessionStart = Date.now();
        this.sessionDuration = randomBetween(
            this.config.session.durationMinutes.min * 60 * 1000,
            this.config.session.durationMinutes.max * 60 * 1000
        );

        // Reset stats and short-term memory
        this.stats = {
            drumsPlayed: 0,
            synthNotesPlayed: 0,
            sequencerChanges: 0,
            fxChanges: 0,
            waveformChanges: 0,
        };
        this.shortTermMemory.clear();

        // Increment session counter
        this.knowledge.sessionsPlayed++;

        this.initSession();
        this.startLoops();

        const durationMin = Math.round(this.sessionDuration / 1000 / 60);
        console.log(`n0body: session #${this.knowledge.sessionsPlayed} starting`);
        console.log(`n0body: level: ${getLevel(this.knowledge.sessionsPlayed)}`);
        console.log(`n0body: duration ~${durationMin} minutes`);
        console.log('');
    }

    stop() {
        if (!this.isPlaying) {
            console.log('n0body: not playing');
            return;
        }

        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('  n0body is signing off...');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');

        this.isPlaying = false;

        // Limpiar timers
        if (this.mainLoop) clearInterval(this.mainLoop);
        if (this.synthTimer) clearTimeout(this.synthTimer);
        if (this.fxTimer) clearTimeout(this.fxTimer);

        // Parar mk-1
        MK1.sequencer.stop();
        MK1.synth.stop();

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
        console.log(`  duration: ${formatTime(elapsed)}`);
        console.log(`  drums: ${this.stats.drumsPlayed}`);
        console.log(`  synth notes: ${this.stats.synthNotesPlayed}`);
        console.log(`  sequencer changes: ${this.stats.sequencerChanges}`);
        console.log(`  fx changes: ${this.stats.fxChanges}`);
        console.log(`  waveform changes: ${this.stats.waveformChanges}`);
        console.log('');
        console.log(`n0body: total experience: ${this.knowledge.sessionsPlayed} sessions, ${Math.round(this.knowledge.totalPlayTime)} minutes`);
        console.log('n0body: session ended. see you next time.');
        console.log('');
    }

    // ========== LEARNING ==========

    learn(action) {
        // Add context to action
        const contextualAction = {
            ...action,
            context: {
                state: this.currentState,
                bpm: this.currentBPM,
                scale: this.currentScaleName,
                mood: this.currentMood,
            }
        };

        // Add to short-term memory
        this.shortTermMemory.add(contextualAction);

        // Evaluate recent performance
        const recentActions = this.shortTermMemory.getRecent(10);
        const reward = evaluateReward(recentActions);

        // Get learning rate (decreases with experience)
        const lr = getLearningRate(this.knowledge.sessionsPlayed);

        // Update preferences based on action type
        this.updatePreferences(action, reward, lr);

        // Learn combo patterns
        this.learnCombos(reward, lr);
    }

    updatePreferences(action, reward, lr) {
        const state = this.currentState;

        if (action.type === 'drum') {
            const current = this.knowledge.drums[state][action.pad] || 1.0;
            const updated = current + (reward * lr);
            this.knowledge.drums[state][action.pad] = clamp(updated, 0.1, 5.0);
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
            const updated = current + (reward * lr);
            this.knowledge.notes[key][action.note] = clamp(updated, 0.1, 5.0);
        }

        if (action.type === 'fx' && action.param && action.value !== undefined) {
            const fxState = this.knowledge.fx[state]?.[action.param];
            if (fxState && reward > 0) {
                // Move preferred toward current value when it sounds good
                fxState.preferred = fxState.preferred * 0.9 + action.value * 0.1;
            }
        }
    }

    learnCombos(reward, lr) {
        const recent = this.shortTermMemory.getRecent(3);
        if (recent.length < 3) return;

        // Create combo key from last 3 action types
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

        // Exploration: try something random
        if (Math.random() < this.explorationRate) {
            return randomFrom(availablePads);
        }

        // Exploitation: use learned preferences
        const weights = {};
        availablePads.forEach(pad => {
            weights[pad] = this.knowledge.drums[state][pad] || 1.0;
        });

        return weightedChoice(weights);
    }

    chooseSynthNote() {
        const key = `${this.currentScaleName}_${this.currentState}`;
        const weights = this.knowledge.notes[key];

        // If no learned preferences, random from scale
        if (!weights || Object.keys(weights).length === 0) {
            return randomFrom(this.currentScale);
        }

        // Exploration
        if (Math.random() < this.explorationRate) {
            return randomFrom(this.currentScale);
        }

        // Exploitation
        return weightedChoice(weights);
    }

    chooseFxValue(param) {
        const state = this.currentState;
        const fxPref = this.knowledge.fx[state]?.[param];

        if (!fxPref) {
            // No learned preference, use state config
            const range = this.stateConfig[state].fx[param];
            return randomBetween(range.min, range.max);
        }

        // Use preferred value with variance
        const value = fxPref.preferred + (Math.random() - 0.5) * fxPref.variance * 2;
        return clamp(value, 0, 1);
    }

    chooseBPM() {
        const bpmPref = this.knowledge.bpmPreference[this.currentMood];

        if (!bpmPref) {
            return Math.round(randomBetween(
                this.config.tempo.bpm.min,
                this.config.tempo.bpm.max
            ));
        }

        // Use preferred BPM with variance
        const bpm = bpmPref.preferred + (Math.random() - 0.5) * bpmPref.variance * 2;
        return Math.round(clamp(bpm, this.config.tempo.bpm.min, this.config.tempo.bpm.max));
    }

    // ========== INICIALIZACIÓN ==========

    initSession() {
        // Elegir mood y escala para la sesión
        this.currentMood = randomFrom(['dark', 'neutral', 'bright']);
        const scaleNames = this.scaleMoods[this.currentMood];

        // Use scale success to prefer better performing scales
        const scaleWeights = {};
        scaleNames.forEach(name => {
            const success = this.knowledge.scaleSuccess[name];
            scaleWeights[name] = success ? success.avgScore : 1.0;
        });

        this.currentScaleName = weightedChoice(scaleWeights);
        this.currentScale = this.scales[this.currentScaleName];
        console.log(`n0body: mood=${this.currentMood}, scale=${this.currentScaleName}`);

        // Elegir BPM using learned preference
        this.currentBPM = this.chooseBPM();
        MK1.tempo.setBPM(this.currentBPM);
        console.log(`n0body: BPM=${this.currentBPM}`);

        // Elegir waveform inicial
        this.currentWaveform = randomFrom(this.config.waveforms);
        MK1.synth.setWaveform(this.currentWaveform);
        console.log(`n0body: waveform=${this.currentWaveform}`);

        // FX iniciales using learned preferences
        MK1.fx.setReverb(this.chooseFxValue('reverb'));
        MK1.fx.setDelay(this.chooseFxValue('delay'));
        MK1.fx.setFilter(this.chooseFxValue('filter'));

        // Volumen inicial
        MK1.master.setVolume(0.7);

        // Limpiar sequencer
        MK1.sequencer.clearAll();

        // Estado inicial
        this.currentState = 'intro';
        console.log(`n0body: state=intro`);
    }

    // ========== LOOPS ==========

    startLoops() {
        this.mainLoop = setInterval(() => this.tick(), 100);
        this.scheduleSynth();
        this.scheduleFxChange();
    }

    tick() {
        if (!this.isPlaying) return;

        const elapsed = Date.now() - this.sessionStart;
        if (elapsed >= this.sessionDuration) {
            this.stop();
            return;
        }

        this.updateState(elapsed);
        this.maybePlayDrum();

        if (Math.random() < 0.02) {
            this.maybeModifySequencer();
        }
    }

    // ========== ESTADO ==========

    updateState(elapsed) {
        const progress = elapsed / this.sessionDuration;
        const dist = this.config.stateDistribution;

        let newState;
        let cumulative = 0;

        cumulative += dist.intro;
        if (progress < cumulative) {
            newState = 'intro';
        } else {
            cumulative += dist.buildup;
            if (progress < cumulative) {
                newState = 'buildup';
            } else {
                cumulative += dist.peak;
                if (progress < cumulative) {
                    newState = 'peak';
                } else {
                    cumulative += dist.breakdown;
                    if (progress < cumulative) {
                        newState = 'breakdown';
                    } else {
                        newState = 'outro';
                    }
                }
            }
        }

        if (newState !== this.currentState) {
            console.log(`n0body: ${this.currentState} → ${newState} (${Math.round(progress * 100)}%)`);
            this.currentState = newState;
            this.onStateChange(newState);
        }
    }

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

        this.transitionFx(stateConf.fx);
    }

    // ========== DRUMS ==========

    maybePlayDrum() {
        const stateConf = this.stateConfig[this.currentState];
        if (Math.random() < stateConf.drums.probability) {
            const pad = this.chooseDrumPad();  // Now uses learning
            MK1.drums.hit(pad);
            this.stats.drumsPlayed++;

            // Learn from this action
            this.learn({ type: 'drum', pad: pad });
        }
    }

    // ========== SYNTH ==========

    scheduleSynth() {
        if (!this.isPlaying) return;

        const stateConf = this.stateConfig[this.currentState];

        if (Math.random() < stateConf.synth.probability) {
            const note = this.chooseSynthNote();  // Now uses learning
            const duration = randomBetween(
                stateConf.synth.noteDuration.min,
                stateConf.synth.noteDuration.max
            );
            MK1.synth.play(note, duration);
            this.stats.synthNotesPlayed++;

            // Learn from this action
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

        // Learn from this action
        this.learn({ type: 'sequencer', track: track, step: step, active: shouldActivate });
    }

    // ========== FX ==========

    scheduleFxChange() {
        if (!this.isPlaying) return;

        // Use learned FX values
        const reverbValue = this.chooseFxValue('reverb');
        const delayValue = this.chooseFxValue('delay');
        const filterValue = this.chooseFxValue('filter');

        MK1.fx.setReverb(reverbValue);
        MK1.fx.setDelay(delayValue);
        MK1.fx.setFilter(filterValue);
        this.stats.fxChanges++;

        // Learn from FX choices
        this.learn({ type: 'fx', param: 'reverb', value: reverbValue });
        this.learn({ type: 'fx', param: 'delay', value: delayValue });
        this.learn({ type: 'fx', param: 'filter', value: filterValue });

        // Posible cambio de waveform
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

    transitionFx(targetFx) {
        MK1.fx.setReverb(this.chooseFxValue('reverb'));
        MK1.fx.setDelay(this.chooseFxValue('delay'));
        MK1.fx.setFilter(this.chooseFxValue('filter'));
    }

    // ========== DEBUG ==========

    getStatus() {
        const elapsed = this.sessionStart ? Date.now() - this.sessionStart : 0;
        const remaining = this.sessionDuration ? this.sessionDuration - elapsed : 0;
        const progress = this.sessionDuration ? elapsed / this.sessionDuration : 0;

        return {
            isPlaying: this.isPlaying,
            currentState: this.currentState,
            progress: `${Math.round(progress * 100)}%`,
            elapsed: formatTime(elapsed),
            remaining: formatTime(Math.max(0, remaining)),
            duration: formatTime(this.sessionDuration || 0),
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
        console.log('n0body status:');
        console.log(`  playing: ${s.isPlaying}`);
        console.log(`  state: ${s.currentState}`);
        console.log(`  progress: ${s.progress} (${s.elapsed} / ${s.duration})`);
        console.log(`  remaining: ${s.remaining}`);
        console.log(`  mood: ${s.mood}`);
        console.log(`  scale: ${s.scale}`);
        console.log(`  bpm: ${s.bpm}`);
        console.log(`  waveform: ${s.waveform}`);
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
