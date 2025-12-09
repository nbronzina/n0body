// config.js — General configuration for n0body

const CONFIG = {
    // Sesión
    session: {
        durationMinutes: { min: 15, max: 45 },
    },

    // Tempo (se fija al inicio, no cambia)
    tempo: {
        bpm: { min: 70, max: 130 },
    },

    // Distribución de estados (% de la sesión)
    stateDistribution: {
        intro: 0.08,      // 8%
        buildup: 0.30,    // 30%
        peak: 0.30,       // 30%
        breakdown: 0.20,  // 20%
        outro: 0.12,      // 12%
    },

    // Waveforms disponibles
    waveforms: ['sine', 'square', 'saw', 'triangle'],

    // Probabilidad de cambiar waveform (por minuto)
    waveformChangeChance: 0.3,

    // Humanización (variación aleatoria en timing)
    humanize: {
        timing: 50,  // ±50ms de variación
    },
};

export { CONFIG };
