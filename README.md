# n0body

The first non-human performer of Playground.

## What is this?

n0body is an autonomous agent that creates live music using mk-1 and broadcasts through mk-air.

- Sessions are unlimited — n0body plays until you stop it
- Music is ephemeral — when the session ends, everything disappears
- The artist evolves — n0body learns and improves across sessions

## Philosophy

The session is ephemeral. The artist evolves.

Like a real DJ: doesn't record sets, but gets better every time.

## Usage

1. Open: `https://nbronzina.github.io/n0body/`
2. Click [start]
3. n0body plays
4. Click [stop] when you want to end
5. n0body enters outro and fades out gracefully

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
| intro | Sparse, establishing mood | 30s - 3min |
| buildup | Adding layers, tension | 1 - 5min |
| peak | Maximum energy | 1 - 10min |
| breakdown | Reducing, breathing | 45s - 4min |
| outro | Fade out (only on stop) | 30 - 60s |

Transitions are probabilistic. n0body might stay in peak for 10 minutes or cycle through buildups. It learns which transitions work well.

### Tools

n0body uses everything mk-1 offers:

- **Drums** — 8 pads
- **Synth** — notes in scale, 6 waveforms, attack/release
- **Sequencer** — 8 tracks × 16 steps
- **FX** — reverb, delay, filter, distortion, chorus, bitcrusher
- **Looper** — records, plays, layers, fades (all cleared at end)
- **Tempo** — chosen per session

### Learning

n0body learns across sessions:

- Which drum pads work in each state
- Which notes sound good in each scale
- Which FX settings feel right
- Which state transitions flow well

Knowledge persists in localStorage. Each session, n0body starts a little better.

### Experience levels

| Sessions | Level |
|----------|-------|
| 1-4 | newborn |
| 5-14 | learning |
| 15-29 | developing |
| 30-49 | skilled |
| 50-99 | experienced |
| 100+ | master |

## Controls

| Command | Action |
|---------|--------|
| [start] | Begin session |
| [stop] | Enter outro and end |
| [broadcast] | Open mk-air to stream (in mk-1) |

From console (if needed):
```javascript
n0body.start()
n0body.stop()
n0body.status()
```

## Status display
```
status: playing    state: peak (3:45)    elapsed: 1:23:45
loops: 2 recorded    experience: 12 sessions · developing
```

## Reset

To reset n0body to newborn state:
```javascript
localStorage.removeItem('n0body_knowledge');
```

## Part of Playground

n0body is the first artist of [Playground](https://nbronzina.github.io/playground/) — browser-based tools for making sound, ephemeral spaces for sharing it.

- [mk-1](https://nbronzina.github.io/playground/mk-1.html) — the instrument n0body plays
- [mk-air](https://mk-air.onrender.com/) — where n0body broadcasts

---

*n0body — broadcasting from somewhere*
