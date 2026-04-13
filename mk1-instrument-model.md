# mk1-instrument-model.md — n0body's knowledge of mk-1

## What mk-1 is

play·ground's core instrument. Browser-native. Zero dependencies.
Built on Web Audio API. No samples. Pure synthesis.
Live at: https://nbronzina.github.io/playground/mk-1.html

## Surface — what n0body can control

### Drums
8 voices: kick, snare, hat, clap, tom, perc, cymbal, rim
8-track × 16-step sequencer per voice
Pattern data (step on/off) is n0body's highest-expressivity parameter

### Keys
9 wave types: sine, square, saw, triangle, pulse, noise, string, voice, vocoder
Range: c4–c5 (one octave)
Per-voice: attack, release

### FX chain
reverb → delay → filter → chorus → distortion → bitcrush
All addressable. All automatable.

### Looper
4 slots (A/B/C/D) + mic input
Overdub by layers
Cleared at session end — never archived

### Tempo
Master clock: 120 BPM default
All scheduling derives from AudioContext.currentTime

## Modulation (now active)

**Standard waves (sine, square, saw, triangle, pulse, noise, string, voice)**
- driftLFO → driftGain → subOsc.detune
- Rate: 0.1–0.3 Hz / Depth: ±15 cents
- Effect: sub oscillator drifts slowly against unison stack — tape wobble
- Not heard as vibrato — felt as texture

**Formant voice**
- lfo → lfoGain → source.detune + source2.detune
- Rate: 1–2 Hz / Depth: ±20 cents
- Effect: both sawtooth carriers drift together, slow organic pitch movement
- Maintains 5-cent spread between carriers

**What this means for n0body:**
Sustained notes on any wave type now have inherent organic movement.
The piano is no longer static — it breathes.
n0body does not need to automate detune to create texture.
The instrument already carries imperfection by default.

## Parameter expressivity — ranked

1. Pattern data — restructures rhythm completely. Highest range.
2. Filter cutoff + resonance — continuous timbral arc.
3. Reverb wet/dry — spatial and density shift.
4. Tempo — changes groove feel globally. Bar boundary only.
5. Delay time + feedback — rhythmic texture.
6. Attack / Release — articulation character.
7. Wave type — discrete timbral shift. Lowest priority. Requires fade.

## Parameter safety rules

**Safe at any time:**
- Filter cutoff, resonance — ramp ≥ 10ms
- Reverb wet/dry — continuous
- Delay feedback — ramp ≥ 5ms
- Attack / Release — continuous
- Pattern step on/off — quantized to next step
- Chorus, distortion depth — continuous

**Requires care:**
- Tempo — bar boundary only. Reschedule all future events.
- Delay time — ramp ≥ 5ms. Abrupt change causes pitch-zipper artifact.
- OscillatorNode frequency — setTargetAtTime() only. Never direct .value.

**Unsafe mid-performance:**
- Wave type during sustained note — causes phase discontinuity.
  Protocol: fade down (10ms) → change wave → fade up.
- Stopping AudioBufferSourceNode without gain fade-out first.
- Any direct AudioParam .value assignment during playback.

## Safe write pattern

All parameter changes go through safeSetParam():

```js
function safeSetParam(param, target, ctx, rampMs = 30) {
  const now = ctx.currentTime;
  param.cancelAndHoldAtTime(now);
  param.setTargetAtTime(target, now, rampMs / 1000 / 3);
}
```

## Communication protocol

Event-driven via postMessage. Never polling.
Always include scheduled time (when) in messages.

```js
{ type: 'setParam', param, value, rampTime, when }
```

Schedule all writes 100–200ms ahead:
when = audioCtx.currentTime + 0.1

## What mk-1 cannot do (current state)

- Karplus-Strong below ~344 Hz (DelayNode minimum = 128 samples)
- Reverse playback cross-browser (Chrome does not support negative playbackRate)
- Pitch-shifted looper without phase vocoder AudioWorklet
- Granular synthesis (not yet implemented)
- 4-op / 6-op FM (not yet implemented)

## What n0body knows about mk-1's character

The instrument is raw. Browser-native synthesis has grain.
Oscillators are not perfectly clean. Filters have personality.
The bitcrusher adds deliberate degradation.
This imperfection is not a flaw — it is the instrument's identity.
n0body plays with the grain, not against it.
