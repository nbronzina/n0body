# n0body

The first non-human performer of Playground.

## What is this?

n0body is an autonomous agent that creates live music using mk-1 and broadcasts through mk-air. Sessions are ephemeral — when n0body stops, the music is gone forever.

## Usage

### Quick Start

1. Open mk-1: `https://nbronzina.github.io/playground/mk-1.html`
2. Open browser console (F12)
3. Paste the contents of `dist/n0body.js`
4. Run `n0body.start()`

### With mk-air (broadcast)

1. Open mk-1: `https://nbronzina.github.io/playground/mk-1.html`
2. Open mk-air in another tab: `https://mk-air.onrender.com/broadcast`
3. In mk-air, enable "system audio" to capture mk-1
4. In mk-1's browser console, paste `dist/n0body.js`
5. Run `n0body.start()`
6. n0body plays, mk-air broadcasts

## Commands

```javascript
n0body.start()      // Begin a session
n0body.stop()       // End session early
n0body.status()     // Get current state
n0body.getStatus()  // Get status as object
```

## Session Structure

Each session follows a narrative arc:

```
┌─────────────────────────────────────────────────────────────┐
│  INTRO    │  BUILDUP  │    PEAK    │ BREAKDOWN │   OUTRO   │
│   8%      │    30%    │    30%     │    20%    │    12%    │
│           │           │            │           │           │
│  sparse   │  +layers  │  maximum   │  -layers  │  fade     │
│  mood     │  tension  │  energy    │  breathe  │  close    │
└─────────────────────────────────────────────────────────────┘
```

- **Intro** — Sparse, establishing mood. Occasional synth notes, minimal drums.
- **Buildup** — Adding layers. Sequencer starts, more activity.
- **Peak** — Maximum energy. Dense sequencer, frequent drums, active synth.
- **Breakdown** — Reducing elements. Breathing room before outro.
- **Outro** — Fading out. Sparse like intro, session ends.

Session length: 15-45 minutes (random)

## Configuration

### src/config.js

- `session.durationMinutes` — Session length range
- `tempo.bpm` — BPM range
- `stateDistribution` — Percentage of session per state
- `waveforms` — Available synth waveforms
- `humanize.timing` — Timing variation in ms

### src/states.js

Per-state configuration:
- Drum probability and available pads
- Synth probability, note duration, spacing
- Sequencer density and active tracks
- FX ranges (reverb, delay, filter)

### src/scales.js

Musical scales grouped by mood:
- **dark** — Minor scales, Phrygian
- **bright** — Major scales
- **neutral** — Pentatonic, Dorian

## File Structure

```
n0body/
├── src/
│   ├── brain.js      # Main N0body class (ES modules)
│   ├── config.js     # General configuration
│   ├── scales.js     # Musical scales
│   ├── states.js     # State configuration
│   └── utils.js      # Helper functions
├── dist/
│   └── n0body.js     # Bundled version (paste in console)
├── index.html        # Info page
├── README.md
└── package.json
```

## Philosophy

n0body embodies Playground's values:

- **Ephemeral > permanent** — Sessions are not recorded
- **Imperfection welcome** — Errors and silence are part of the performance
- **Process visible** — Console logs show n0body's decisions
- **Zero friction** — Paste and play

## Technical Notes

- n0body requires the MK1 API (available in mk-1.html)
- Main loop runs at 100ms intervals
- Synth scheduling is independent with variable spacing
- FX changes every 15-30 seconds
- State transitions are automatic based on session progress

## Name

**n0body** (with zero, always lowercase)

- Reads as "nobody"
- The zero reinforces: code, binary, null, non-human
- Wordplay: "n0body is live" — is no one there, or is n0body performing?

---

*n0body — broadcasting from somewhere*
