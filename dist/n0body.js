/**
 * n0body — the first non-human performer of Playground
 *
 * Usage:
 *   1. Open mk-1: https://nbronzina.github.io/playground/mk-1.html
 *   2. Open browser console (F12)
 *   3. Paste this entire file
 *   4. Run: n0body.start()
 *   5. To stop: n0body.stop()
 *   6. To check status: n0body.status()
 */

(function() {
    'use strict';

    // ========== SCALES ==========

    const SCALES = {
        // Menores (mood oscuro, melancólico)
        cMinor: ['C3', 'D3', 'Eb3', 'F3', 'G3', 'Ab3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4'],
        aMinor: ['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
        dMinor: ['D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],

        // Mayores (mood brillante)
        cMajor: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
        gMajor: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4'],

        // Pentatónicas (versátiles, menos disonancia)
        cMinorPentatonic: ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4', 'G4', 'Bb4'],
        aMinorPentatonic: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4'],

        // Modales (ambient, experimental)
        dDorian: ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
        aPhrygian: ['A2', 'Bb2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4'],
    };

    const SCALE_MOODS = {
        dark: ['cMinor', 'aMinor', 'dMinor', 'aPhrygian'],
        bright: ['cMajor', 'gMajor'],
        neutral: ['cMinorPentatonic', 'aMinorPentatonic', 'dDorian'],
    };

    // ========== CONFIG ==========

    const CONFIG = {
        session: {
            durationMinutes: { min: 15, max: 45 },
        },
        tempo: {
            bpm: { min: 70, max: 130 },
        },
        stateDistribution: {
            intro: 0.08,
            buildup: 0.30,
            peak: 0.30,
            breakdown: 0.20,
            outro: 0.12,
        },
        waveforms: ['sine', 'square', 'saw', 'triangle'],
        waveformChangeChance: 0.3,
        humanize: {
            timing: 50,
        },
    };

    // ========== STATE CONFIG ==========

    const STATE_CONFIG = {
        intro: {
            drums: {
                probability: 0.05,
                pads: [1, 2],
            },
            synth: {
                probability: 0.15,
                noteDuration: { min: 0.5, max: 2 },
                noteSpacing: { min: 2000, max: 5000 },
            },
            sequencer: {
                active: false,
            },
            fx: {
                reverb: { min: 0.3, max: 0.5 },
                delay: { min: 0, max: 0.2 },
                filter: { min: 0.4, max: 0.6 },
            },
        },
        buildup: {
            drums: {
                probability: 0.2,
                pads: [1, 2, 3, 5],
            },
            synth: {
                probability: 0.35,
                noteDuration: { min: 0.2, max: 1 },
                noteSpacing: { min: 800, max: 2500 },
            },
            sequencer: {
                active: true,
                density: 0.2,
                tracksActive: [1, 2],
            },
            fx: {
                reverb: { min: 0.4, max: 0.6 },
                delay: { min: 0.2, max: 0.4 },
                filter: { min: 0.5, max: 0.7 },
            },
        },
        peak: {
            drums: {
                probability: 0.4,
                pads: [1, 2, 3, 4, 5, 6, 7, 8],
            },
            synth: {
                probability: 0.5,
                noteDuration: { min: 0.1, max: 0.8 },
                noteSpacing: { min: 300, max: 1200 },
            },
            sequencer: {
                active: true,
                density: 0.5,
                tracksActive: [1, 2, 3, 4, 5, 6],
            },
            fx: {
                reverb: { min: 0.5, max: 0.8 },
                delay: { min: 0.3, max: 0.6 },
                filter: { min: 0.6, max: 0.9 },
            },
        },
        breakdown: {
            drums: {
                probability: 0.15,
                pads: [1, 2, 5],
            },
            synth: {
                probability: 0.25,
                noteDuration: { min: 0.3, max: 1.5 },
                noteSpacing: { min: 1500, max: 4000 },
            },
            sequencer: {
                active: true,
                density: 0.15,
                tracksActive: [1, 2],
            },
            fx: {
                reverb: { min: 0.4, max: 0.6 },
                delay: { min: 0.1, max: 0.3 },
                filter: { min: 0.3, max: 0.5 },
            },
        },
        outro: {
            drums: {
                probability: 0.03,
                pads: [1],
            },
            synth: {
                probability: 0.1,
                noteDuration: { min: 1, max: 3 },
                noteSpacing: { min: 3000, max: 8000 },
            },
            sequencer: {
                active: false,
            },
            fx: {
                reverb: { min: 0.6, max: 0.8 },
                delay: { min: 0, max: 0.1 },
                filter: { min: 0.2, max: 0.4 },
            },
        },
    };

    // ========== UTILS ==========

    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randomIntBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomFrom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // ========== N0BODY CLASS ==========

    class N0body {
        constructor() {
            this.config = CONFIG;
            this.scales = SCALES;
            this.scaleMoods = SCALE_MOODS;
            this.stateConfig = STATE_CONFIG;

            this.isPlaying = false;
            this.sessionStart = null;
            this.sessionDuration = null;
            this.currentState = 'intro';
            this.currentScale = null;
            this.currentScaleName = null;
            this.currentMood = null;
            this.currentBPM = null;
            this.currentWaveform = null;

            this.mainLoop = null;
            this.synthTimer = null;
            this.fxTimer = null;

            this.stats = {
                drumsPlayed: 0,
                synthNotesPlayed: 0,
                sequencerChanges: 0,
                fxChanges: 0,
                waveformChanges: 0,
            };
        }

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

            this.stats = {
                drumsPlayed: 0,
                synthNotesPlayed: 0,
                sequencerChanges: 0,
                fxChanges: 0,
                waveformChanges: 0,
            };

            this._initSession();
            this._startLoops();

            const durationMin = Math.round(this.sessionDuration / 1000 / 60);
            console.log(`n0body: session duration ~${durationMin} minutes`);
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

            if (this.mainLoop) clearInterval(this.mainLoop);
            if (this.synthTimer) clearTimeout(this.synthTimer);
            if (this.fxTimer) clearTimeout(this.fxTimer);

            MK1.sequencer.stop();
            MK1.synth.stop();

            const elapsed = Date.now() - this.sessionStart;
            console.log('n0body: session stats');
            console.log(`  duration: ${formatTime(elapsed)}`);
            console.log(`  drums: ${this.stats.drumsPlayed}`);
            console.log(`  synth notes: ${this.stats.synthNotesPlayed}`);
            console.log(`  sequencer changes: ${this.stats.sequencerChanges}`);
            console.log(`  fx changes: ${this.stats.fxChanges}`);
            console.log(`  waveform changes: ${this.stats.waveformChanges}`);
            console.log('');
            console.log('n0body: session ended. see you next time.');
            console.log('');
        }

        _initSession() {
            this.currentMood = randomFrom(['dark', 'neutral', 'bright']);
            const scaleNames = this.scaleMoods[this.currentMood];
            this.currentScaleName = randomFrom(scaleNames);
            this.currentScale = this.scales[this.currentScaleName];
            console.log(`n0body: mood=${this.currentMood}, scale=${this.currentScaleName}`);

            this.currentBPM = Math.round(randomBetween(
                this.config.tempo.bpm.min,
                this.config.tempo.bpm.max
            ));
            MK1.tempo.setBPM(this.currentBPM);
            console.log(`n0body: BPM=${this.currentBPM}`);

            this.currentWaveform = randomFrom(this.config.waveforms);
            MK1.synth.setWaveform(this.currentWaveform);
            console.log(`n0body: waveform=${this.currentWaveform}`);

            const introFx = this.stateConfig.intro.fx;
            MK1.fx.setReverb(randomBetween(introFx.reverb.min, introFx.reverb.max));
            MK1.fx.setDelay(randomBetween(introFx.delay.min, introFx.delay.max));
            MK1.fx.setFilter(randomBetween(introFx.filter.min, introFx.filter.max));

            MK1.master.setVolume(0.7);
            MK1.sequencer.clearAll();

            this.currentState = 'intro';
            console.log(`n0body: state=intro`);
        }

        _startLoops() {
            this.mainLoop = setInterval(() => this._tick(), 100);
            this._scheduleSynth();
            this._scheduleFxChange();
        }

        _tick() {
            if (!this.isPlaying) return;

            const elapsed = Date.now() - this.sessionStart;
            if (elapsed >= this.sessionDuration) {
                this.stop();
                return;
            }

            this._updateState(elapsed);
            this._maybePlayDrum();

            if (Math.random() < 0.02) {
                this._maybeModifySequencer();
            }
        }

        _updateState(elapsed) {
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
                this._onStateChange(newState);
            }
        }

        _onStateChange(newState) {
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

            this._transitionFx(stateConf.fx);
        }

        _maybePlayDrum() {
            const stateConf = this.stateConfig[this.currentState];
            if (Math.random() < stateConf.drums.probability) {
                const pad = randomFrom(stateConf.drums.pads);
                MK1.drums.hit(pad);
                this.stats.drumsPlayed++;
            }
        }

        _scheduleSynth() {
            if (!this.isPlaying) return;

            const stateConf = this.stateConfig[this.currentState];

            if (Math.random() < stateConf.synth.probability) {
                const note = randomFrom(this.currentScale);
                const duration = randomBetween(
                    stateConf.synth.noteDuration.min,
                    stateConf.synth.noteDuration.max
                );
                MK1.synth.play(note, duration);
                this.stats.synthNotesPlayed++;
            }

            const spacing = randomBetween(
                stateConf.synth.noteSpacing.min,
                stateConf.synth.noteSpacing.max
            );
            const humanized = spacing + randomBetween(
                -this.config.humanize.timing,
                this.config.humanize.timing
            );

            this.synthTimer = setTimeout(() => this._scheduleSynth(), Math.max(50, humanized));
        }

        _maybeModifySequencer() {
            const stateConf = this.stateConfig[this.currentState];
            if (!stateConf.sequencer.active) return;
            if (!stateConf.sequencer.tracksActive) return;

            const track = randomFrom(stateConf.sequencer.tracksActive);
            const step = randomIntBetween(1, 16);

            const shouldActivate = Math.random() < stateConf.sequencer.density;
            MK1.sequencer.setStep(track, step, shouldActivate);
            this.stats.sequencerChanges++;
        }

        _scheduleFxChange() {
            if (!this.isPlaying) return;

            const stateConf = this.stateConfig[this.currentState];

            MK1.fx.setReverb(randomBetween(stateConf.fx.reverb.min, stateConf.fx.reverb.max));
            MK1.fx.setDelay(randomBetween(stateConf.fx.delay.min, stateConf.fx.delay.max));
            MK1.fx.setFilter(randomBetween(stateConf.fx.filter.min, stateConf.fx.filter.max));
            this.stats.fxChanges++;

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
            this.fxTimer = setTimeout(() => this._scheduleFxChange(), nextChange);
        }

        _transitionFx(targetFx) {
            MK1.fx.setReverb(randomBetween(targetFx.reverb.min, targetFx.reverb.max));
            MK1.fx.setDelay(randomBetween(targetFx.delay.min, targetFx.delay.max));
            MK1.fx.setFilter(randomBetween(targetFx.filter.min, targetFx.filter.max));
        }

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
            console.log('');
            return s;
        }
    }

    // ========== INITIALIZATION ==========

    if (typeof MK1 === 'undefined') {
        console.error('');
        console.error('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.error('  n0body: MK1 API not found');
        console.error('  Make sure you are on mk-1.html');
        console.error('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.error('');
    } else {
        window.n0body = new N0body();

        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('  n0body loaded');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');
        console.log('  n0body.start()   — begin session');
        console.log('  n0body.stop()    — end session');
        console.log('  n0body.status()  — current state');
        console.log('');
        console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
        console.log('');
    }

})();
