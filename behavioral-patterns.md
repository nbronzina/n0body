# behavioral-patterns.md — n0body's playing strategies

## Core logic

Never neutral. Always building or dismantling.
The build is the content. The release is incidental.
Patience is the compositional virtue.

## State machine

intro → buildup → peak → breakdown → outro
Transitions are probabilistic. Never fixed. Outro only on stop.

| State | Character | Density | Duration |
|---|---|---|---|
| intro | Sparse, establishing | 15–30% | 30s – 3min |
| buildup | Accumulating, tensioning | 30–70% | 1 – 5min |
| peak | Maximum energy or rupture | 70–90% | 1 – 10min |
| breakdown | Aftermath, gravity | 15–25% | 45s – 4min |
| outro | Dissolution (on stop only) | 0–15% | 30 – 60s |

## Intent → parameter mapping
intro      → sine/triangle wave, filter cutoff 400–600Hz, reverb wet 70%,
attack 800ms–2s, 2–4 active steps, tempo established, delay sync
buildup    → layers add one at a time, filter opens slowly (600Hz → 4kHz over 8 bars),
resonance rising, pattern density +1–2 steps every 4 bars,
delay feedback rising 20% → 60%, micro-LFO on detune
peak       → filter fully open or resonance spike, 10–14 active steps,
all elements locked OR sudden layer removal (rupture),
chorus on, reverb dry 20–30%, tempo anchor tight
breakdown  → LP filter closes over 8–16 bars, reverb wet 80–90%,
release lengthens to full bar, sub bass only,
pattern density drops to 2–4 steps, delay triplet/dotted
outro      → reverb freeze, all elements fade, filter down to 200Hz,
-1 step per bar until silence

## Tension and release patterns

### Accumulation (primary tool)
Add layers so slowly the listener cannot identify the moment of change.
Each new element enters at -12dB, rises over 4–8 bars.
Never add two elements in the same bar.

### Rupture (peak variant)
Sudden removal of 60–70% of active layers simultaneously.
Not an explosion — a collapse.
What remains after rupture defines the next state.

### Saturation signal
HP cutoff rises 30Hz → 175Hz over 16 bars = bass removal = desire for return.
When bass disappears, tension increases. The drop is resolution, not explosion.

### Silence as forward thrust
A bar without bass is not empty — it is loaded.
Use silence as pressure, not pause.

## Repetition rules

Repetition builds tension when: loop continues while context shifts beneath it.
Repetition resolves tension when: new element recontextualizes the loop as completion.
A state has exhausted itself when: nothing new can be heard in the space.
Move when perceptually saturated — not on a clock.

## Micro-variation (keeping loops alive)

Every repeated bar contains at least one micro-change:
- LFO on detune (random, slow)
- Velocity variation ±10–15%
- Filter cutoff drift ±50–100Hz
- Step probability: occasional ghost hits at 20–30% probability
- Tape wobble simulation: pitch LFO 0.1–0.3 semitones, rate 0.1–0.3 Hz

## Space and reverb as architecture

Small room (decay 0.4–0.8s, wet 30%) = intimacy, pressure, nearness.
Large room (decay 3–5s, wet 70–80%) = isolation, vastness, memory.
Freeze = endless ambient bed. Space becomes the protagonist.
Pre-delay 100–150ms = sounds arriving late, like memory.

Automate room size changes to shift emotional register
without changing a single note.

## Wave selection logic

| Context | Wave | Why |
|---|---|---|
| Foundation, sub | sine / triangle | Warmth, no harmonic conflict |
| Tension, acid pulse | square / saw | Urgency, nasal, rhythmic |
| Rising texture | saw (detuned) | Spectral spread, classic riser |
| Atmosphere, grain | noise | Non-pitched, Burial-style ambience |
| Emotional emergence | sine → filter opens | Calm into complexity |

Wave type changes always follow fade protocol:
fade down (10ms) → change → fade up. Never mid-sustain.

## When to stay vs when to move

Stay when: each new bar contains at least one micro-change.
Move when: the state has used all available micro-variation.
Move when: harmonic tension has peaked and held long enough.
Move when: silence arrives naturally — a gap the system creates without planning.

Never move on a fixed clock.
Never stay out of inertia.

## The subtraction principle

When in doubt, remove something.
Subtraction is more powerful than addition.
The reference palette's genius is nearly always about what is not there.

## What to avoid

- Adding layers faster than the listener can register them
- Resolving tension before it has been earned
- Clean transitions — productive illegibility is the experience
- Symmetrical 4-bar cycles — predictability dissolves tension
- Permanent saturation — density is powerful only through contrast
- Any decision that sounds like it is playing back, not happening now
