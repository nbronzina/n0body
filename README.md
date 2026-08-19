# n0body

The first non-human performer of play·ground.

## What is this?

n0body is an autonomous agent that creates live music using mk-1 and broadcasts through mk-air.

- Sessions are unlimited — n0body plays until you stop it
- Music is ephemeral — when the session ends, everything disappears
- The artist evolves — n0body learns grooves, scales, and transitions across sessions

## Philosophy

The session is ephemeral. The artist evolves.

n0body learns like a session musician: starts by copying patterns, develops favorites, mutates what works. Doesn't record sets, but gets better every time.

## Usage

1. Open: `https://nbronzina.github.io/n0body/`
2. First time: enter a [Groq API key](https://console.groq.com/keys) (free, saved to device)
3. Click [start]
4. n0body plays
5. Click [stop] when you want to end
6. n0body enters outro and fades out gracefully

### Broadcasting

To broadcast n0body to the world:

1. Click [broadcast] in mk-1 (inside the page)
2. mk-air opens — enable "system audio"
3. n0body is now live at `https://mk-air.onrender.com/listen`

## How it works

### States

n0body flows through states organically, not on a fixed schedule:

| State | Description | Duration |
|-------|-------------|----------|
| intro | Sparse, establishing mood | 20s – 90s |
| buildup | Adding layers, tension | 45s – 3min |
| peak | Maximum energy or rupture | 1 – 8min |
| breakdown | Reducing, breathing | 30s – 2.5min |
| outro | Fade out (only on stop) | 30 – 60s |

Transitions are probabilistic. n0body might stay in peak for 8 minutes or cycle through buildups. It learns which transitions work well.

### Tools

n0body uses everything mk-1 offers:

- **Drums** — 8 pads (kick, snare, hat, clap, tom, perc, cymbal, rim)
- **Synth** — notes in scale, 9 waveforms (sine, square, saw, triangle, pulse, noise, string, voice, vocoder)
- **Sequencer** — 8 tracks × 16 steps, groove patterns applied as complete units
- **FX** — reverb, delay, filter, distortion, chorus, bitcrusher
- **Tempo** — 70–140 BPM, chosen per session, subtle changes mid-session

### Groove patterns

n0body plays the sequencer like a session musician — complete groove patterns, not random steps:

- 14 drum pattern templates (four-on-the-floor, breakbeat, minimal, syncopated...)
- Groove presets per state (intro is minimal kick, peak is full kit)
- **Intentional mute** — sometimes cuts all drums for 2–8 beats, then brings the groove back. The silence creates tension; the return creates impact.

### Beat-locked synth

Synth notes land on beat subdivisions (quarter, eighth, half, full, double beats) instead of firing on an independent random timer. The keyboard responds to the rhythm — it inhabits the groove, doesn't ignore it. ±50ms humanization around each grid point.

### Learning

n0body learns across sessions like a musician developing their style:

**Groove memory** — remembers which patterns worked in which context (state + mood). Favorites get picked more often. After 15 sessions, starts mutating favorites instead of playing them verbatim. Patterns that consistently fail get rejected permanently.

**Scales and BPM** — develops preferences per mood. Dark sessions gravitate toward slower tempos and minor scales. Each session refines the preference.

**FX and transitions** — learns which FX settings and state transitions scored well. Applies learned preferences with decreasing variance (more confident over time).

**Exploration vs exploitation** — newborns explore 70% of the time (try everything). Masters explore 10% (mostly play what works, occasionally experiment).

### Experience levels

| Sessions | Level | Behavior |
|----------|-------|----------|
| 1–10 | newborn | copies preset grooves, explores 70% |
| 11–30 | learning | starts mutating presets, explores 50% |
| 31–60 | developing | prefers learned grooves, mutates often, explores 30% |
| 61–100 | skilled | strong preferences, occasional experiments, explores 20% |
| 101–200 | experienced | recognizable style, rare experiments, explores 15% |
| 200+ | master | distinct identity, 10% exploration |

### LLM direction (Groq)

Every 3 minutes, an LLM (Llama 3.3 70B via Groq) evaluates the session and creates a multi-minute plan: state transitions, energy levels, drum patterns, synth phrases, FX changes, BPM adjustments. The LLM doesn't write code — it plays the instrument through n0body's director interface.

## Controls

| Command | Action |
|---------|--------|
| [start] | Begin session |
| [stop] | Enter outro and end |

From console:
```javascript
n0body.start()
n0body.stop()
n0body.getStatus()
```

## Status display
```
status: playing    state: peak (3:45)    elapsed: 1:23:45
experience: 12 sessions · 45 min · developing
```

## Reset

To reset n0body to newborn state:
```javascript
localStorage.removeItem('n0body_knowledge');
```

To clear the stored API key:
```javascript
localStorage.removeItem('n0body-llm-key');
```

## Part of play·ground

n0body is the first artist of [play·ground](https://nbronzina.github.io/playground/) — browser-based tools for making sound, ephemeral spaces for sharing it.

- [mk-1](https://nbronzina.github.io/playground/mk-1.html) — the instrument n0body plays
- [mk-air](https://mk-air.onrender.com/) — where n0body broadcasts

---

*n0body — broadcasting from somewhere*
