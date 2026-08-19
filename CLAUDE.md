# CLAUDE.md — n0body

## Identity

n0body is the first airtist of play·ground.
An autonomous agent that learns and plays mk-1.
Broadcasts live on mk-air. Disappears when the session ends.

Live: https://nbronzina.github.io/n0body/

## Philosophy

> "The session is ephemeral. The artist evolves."

No archive. No replay. No persistence of performance — only of knowledge.

## Relationship to play·ground

n0body plays mk-1. n0body broadcasts on mk-air.
n0body owns nothing — it inhabits what play·ground built.

Repo: github.com/nbronzina/playground
Stage: mk-air.onrender.com

## Architecture

Groq IS n0body. The code is mk-1's hands.

```
             GROQ (Llama 3.3 70B — the mind)
                      │
         ┌────────────┼────────────┐
         │            │            │
   sees grooves  sees phrases  sees reward model
   favorites     favorites     calibrated
         │            │            │
         └────────────┼────────────┘
                      │
                decides a plan
                      │
           ┌──────────┼──────────┐
           │          │          │
     setDrumPattern  playSynthPhrase  setEnergy/FX
           │          │          │
           ▼          ▼          ▼
      groove       phrase      reward model
      learning     learning    recalibrates
           │          │          │
           └──────────┼──────────┘
                      │
               evaluateReward
               (self-calibrating)
                      │
            next Groq prompt
            (scores, grooves, phrases,
             guidelines, reflections)
```

One loop. Groq directs, code executes and learns, Groq sees what
code learned, adjusts direction. Not two systems — one musician
with a mind (Groq) and muscle memory (code).

## Repository Structure

n0body/
├── CLAUDE.md
├── index.html              — UI + embedded brain (live runtime)
├── package.json
├── README.md
├── IDENTITY.md             — who n0body is, what it plays toward
├── mk1-instrument-model.md — perceptual + parameter model of mk-1
├── behavioral-patterns.md  — playing strategies
├── session-manifest.json   — handoff state between sessions (schema)
├── tried-rejected.json     — patterns that didn't work (schema)
├── decision-log.jsonl      — append-only decision record (schema)
├── dist/
│   └── n0body.js           — source of truth (manual bundle)
└── src/
    ├── session-supervisor.js — deterministic session lifecycle manager
    └── (legacy files)       — see src/README.md

## Build

dist/n0body.js is the single source of truth.
index.html embeds dist/ inside a template literal (backslashes and
backticks escaped). Changes go to dist/ first, then re-embed in
index.html using the build script in scratchpad.
src/ files (except session-supervisor.js) are legacy — do not edit.

## State Machine (musical states)

intro → buildup → peak → breakdown → outro
Transitions are probabilistic. Outro only on stop.

### State Durations

| State     | Min  | Max   |
|-----------|------|-------|
| intro     | 20s  | 90s   |
| buildup   | 45s  | 180s  |
| peak      | 60s  | 480s  |
| breakdown | 30s  | 150s  |
| outro     | 30s  | 60s   |

Durations are learnable — `_getStateDuration` uses knowledge to
adjust preferred duration per state with experience.

## Session Supervisor (session-supervisor.js)

Deterministic JS process that manages session lifecycle. No LLM calls.
Groq is the creative engine. The supervisor is the process manager.

### FSM

IDLE → INITIALIZING → NOMINAL → DENSITY_REDUCED → OUTRO → HANDOFF → TERMINATED
Any active state → EMERGENCY_STOP → TERMINATED
TERMINATED → IDLE (ready for next session)

### Termination Triggers

1. Context threshold: Groq consecutive errors ≥ 2
2. Groq OUTRO request: `n0body-request-outro` CustomEvent
3. Repetition detection: 4/5 recent Groq decisions >80% Jaccard similarity
4. Entropy degradation: Shannon entropy <0.3 bits (stuck loop) or monotonically rising (noise)
5. Render capacity >95% for >10 seconds → EMERGENCY_STOP
6. Manual stop: user presses [stop]

No hard time limit — sessions run as long as they're healthy.

### Render Capacity Ladder

| Load  | Actions                                          |
|-------|--------------------------------------------------|
| >70%  | reduce polyphony to 0.75×, disable chorus        |
| >80%  | switch to algorithmic reverb                     |
| >85%  | max 4 voices, bypass per-voice FX                |
| >90%  | single voice, bypass all FX                      |
| >95%  | EMERGENCY_STOP after 10s                         |

### Outro Sequence (2 minutes)

1. Signal n0body to enter outro state
2. Master gain fade over 90 seconds (30 steps × 3s)
3. Write session-manifest.json at 30 seconds remaining
4. On silence confirmed → HANDOFF → dual-context crossfade

### Dual-Context Crossfade

1. Create new AudioContext BEFORE closing old
2. GainNode fadeout on old context over 3 seconds
3. After 3.5 seconds: close old context, null all old node references
4. Dispatch `n0body-new-audio-context` event with new context
5. Read session-manifest.json → warm start with `next_session_intent`

### Boot Sequence (every session start)

1. Read session-manifest.json — load previous musical state and intentions
2. Check `session_interrupted` flag
3. Read tried-rejected.json — know what to avoid
4. Read last 10 lines of decision-log.jsonl — recent context
5. Set `_supervisorBootHints` on n0body for Groq's opening prompt
6. Transition to NOMINAL

## Integration Points (session-supervisor.js ↔ brain.js)

| Property / Event | Direction | Purpose |
|---|---|---|
| `_supervisorBootHints` | supervisor → brain | Previous session state injected into Groq's first prompt on warm start |
| `_supervisorMaxVoices` | supervisor → brain | Voice count ceiling — tick skips drum/synth when at limit |
| `_supervisorPolyphonyScale` | supervisor → brain | Multiplier (0–1) on drum and synth probabilities |
| `n0body-request-outro` | brain → supervisor | CustomEvent dispatched when Groq plans an outro transition |
| `n0body-supervisor-state` | supervisor → brain | CustomEvent on FSM transitions — brain increases rest probability during DENSITY_REDUCED/OUTRO |
| `_checkContextThreshold()` | supervisor internal | Monitors Groq consecutive errors, triggers outro on degradation |

## mk-1 API Surface

n0body communicates with mk-1 via the global `MK1` object:

- `MK1.drums.hit(pad)` — pads 1–8
- `MK1.synth.play(note, duration)` — note string like 'C3', duration in seconds
- `MK1.synth.setWaveform(type)` — sine, square, saw, triangle, pulse, noise, string, voice, vocoder
- `MK1.synth.setAttack(v)` / `.setRelease(v)` — 0–1
- `MK1.synth.stop()`
- `MK1.sequencer.start()` / `.stop()` / `.isPlaying()`
- `MK1.sequencer.setStep(track, step, active)` — tracks 1–8, steps 1–16
- `MK1.sequencer.clearAll()`
- `MK1.fx.setReverb(v)` / `.setDelay(v)` / `.setFilter(v)` / `.setDistortion(v)` / `.setChorus(v)` / `.setCrush(v)` — all 0–1
- `MK1.tempo.setBPM(bpm)` — 70–140
- `MK1.master.setVolume(v)` — 0–1
- `MK1.utils.getHealth()` — returns { activeDrumVoices, activeSynthVoices, contextState, healthy }
- `MK1.utils.resume()` / `.forceCleanup()` — audio recovery

## Drums: The Foundation

Drums are the skeleton of every set. The synth accompanies.

### Groove Patterns (22 templates)

Patterns as complete units, not random steps. Hybrid palette:

- **Structural:** kick_four, snare_backbeat, hat_eighth (DJ vocabulary)
- **Broken:** kick_burial, kick_stutter, snare_erratic (Burial/UK garage)
- **Textural:** hat_texture, rim_vinyl, perc_accident (atmosphere)
- **Absent:** kick_absent, kick_pulse (almost nothing)

Grooves change every 8–16 bars — rhythm stays stable while synth
phrases change on top. Intentional mute (15% chance): clear all
tracks for 2–8 beats, then restore. The silence is tension; the
return is impact.

### Groove Learning

Copy → favor → mutate → reject lifecycle:
- Newborn (1–10): plays presets as-is (imitation)
- Learning (11–30): occasionally mutates presets
- Developing (31+): prefers learned grooves, mutates often

`knowledge.grooveMemory[state_mood]` stores grooves with reward scores.
Grooves with reward < -0.3 after 3+ tries → `knowledge.grooveRejected`.

## Synth: Phrase-Based, State-Aware

Like a real arrangement: ~50% of the set has melody, ~50% is drums only.

### State Behavior

| State     | Synth presence |
|-----------|---------------|
| intro     | Long textural notes (2–5s), one every 2–8 bars |
| buildup   | Phrases fade in (60% play chance) |
| peak      | Full phrases, tight subdivisions |
| breakdown | Synth protagonist — minimal kick anchor underneath |
| outro     | Single sustained notes every 4–8 bars, dissolving |

### Phrase System

Generate a 2–4 note phrase using stepwise motion. Repeat for 4–16 bars.
Then generate a new phrase. Like melodic techno: 1-bar melody in loop.

### Beat-Quantized Timing

Synth notes land on beat subdivisions, not a random timer:
- 50% offbeat (Kaytranada groove — between kicks)
- 30% on-beat (Massive Attack weight — with kicks)
- 20% erratic (Burial handmade timing — random offset)

### Phrase Learning

Same lifecycle as grooves: `knowledge.phraseMemory[state_mood_scale]`.
Phrases scored at end of each repetition cycle. Copy → favor → mutate → reject.

## Transitions

Three modes, weighted by mood:

| Mode | Technique | When |
|---|---|---|
| Filter sweep | LP closes 4 bars, opens 4 bars | Bright moods, structural |
| Rupture | Immediate cut, no smoothing | Dark moods, Arca-style |
| Space shift | Reverb swells over 4 bars | Dark moods, Burial-style |

Gradual layer introduction when entering buildup/peak from sparse
state — each drum track enters alone, 4–8 bars apart.

## Learning System

### Self-Calibrating Reward Model

`evaluateReward(actions, state, rewardModel)` uses learned parameters:
- Optimal density per state (Gaussian scoring around learned center)
- Weights: density, variety, rhythm, space
- Calibrated at session end — good sessions shift optimal toward
  what happened, bad sessions shift away

Starts with creator defaults. After 20+ sessions, reflects n0body's
own experience. After 50, calibration is very slow — taste is stable.

### Knowledge Structure (localStorage)

```
{
  sessionsPlayed, totalPlayTime, version: '3.2',
  bpm: { dark: {preferred, variance, history}, ... },
  scales: { cMinor: {weight, sessions}, ... },
  stateDurations: { intro: {preferred, variance, min, max}, ... },
  drums: { [state]: { [pad]: weight } },
  notes: { [scale_state]: { [note]: weight } },
  fx: { [state]: { [param]: {preferred, variance} } },
  synth: { waveforms: {sine: weight, ...}, attack, release },
  transitionSuccess: { [from_to]: {count, avgReward} },
  combos: { [key]: {score, count} },
  energy: { [state]: {target, variance} },
  sessionHistory: [...],
  grooveMemory: { [state_mood]: [{pattern, reward, count}] },
  grooveRejected: [...],
  phraseMemory: { [state_mood_scale]: [{notes, reward, count}] },
  phraseRejected: [...],
  rewardModel: { optimalDensity, weights, calibrations },
  bestDecisions: [{state, mood, monologue, reward}],
  reflections: [{sessionReward, reflection, timestamp}],
  evolvedGuidelines: ["rule1", "rule2", ...],
}
```

### Experience Levels

| Sessions | Level       | Exploration |
|----------|-------------|-------------|
| 1–10     | newborn     | 70%         |
| 11–30    | learning    | 50%         |
| 31–60    | developing  | 30%         |
| 61–100   | skilled     | 20%         |
| 101–200  | experienced | 15%         |
| 200+     | master      | 10%         |

## LLM Integration (Groq / Llama 3.3 70B)

### Consultation Cycle

Every 2–5 minutes (based on plan duration), Groq receives:
1. Boot hints (warm start from previous session)
2. Accumulated knowledge (scales, BPM, transitions)
3. Best decisions from past sessions (few-shot examples)
4. Self-reflections from recent sessions
5. Evolved guidelines (SCOPE-inspired, self-discovered)
6. Learned grooves for current state+mood
7. Learned phrases for current state+mood+scale
8. Reward model state (optimal density per state)
9. Musical feedback (rhythm, variety, energy, transitions)
10. Current state + session history with reward scores (★/✗)

### Self-Improving Prompt

The system prompt (IDENTITY.md aesthetic) stays fixed.
The user prompt evolves with experience:

- **Few-shot examples:** decisions with ★★ (reward ≥ 1.5) saved as examples
- **Reflections:** Groq's 2-sentence self-assessment at session end
- **Evolved guidelines** (SCOPE-inspired): specific principles Groq synthesizes
  from execution traces. Maximum 7, consolidated each session.

### Reward Feedback

Each consultation scores the PREVIOUS decision's outcome.
Groq sees: `[3:00] buildup/dark [score: 1.5 ★★] → "layers building..."`.
★★ = worked well. ✗ = didn't work. Groq adjusts its thinking.

## Technical Conventions

- Never assign AudioParam .value directly during playback
- Always use setTargetAtTime() or exponentialRampToValueAtTime()
- Wave type changes: fade down → change → fade up
- Tempo changes: bar boundary only
- All scheduling via AudioContext.currentTime
- Schedule writes 100–200ms ahead: currentTime + 0.1
- Communication with mk-1: MK1 global API, never polling
- Pattern changes quantized to bar boundary

## What Not To Do

- Do not archive session content
- Do not add recording or export
- Do not make n0body explain itself
- Do not add onboarding or instructions
- Do not assign AudioParam .value directly during playback
- Do not use setTimeout for audio scheduling
- Do not poll mk-1 state
- Do not add visual complexity beyond what serves the session

## Constitution Files

- IDENTITY.md — who n0body is, what it plays toward
- mk1-instrument-model.md — perceptual + parameter model of mk-1
- behavioral-patterns.md — playing strategies
- session-manifest.json — handoff state between sessions (runtime data in localStorage)
- tried-rejected.json — patterns/progressions/transitions that didn't work (runtime data in localStorage)
- decision-log.jsonl — append-only record of artistic decisions with rationale (runtime data in localStorage)

## Collaborators

- nbronzina — creator, creative director
- claude — technical implementation (Claude Code)
