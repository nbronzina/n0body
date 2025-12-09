// config.js — General configuration for n0body v3

const CONFIG = {
    // Sesión — SIN LÍMITE DE TIEMPO
    session: {
        transitionCheckInterval: 10,  // Segundos entre chequeos de transición
    },

    // Tempo (se fija al inicio, puede evolucionar)
    tempo: {
        bpm: { min: 70, max: 130 },
    },

    // Waveforms disponibles
    waveforms: ['sine', 'square', 'saw', 'triangle', 'pulse', 'noise'],

    // Probabilidad de cambiar waveform (por minuto)
    waveformChangeChance: 0.3,

    // Humanización (variación aleatoria en timing)
    humanize: {
        timing: 50,  // ±50ms de variación
    },

    // Graceful stop
    outro: {
        minDuration: 30,  // segundos
        maxDuration: 60,
    },
};

// Matriz de transiciones orgánicas
const STATE_TRANSITIONS = {
    intro: {
        minDuration: 30,      // Segundos mínimos antes de poder cambiar
        maxDuration: 180,     // Después de esto, forzar transición
        transitions: {
            buildup: 0.7,     // 70% ir a buildup
            intro: 0.3,       // 30% quedarse
        }
    },
    buildup: {
        minDuration: 60,
        maxDuration: 300,
        transitions: {
            peak: 0.5,
            buildup: 0.3,
            breakdown: 0.15,
            intro: 0.05,
        }
    },
    peak: {
        minDuration: 60,
        maxDuration: 600,     // Hasta 10 min en peak
        transitions: {
            peak: 0.5,        // Mantener energía
            breakdown: 0.35,
            buildup: 0.15,    // Second drop
        }
    },
    breakdown: {
        minDuration: 45,
        maxDuration: 240,
        transitions: {
            buildup: 0.5,
            breakdown: 0.3,
            intro: 0.15,
            peak: 0.05,       // Sorpresa
        }
    },
    outro: {
        // Solo se usa al hacer stop()
        minDuration: 30,
        maxDuration: 60,
        transitions: {}       // No transiciona, termina
    },
};

export { CONFIG, STATE_TRANSITIONS };
