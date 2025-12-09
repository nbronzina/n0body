// brain.js — Main N0body class

import { CONFIG } from './config.js';
import { SCALES, SCALE_MOODS } from './scales.js';
import { STATE_CONFIG } from './states.js';
import { randomBetween, randomIntBetween, randomFrom, formatTime } from './utils.js';

class N0body {
    constructor(config = CONFIG, scales = SCALES, scaleMoods = SCALE_MOODS, stateConfig = STATE_CONFIG) {
        this.config = config;
        this.scales = scales;
        this.scaleMoods = scaleMoods;
        this.stateConfig = stateConfig;

        // Estado interno
        this.isPlaying = false;
        this.sessionStart = null;
        this.sessionDuration = null;  // en ms
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
    }

    // ========== CONTROL ==========

    start() {
        if (this.isPlaying) {
            console.log('n0body: already playing');
            return;
        }

        // Verificar que MK1 existe
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

        // Reset stats
        this.stats = {
            drumsPlayed: 0,
            synthNotesPlayed: 0,
            sequencerChanges: 0,
            fxChanges: 0,
            waveformChanges: 0,
        };

        this.initSession();
        this.startLoops();

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

        // Limpiar timers
        if (this.mainLoop) clearInterval(this.mainLoop);
        if (this.synthTimer) clearTimeout(this.synthTimer);
        if (this.fxTimer) clearTimeout(this.fxTimer);

        // Parar mk-1
        MK1.sequencer.stop();
        MK1.synth.stop();

        // Log stats
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

    // ========== INICIALIZACIÓN ==========

    initSession() {
        // Elegir mood y escala para la sesión
        this.currentMood = randomFrom(['dark', 'neutral', 'bright']);
        const scaleNames = this.scaleMoods[this.currentMood];
        this.currentScaleName = randomFrom(scaleNames);
        this.currentScale = this.scales[this.currentScaleName];
        console.log(`n0body: mood=${this.currentMood}, scale=${this.currentScaleName}`);

        // Elegir BPM
        this.currentBPM = Math.round(randomBetween(
            this.config.tempo.bpm.min,
            this.config.tempo.bpm.max
        ));
        MK1.tempo.setBPM(this.currentBPM);
        console.log(`n0body: BPM=${this.currentBPM}`);

        // Elegir waveform inicial
        this.currentWaveform = randomFrom(this.config.waveforms);
        MK1.synth.setWaveform(this.currentWaveform);
        console.log(`n0body: waveform=${this.currentWaveform}`);

        // FX iniciales
        const introFx = this.stateConfig.intro.fx;
        MK1.fx.setReverb(randomBetween(introFx.reverb.min, introFx.reverb.max));
        MK1.fx.setDelay(randomBetween(introFx.delay.min, introFx.delay.max));
        MK1.fx.setFilter(randomBetween(introFx.filter.min, introFx.filter.max));

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
        // Main loop - actualiza estado y toma decisiones (cada 100ms)
        this.mainLoop = setInterval(() => this.tick(), 100);

        // Synth loop - notas independientes
        this.scheduleSynth();

        // FX loop - cambios graduales
        this.scheduleFxChange();
    }

    tick() {
        if (!this.isPlaying) return;

        // Verificar si terminó la sesión
        const elapsed = Date.now() - this.sessionStart;
        if (elapsed >= this.sessionDuration) {
            this.stop();
            return;
        }

        // Actualizar estado
        this.updateState(elapsed);

        // Decisiones de drums (alta frecuencia)
        this.maybePlayDrum();

        // Decisiones de sequencer (baja frecuencia, ~2% por tick)
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

        // Activar/desactivar sequencer
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

        // Ajustar FX para el nuevo estado
        this.transitionFx(stateConf.fx);
    }

    // ========== DRUMS ==========

    maybePlayDrum() {
        const stateConf = this.stateConfig[this.currentState];
        if (Math.random() < stateConf.drums.probability) {
            const pad = randomFrom(stateConf.drums.pads);
            MK1.drums.hit(pad);
            this.stats.drumsPlayed++;
        }
    }

    // ========== SYNTH ==========

    scheduleSynth() {
        if (!this.isPlaying) return;

        const stateConf = this.stateConfig[this.currentState];

        // Decidir si tocar nota
        if (Math.random() < stateConf.synth.probability) {
            const note = randomFrom(this.currentScale);
            const duration = randomBetween(
                stateConf.synth.noteDuration.min,
                stateConf.synth.noteDuration.max
            );
            MK1.synth.play(note, duration);
            this.stats.synthNotesPlayed++;
        }

        // Programar siguiente nota
        const spacing = randomBetween(
            stateConf.synth.noteSpacing.min,
            stateConf.synth.noteSpacing.max
        );
        // Humanización: agregar variación aleatoria
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

        // Elegir track de los activos para este estado
        const track = randomFrom(stateConf.sequencer.tracksActive);
        const step = randomIntBetween(1, 16);

        // Toggle basado en densidad deseada
        const shouldActivate = Math.random() < stateConf.sequencer.density;
        MK1.sequencer.setStep(track, step, shouldActivate);
        this.stats.sequencerChanges++;
    }

    // ========== FX ==========

    scheduleFxChange() {
        if (!this.isPlaying) return;

        const stateConf = this.stateConfig[this.currentState];

        // Cambios sutiles de FX dentro del rango del estado actual
        MK1.fx.setReverb(randomBetween(stateConf.fx.reverb.min, stateConf.fx.reverb.max));
        MK1.fx.setDelay(randomBetween(stateConf.fx.delay.min, stateConf.fx.delay.max));
        MK1.fx.setFilter(randomBetween(stateConf.fx.filter.min, stateConf.fx.filter.max));
        this.stats.fxChanges++;

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

        // Programar siguiente cambio (cada 15-30 segundos)
        const nextChange = randomBetween(15000, 30000);
        this.fxTimer = setTimeout(() => this.scheduleFxChange(), nextChange);
    }

    transitionFx(targetFx) {
        // Transición de FX al cambiar estado
        // Por ahora, cambio directo dentro del rango del nuevo estado
        MK1.fx.setReverb(randomBetween(targetFx.reverb.min, targetFx.reverb.max));
        MK1.fx.setDelay(randomBetween(targetFx.delay.min, targetFx.delay.max));
        MK1.fx.setFilter(randomBetween(targetFx.filter.min, targetFx.filter.max));
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
        };
    }

    // Alias para logging rápido
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

export { N0body };
