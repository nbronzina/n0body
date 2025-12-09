// states.js — State configuration for n0body sessions

const STATE_CONFIG = {
    intro: {
        drums: {
            probability: 0.05,      // Muy raro
            pads: [1, 2],           // Solo kick y snare suave
        },
        synth: {
            probability: 0.15,
            noteDuration: { min: 0.5, max: 2 },
            noteSpacing: { min: 2000, max: 5000 },  // ms entre notas
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
            pads: [1, 2, 3, 5],     // Más variedad
        },
        synth: {
            probability: 0.35,
            noteDuration: { min: 0.2, max: 1 },
            noteSpacing: { min: 800, max: 2500 },
        },
        sequencer: {
            active: true,
            density: 0.2,           // 20% de steps activos
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
            pads: [1, 2, 3, 4, 5, 6, 7, 8],  // Todos
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
            reverb: { min: 0.6, max: 0.8 },  // Reverb alto para fade
            delay: { min: 0, max: 0.1 },
            filter: { min: 0.2, max: 0.4 },
        },
    },
};

export { STATE_CONFIG };
