// session-supervisor.js — Deterministic session lifecycle manager for n0body
// No LLM calls. Manages start, transitions, termination, and handoff.

// ========== FSM STATES ==========

const STATES = {
    IDLE: 'IDLE',
    INITIALIZING: 'INITIALIZING',
    NOMINAL: 'NOMINAL',
    DENSITY_REDUCED: 'DENSITY_REDUCED',
    OUTRO: 'OUTRO',
    HANDOFF: 'HANDOFF',
    TERMINATED: 'TERMINATED',
    EMERGENCY_STOP: 'EMERGENCY_STOP',
};

// Valid transitions: from → [to, to, ...]
const TRANSITIONS = {
    IDLE:             ['INITIALIZING'],
    INITIALIZING:     ['NOMINAL', 'EMERGENCY_STOP'],
    NOMINAL:          ['DENSITY_REDUCED', 'OUTRO', 'EMERGENCY_STOP'],
    DENSITY_REDUCED:  ['NOMINAL', 'OUTRO', 'EMERGENCY_STOP'],
    OUTRO:            ['HANDOFF', 'EMERGENCY_STOP'],
    HANDOFF:          ['TERMINATED'],
    TERMINATED:       ['IDLE'],
    EMERGENCY_STOP:   ['TERMINATED'],
};

// ========== CAPACITY LEVELS ==========

const CAPACITY_THRESHOLDS = [
    { load: 0.70, label: 'reduced',  actions: { maxPolyphony: 0.75, disableChorus: true } },
    { load: 0.80, label: 'strained', actions: { maxPolyphony: 0.75, disableChorus: true, algorithmicReverb: true } },
    { load: 0.85, label: 'critical', actions: { maxVoices: 4, bypassPerVoiceFX: true, algorithmicReverb: true } },
    { load: 0.90, label: 'minimal',  actions: { maxVoices: 1, bypassAllFX: true } },
];

const EMERGENCY_LOAD = 0.95;
const EMERGENCY_HOLD_MS = 10000;

// ========== STORAGE KEYS ==========

const STORAGE_KEYS = {
    MANIFEST: 'n0body_session_manifest',
    TRIED_REJECTED: 'n0body_tried_rejected',
    DECISION_LOG: 'n0body_decision_log',
};

// ========== SESSION SUPERVISOR ==========

class SessionSupervisor {
    constructor(n0body, options = {}) {
        this.n0body = n0body;
        this.state = STATES.IDLE;

        // Configuration
        this.hardLimitMs = (options.hardLimitMinutes || 45) * 60 * 1000;
        this.monitorIntervalMs = options.monitorIntervalMs || 500;
        this.outroDurationMs = (options.outroDurationSeconds || 120) * 1000;

        // Timers
        this._monitorTimer = null;

        // Session tracking
        this._sessionStartTime = null;
        this._sessionId = null;

        // Render capacity tracking
        this._renderCapacity = null;
        this._currentCapacityLevel = null;
        this._emergencyStartTime = null;

        // Repetition detection — sliding window of last 5 Grok decisions
        this._decisionWindow = [];
        this._decisionWindowSize = 5;
        this._lastObservedDecisionCount = 0;
        this._repetitionFlagged = false;
        this._repetitionTransitionAttempted = false;

        // Entropy tracking — sliding window of recent action types
        this._entropyWindow = [];
        this._entropyWindowSize = 64; // ~16 bars at 4 actions/bar
        this._entropyHistory = [];    // recent entropy values for trend detection
        this._entropyHistorySize = 16;
        this._lastObservedActionCount = 0;

        // Outro signal listener
        this._outroRequested = false;
        this._onOutroRequest = this._handleOutroRequest.bind(this);
        window.addEventListener('n0body-request-outro', this._onOutroRequest);

        console.log('[supervisor] initialized — hard limit: ' + (this.hardLimitMs / 60000) + 'min');
    }

    // ========== FSM ==========

    _setState(newState, reason) {
        if (this.state === newState) return false;

        var valid = TRANSITIONS[this.state];
        if (!valid || valid.indexOf(newState) === -1) {
            console.warn('[supervisor] invalid transition: ' + this.state + ' → ' + newState);
            return false;
        }

        var oldState = this.state;
        this.state = newState;

        console.log('[supervisor] ' + oldState + ' → ' + newState + (reason ? ' (' + reason + ')' : ''));

        window.dispatchEvent(new CustomEvent('n0body-supervisor-state', {
            detail: { from: oldState, to: newState, reason: reason, timestamp: Date.now() }
        }));

        return true;
    }

    getState() {
        return this.state;
    }

    getSessionElapsedMs() {
        if (!this._sessionStartTime) return 0;
        return Date.now() - this._sessionStartTime;
    }

    // ========== LIFECYCLE ==========

    startSession() {
        if (this.state !== STATES.IDLE) {
            console.warn('[supervisor] cannot start — state is ' + this.state);
            return false;
        }

        this._sessionId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        this._sessionStartTime = Date.now();

        // Reset tracking state
        this._decisionWindow = [];
        this._lastObservedDecisionCount = 0;
        this._repetitionFlagged = false;
        this._repetitionTransitionAttempted = false;
        this._entropyWindow = [];
        this._entropyHistory = [];
        this._lastObservedActionCount = 0;
        this._emergencyStartTime = null;
        this._currentCapacityLevel = null;
        this._outroRequested = false;
        this._sessionDecisions = [];
        this._sessionRejected = [];

        this._setState(STATES.INITIALIZING, 'session start');

        // Run boot sequence
        var bootContext = this._bootSequence();
        console.log('[supervisor] boot: ' + (bootContext.warmStart ? 'warm start' : 'cold start'));

        this._setState(STATES.NOMINAL, 'boot complete');

        this._startMonitoring();
        this._startRenderCapacityObserver();

        console.log('[supervisor] session ' + this._sessionId + ' started');
        return bootContext;
    }

    // ========== BOOT SEQUENCE ==========

    _bootSequence() {
        var context = {
            warmStart: false,
            previousManifest: null,
            triedRejected: null,
            recentDecisions: [],
            interrupted: false,
            nextIntent: '',
            nextConstraints: [],
        };

        // 1. IDENTITY.md is baked into the Grok system prompt — no action needed.
        //    The supervisor confirms it exists as a contract.

        // 2–3. Read session-manifest.json from localStorage
        var manifest = this._readManifest();
        if (manifest && manifest.session_id) {
            context.warmStart = true;
            context.previousManifest = manifest;
            context.interrupted = manifest.session_interrupted || false;
            context.nextIntent = manifest.next_session_intent || '';
            context.nextConstraints = manifest.next_session_constraints || [];

            if (context.interrupted) {
                console.log('[supervisor] boot: previous session was interrupted');
            }

            // Restore musical state hints for Grok's opening prompt
            if (manifest.current_musical_state) {
                this.n0body._supervisorBootHints = {
                    previousBPM: manifest.current_musical_state.bpm,
                    previousKey: manifest.current_musical_state.key,
                    previousEnergy: manifest.current_musical_state.energy_level,
                    nextIntent: context.nextIntent,
                    interrupted: context.interrupted,
                };
            }
        }

        // 4. Read tried-rejected.json
        context.triedRejected = this._readTriedRejected();

        // 5. Read last 10 decision-log entries
        context.recentDecisions = this._readDecisionLog(10);

        return context;
    }

    requestStop(reason) {
        reason = reason || 'manual stop';

        if (this.state === STATES.OUTRO || this.state === STATES.HANDOFF ||
            this.state === STATES.TERMINATED || this.state === STATES.EMERGENCY_STOP) {
            return false;
        }

        this._triggerOutro(reason);
        return true;
    }

    // ========== MONITORING ==========

    _startMonitoring() {
        this._stopMonitoring();
        var self = this;
        this._monitorTimer = setInterval(function() { self._monitorTick(); }, this.monitorIntervalMs);
    }

    _stopMonitoring() {
        if (this._monitorTimer) {
            clearInterval(this._monitorTimer);
            this._monitorTimer = null;
        }
    }

    _monitorTick() {
        if (this.state === STATES.TERMINATED || this.state === STATES.IDLE) return;

        // Observe new Grok decisions for repetition detection
        this._observeNewDecisions();

        // Observe new actions for entropy tracking
        this._observeNewActions();

        // Run all termination trigger checks
        if (this.state === STATES.NOMINAL || this.state === STATES.DENSITY_REDUCED) {
            this._checkTimeLimit();
            this._checkOutroSignal();
            this._checkRepetition();
            this._checkEntropy();
        }

        // Render capacity is checked in all active states
        if (this.state !== STATES.HANDOFF && this.state !== STATES.TERMINATED) {
            this._checkRenderCapacity();
        }
    }

    // ========== TERMINATION TRIGGERS ==========

    // 1. Hard time limit
    _checkTimeLimit() {
        if (this.getSessionElapsedMs() >= this.hardLimitMs) {
            this._triggerOutro('hard time limit (' + (this.hardLimitMs / 60000) + 'min)');
        }
    }

    // 2. Context threshold — Grok signals >80% context usage
    // Checked via custom event or n0body.llm status. The LLM module
    // tracks consecutiveErrors; if the model starts failing due to
    // context overflow, that surfaces here.
    _checkContextThreshold() {
        var llm = this.n0body.llm;
        if (!llm || !llm.enabled) return;

        // Consecutive errors signal context or API degradation
        if (llm.consecutiveErrors >= 2) {
            this._triggerOutro('Grok context degradation (' + llm.consecutiveErrors + ' consecutive errors)');
        }
    }

    // 3. Grok OUTRO signal
    _handleOutroRequest() {
        this._outroRequested = true;
    }

    _checkOutroSignal() {
        if (!this._outroRequested) return;

        this._outroRequested = false;
        this._triggerOutro('Grok requested outro');
    }

    // 4. Repetition detection
    _observeNewDecisions() {
        var llm = this.n0body.llm;
        if (!llm || !llm.sessionMemory) return;

        var currentCount = llm.sessionMemory.length;
        if (currentCount <= this._lastObservedDecisionCount) return;

        // Ingest new decisions
        for (var i = this._lastObservedDecisionCount; i < currentCount; i++) {
            var mem = llm.sessionMemory[i];
            if (mem && mem.decision && mem.decision.monologue) {
                this._addDecisionToWindow(mem.decision.monologue);
            }
        }
        this._lastObservedDecisionCount = currentCount;
    }

    _addDecisionToWindow(decisionText) {
        this._decisionWindow.push(decisionText);
        if (this._decisionWindow.length > this._decisionWindowSize) {
            this._decisionWindow.shift();
        }
    }

    _checkRepetition() {
        if (this._decisionWindow.length < this._decisionWindowSize) return;

        var isRepetitive = this._isRepetitive();

        if (isRepetitive && !this._repetitionFlagged) {
            // First flag: force a state transition, don't end session yet
            this._repetitionFlagged = true;

            if (!this._repetitionTransitionAttempted) {
                this._repetitionTransitionAttempted = true;
                console.log('[supervisor] repetition detected — forcing state transition');

                // Force transition via director
                if (this.n0body.director && this.n0body.director.directives.prepareTransition) {
                    var currentState = this.n0body.currentState;
                    var escapeState = currentState === 'peak' ? 'breakdown' :
                                     currentState === 'buildup' ? 'peak' :
                                     currentState === 'breakdown' ? 'buildup' : 'buildup';
                    this.n0body.director.directives.prepareTransition(escapeState);
                }

                // Clear window to give Grok fresh chance after transition
                this._decisionWindow = [];
                this._lastObservedDecisionCount = this.n0body.llm ? this.n0body.llm.sessionMemory.length : 0;
                return;
            }

            // Repetition persists after forced transition — end session
            this._triggerOutro('persistent repetition after forced transition');
        }

        if (!isRepetitive) {
            this._repetitionFlagged = false;
        }
    }

    _isRepetitive() {
        var window = this._decisionWindow;
        if (window.length < this._decisionWindowSize) return false;

        // Check pairwise similarity of the most recent decisions
        var similarCount = 0;
        var total = 0;
        var tokens = window.map(this._tokenize);

        for (var i = 0; i < tokens.length; i++) {
            for (var j = i + 1; j < tokens.length; j++) {
                total++;
                if (this._jaccardSimilarity(tokens[i], tokens[j]) > 0.80) {
                    similarCount++;
                }
            }
        }

        // 4/5 decisions being mutually similar means most pairs match.
        // With 5 items, 4 similar to each other produces 6+ matching pairs out of 10 total.
        return similarCount >= 6;
    }

    _tokenize(text) {
        if (!text) return new Set();
        // Lowercase, split on whitespace and punctuation, filter short tokens
        var words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function(w) {
            return w.length > 2;
        });
        return new Set(words);
    }

    _jaccardSimilarity(setA, setB) {
        if (setA.size === 0 && setB.size === 0) return 1;
        if (setA.size === 0 || setB.size === 0) return 0;

        var intersection = 0;
        setA.forEach(function(token) {
            if (setB.has(token)) intersection++;
        });

        var union = setA.size + setB.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    // 5. Entropy degradation
    _observeNewActions() {
        var stm = this.n0body.shortTermMemory;
        if (!stm || !stm.actions) return;

        var currentCount = stm.actions.length;
        if (currentCount <= this._lastObservedActionCount) {
            // STM wraps — it shifts old entries. Track by timestamp instead.
            this._lastObservedActionCount = 0;
        }

        for (var i = this._lastObservedActionCount; i < currentCount; i++) {
            var action = stm.actions[i];
            if (action && action.type) {
                this._entropyWindow.push(action.type);
                if (this._entropyWindow.length > this._entropyWindowSize) {
                    this._entropyWindow.shift();
                }
            }
        }
        this._lastObservedActionCount = currentCount;
    }

    _checkEntropy() {
        if (this._entropyWindow.length < this._entropyWindowSize) return;

        var entropy = this._calculateEntropy(this._entropyWindow);

        this._entropyHistory.push(entropy);
        if (this._entropyHistory.length > this._entropyHistorySize) {
            this._entropyHistory.shift();
        }

        if (this._entropyHistory.length < 4) return;

        // Check: near-zero entropy (stuck loop) — threshold 0.3 bits
        if (entropy < 0.3) {
            this._triggerOutro('entropy near-zero (stuck loop): ' + entropy.toFixed(3));
            return;
        }

        // Check: monotonically rising entropy (noise/chaos)
        // All recent deltas positive = entropy only increasing
        var rising = true;
        var falling = true;
        for (var i = 1; i < this._entropyHistory.length; i++) {
            var delta = this._entropyHistory[i] - this._entropyHistory[i - 1];
            if (delta <= 0.001) rising = false;
            if (delta >= -0.001) falling = false;
        }

        if (rising && this._entropyHistory.length >= this._entropyHistorySize) {
            this._triggerOutro('entropy rising monotonically (noise): ' + entropy.toFixed(3));
        }
    }

    _calculateEntropy(actions) {
        // Shannon entropy over action type distribution
        var counts = {};
        var total = actions.length;
        if (total === 0) return 0;

        for (var i = 0; i < total; i++) {
            var type = actions[i];
            counts[type] = (counts[type] || 0) + 1;
        }

        var entropy = 0;
        for (var key in counts) {
            if (counts.hasOwnProperty(key)) {
                var p = counts[key] / total;
                if (p > 0) {
                    entropy -= p * Math.log2(p);
                }
            }
        }

        return entropy;
    }

    // 6. Render capacity — checked via AudioRenderCapacity API or MK1 health
    _startRenderCapacityObserver() {
        // Try AudioRenderCapacity API (Chrome 116+)
        if (typeof AudioContext !== 'undefined') {
            var ctx = this._getAudioContext();
            if (ctx && ctx.renderCapacity && typeof ctx.renderCapacity.addEventListener === 'function') {
                var self = this;
                ctx.renderCapacity.addEventListener('update', function(e) {
                    self._renderCapacity = e.load;
                });
                ctx.renderCapacity.start({ updateInterval: 0.5 });
                console.log('[supervisor] AudioRenderCapacity observer started');
                return;
            }
        }

        // Fallback: estimate from MK1 health data
        console.log('[supervisor] AudioRenderCapacity API not available — using MK1 health fallback');
    }

    _getAudioContext() {
        // Try to find the AudioContext from MK1
        if (typeof MK1 !== 'undefined' && MK1.utils && MK1.utils.getHealth) {
            var health = MK1.utils.getHealth();
            if (health && health.audioContext) return health.audioContext;
        }
        return null;
    }

    _checkRenderCapacity() {
        var load = this._estimateRenderLoad();
        if (load === null) return;

        // Emergency check: >95% for >10 seconds
        if (load >= EMERGENCY_LOAD) {
            if (!this._emergencyStartTime) {
                this._emergencyStartTime = Date.now();
            } else if (Date.now() - this._emergencyStartTime >= EMERGENCY_HOLD_MS) {
                this._triggerEmergencyStop();
                return;
            }
        } else {
            this._emergencyStartTime = null;
        }

        // Capacity ladder
        this._applyCapacityLevel(load);
    }

    _estimateRenderLoad() {
        // Prefer AudioRenderCapacity data
        if (this._renderCapacity !== null) {
            return this._renderCapacity;
        }

        // Fallback: estimate from MK1 health
        if (typeof MK1 === 'undefined' || !MK1.utils || !MK1.utils.getHealth) return null;

        var health = MK1.utils.getHealth();
        if (!health) return null;

        // Rough estimate: voices / max expected voices
        var voices = (health.activeDrumVoices || 0) + (health.activeSynthVoices || 0);
        var maxExpected = 24; // reasonable ceiling for browser audio
        return Math.min(1.0, voices / maxExpected);
    }

    _applyCapacityLevel(load) {
        // Find the highest threshold exceeded
        var newLevel = null;
        for (var i = CAPACITY_THRESHOLDS.length - 1; i >= 0; i--) {
            if (load >= CAPACITY_THRESHOLDS[i].load) {
                newLevel = CAPACITY_THRESHOLDS[i];
                break;
            }
        }

        // Below all thresholds — restore full capacity
        if (!newLevel) {
            if (this._currentCapacityLevel !== null) {
                this._restoreFullCapacity();
            }
            return;
        }

        // Already at this level
        if (this._currentCapacityLevel && this._currentCapacityLevel.label === newLevel.label) {
            return;
        }

        this._currentCapacityLevel = newLevel;
        var actions = newLevel.actions;

        console.log('[supervisor] render load ' + (load * 100).toFixed(0) + '% — applying level: ' + newLevel.label);

        // Apply reductions via MK1 API where available
        if (actions.disableChorus && MK1.fx.setChorus) {
            MK1.fx.setChorus(0);
        }

        if (actions.bypassAllFX) {
            MK1.fx.setReverb(0);
            MK1.fx.setDelay(0);
            MK1.fx.setFilter(0.5);
            if (MK1.fx.setDistortion) MK1.fx.setDistortion(0);
            if (MK1.fx.setChorus) MK1.fx.setChorus(0);
            if (MK1.fx.setCrush) MK1.fx.setCrush(0);
        }

        // Polyphony and voice limits are signaled to n0body via properties
        // that the tick loop can read (non-invasive observation pattern)
        if (actions.maxVoices !== undefined) {
            this.n0body._supervisorMaxVoices = actions.maxVoices;
        }
        if (actions.maxPolyphony !== undefined) {
            this.n0body._supervisorPolyphonyScale = actions.maxPolyphony;
        }

        // Transition FSM to DENSITY_REDUCED if currently NOMINAL
        if (this.state === STATES.NOMINAL) {
            this._setState(STATES.DENSITY_REDUCED, 'render load ' + newLevel.label);
        }
    }

    _restoreFullCapacity() {
        this._currentCapacityLevel = null;

        // Remove supervisor constraints from n0body
        delete this.n0body._supervisorMaxVoices;
        delete this.n0body._supervisorPolyphonyScale;

        console.log('[supervisor] render load nominal — full capacity restored');

        if (this.state === STATES.DENSITY_REDUCED) {
            this._setState(STATES.NOMINAL, 'render load recovered');
        }
    }

    // ========== OUTRO / EMERGENCY ==========

    _triggerOutro(reason) {
        if (this.state === STATES.OUTRO || this.state === STATES.HANDOFF ||
            this.state === STATES.TERMINATED || this.state === STATES.EMERGENCY_STOP) {
            return;
        }

        if (!this._setState(STATES.OUTRO, reason)) return;

        this._outroReason = reason;
        console.log('[supervisor] outro triggered — reason: ' + reason);

        // Signal n0body to begin its outro sequence
        if (this.n0body.isPlaying && !this.n0body.isEnding) {
            this.n0body.stop();
        }

        // Begin master gain fade over outro duration
        this._beginMasterFade();

        // Write manifest 30 seconds before end
        var self = this;
        var manifestWriteMs = Math.max(0, this.outroDurationMs - 30000);
        this._manifestWriteTimer = setTimeout(function() {
            self._writeHandoff(false);
        }, manifestWriteMs);

        // Schedule HANDOFF after outro + buffer for silence confirmation
        var waitMs = this.outroDurationMs + 5000;
        this._outroTimer = setTimeout(function() {
            self._onOutroComplete();
        }, waitMs);
    }

    _beginMasterFade() {
        // Fade master gain to 0 over 90 seconds (leaves 30s buffer in 2-min outro)
        var ctx = this._getAudioContext();
        if (!ctx) return;

        // Use MK1 master volume API with safeSetParam pattern
        // Ramp over 90 seconds: 90000ms / 3 ≈ 30000 time constant
        if (typeof MK1 !== 'undefined' && MK1.master && MK1.master.setVolume) {
            var self = this;
            var steps = 30;
            var interval = 3000; // every 3s over 90s
            var currentVol = 0.7; // assumed starting volume
            var volStep = currentVol / steps;
            var fadeStep = 0;

            this._masterFadeTimer = setInterval(function() {
                fadeStep++;
                currentVol = Math.max(0, currentVol - volStep);
                MK1.master.setVolume(currentVol);

                if (fadeStep >= steps) {
                    clearInterval(self._masterFadeTimer);
                    self._masterFadeTimer = null;
                    MK1.master.setVolume(0);
                    console.log('[supervisor] master fade complete');
                }
            }, interval);
        }
    }

    _onOutroComplete() {
        if (this.state !== STATES.OUTRO) return;

        this._setState(STATES.HANDOFF, 'outro complete');

        // Write final handoff data (may overwrite the 30s-early write with more complete data)
        this._writeHandoff(false);

        // Attempt dual-context crossfade restart
        this._crossfadeRestart();
    }

    _triggerEmergencyStop() {
        console.error('[supervisor] EMERGENCY STOP — render capacity critical for ' +
            (EMERGENCY_HOLD_MS / 1000) + 's');

        this._setState(STATES.EMERGENCY_STOP, 'render capacity >95% for ' + (EMERGENCY_HOLD_MS / 1000) + 's');

        // Write partial handoff with interrupted flag
        this._writeHandoff(true);

        // Force immediate stop
        if (this.n0body.isPlaying) {
            this.n0body._actualStop();
        }

        this._setState(STATES.TERMINATED, 'emergency cleanup');
        this._cleanup();
    }

    // ========== HANDOFF WRITES ==========

    _writeHandoff(interrupted) {
        var elapsed = this.getSessionElapsedMs();
        var status = this.n0body.getStatus ? this.n0body.getStatus() : {};

        // 1. session-manifest.json
        var manifest = {
            session_id: this._sessionId,
            timestamp: new Date().toISOString(),
            session_interrupted: interrupted,
            current_musical_state: {
                bpm: status.bpm || this.n0body.currentBPM || null,
                key: status.scale || this.n0body.currentScaleName || null,
                energy_level: this.n0body._energyModifier || null,
                active_motifs: [],
                arc_position: status.currentState || this.n0body.currentState || null,
            },
            decisions_log: this._sessionDecisions.slice(-20),
            tried_and_rejected: this._sessionRejected,
            next_session_intent: interrupted ? 'recover from interrupted session' : this._deriveNextIntent(),
            next_session_constraints: interrupted ? ['check audio health before full density'] : [],
            audio_context_state: {
                nodes_at_close: this._estimateActiveNodes(),
                peak_render_capacity: this._peakRenderCapacity || null,
                session_duration_min: Math.round(elapsed / 60000),
            },
        };

        this._writeManifest(manifest);
        console.log('[supervisor] handoff: session-manifest written (interrupted=' + interrupted + ')');

        // 2. tried-rejected.json — append this session's rejections
        if (this._sessionRejected.length > 0) {
            this._appendTriedRejected(this._sessionRejected);
            console.log('[supervisor] handoff: ' + this._sessionRejected.length + ' entries appended to tried-rejected');
        }

        // 3. decision-log.jsonl — append all decisions from this session
        var self = this;
        this._sessionDecisions.forEach(function(d) {
            self._appendDecisionLog(d);
        });
        if (this._sessionDecisions.length > 0) {
            console.log('[supervisor] handoff: ' + this._sessionDecisions.length + ' decisions appended to decision-log');
        }
    }

    _deriveNextIntent() {
        var state = this.n0body.currentState;
        var mood = this.n0body.currentMood;
        var scale = this.n0body.currentScaleName;

        if (!mood) return '';

        // Simple heuristic: suggest contrast from where we ended
        if (state === 'peak') return 'begin with restraint — previous session ended at peak energy';
        if (state === 'breakdown') return 'continue the emotional thread — pick up from breakdown';
        if (mood === 'dark') return 'explore brighter territory or stay dark with a different scale';
        if (mood === 'bright') return 'try a darker palette or maintain brightness with new patterns';
        return 'follow intuition — previous session ended in ' + (state || 'unknown') + ' / ' + (mood || 'unknown');
    }

    _estimateActiveNodes() {
        if (typeof MK1 === 'undefined' || !MK1.utils || !MK1.utils.getHealth) return null;
        var health = MK1.utils.getHealth();
        if (!health) return null;
        return (health.activeDrumVoices || 0) + (health.activeSynthVoices || 0);
    }

    // Track decisions and rejections during session (called by monitor tick)
    recordDecision(decision, rationale, outcome) {
        var entry = {
            timestamp: new Date().toISOString(),
            session_id: this._sessionId,
            decision: decision,
            rationale: rationale || '',
            musical_state: {
                bpm: this.n0body.currentBPM || null,
                key: this.n0body.currentScaleName || null,
                energy: this.n0body._energyModifier || null,
            },
            outcome: outcome || '',
        };
        this._sessionDecisions.push(entry);
    }

    recordRejection(category, item, reason) {
        this._sessionRejected.push({
            category: category,
            item: item,
            reason: reason,
            timestamp: new Date().toISOString(),
        });
    }

    // ========== DUAL-CONTEXT CROSSFADE ==========

    _crossfadeRestart() {
        console.log('[supervisor] beginning dual-context crossfade restart');

        var self = this;

        // Step 1: Create new AudioContext BEFORE closing old
        var oldCtx = this._getAudioContext();
        var newCtx;

        try {
            newCtx = new AudioContext();
        } catch (e) {
            console.error('[supervisor] failed to create new AudioContext:', e);
            this._setState(STATES.TERMINATED, 'crossfade failed — no new context');
            this._cleanup();
            return;
        }

        // Step 2: Fadeout on old context (3 seconds) — already mostly faded from outro
        // The master fade already brought volume to 0, so this is a safety net.
        if (oldCtx && oldCtx.state !== 'closed') {
            try {
                var oldGain = oldCtx.createGain();
                oldGain.connect(oldCtx.destination);
                oldGain.gain.setValueAtTime(oldGain.gain.value, oldCtx.currentTime);
                oldGain.gain.linearRampToValueAtTime(0, oldCtx.currentTime + 3);
            } catch (e) {
                // Old context may already be degraded — proceed
            }
        }

        // Step 3: After 3.5 seconds, close old context and finalize
        setTimeout(function() {
            // Close old context
            if (oldCtx && oldCtx.state !== 'closed') {
                try {
                    oldCtx.close();
                    console.log('[supervisor] old AudioContext closed');
                } catch (e) {
                    console.warn('[supervisor] old context close failed:', e);
                }
            }

            // Signal that new context is available
            // MK1 integration would pick this up via event
            window.dispatchEvent(new CustomEvent('n0body-new-audio-context', {
                detail: { audioContext: newCtx }
            }));

            self._setState(STATES.TERMINATED, 'crossfade complete');
            self._cleanup();

            // Transition to IDLE — ready for next session
            self._setState(STATES.IDLE, 'ready for next session');

            console.log('[supervisor] crossfade complete — ready for warm restart');
        }, 3500);
    }

    // ========== STORAGE (localStorage) ==========

    _readManifest() {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.MANIFEST);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn('[supervisor] failed to read manifest:', e);
            return null;
        }
    }

    _writeManifest(manifest) {
        try {
            localStorage.setItem(STORAGE_KEYS.MANIFEST, JSON.stringify(manifest));
            return true;
        } catch (e) {
            console.error('[supervisor] failed to write manifest:', e);
            return false;
        }
    }

    _readTriedRejected() {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.TRIED_REJECTED);
            return data ? JSON.parse(data) : { patterns: [], progressions: [], transitions: [], fx_combinations: [], notes: '' };
        } catch (e) {
            return { patterns: [], progressions: [], transitions: [], fx_combinations: [], notes: '' };
        }
    }

    _appendTriedRejected(entries) {
        try {
            var current = this._readTriedRejected();
            entries.forEach(function(entry) {
                var cat = entry.category || 'patterns';
                if (current[cat] && Array.isArray(current[cat])) {
                    current[cat].push({ item: entry.item, reason: entry.reason, timestamp: entry.timestamp });
                    // Keep last 50 per category
                    if (current[cat].length > 50) current[cat] = current[cat].slice(-50);
                }
            });
            localStorage.setItem(STORAGE_KEYS.TRIED_REJECTED, JSON.stringify(current));
            return true;
        } catch (e) {
            console.error('[supervisor] failed to append tried-rejected:', e);
            return false;
        }
    }

    _readDecisionLog(count) {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.DECISION_LOG);
            if (!data) return [];
            var lines = data.trim().split('\n').filter(function(l) { return l.length > 0; });
            var entries = lines.map(function(line) {
                try { return JSON.parse(line); } catch (e) { return null; }
            }).filter(function(e) { return e !== null; });
            return entries.slice(-(count || 10));
        } catch (e) {
            return [];
        }
    }

    _appendDecisionLog(entry) {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.DECISION_LOG) || '';
            var line = JSON.stringify(entry);
            data += line + '\n';

            // Keep last 200 lines to prevent unbounded growth
            var lines = data.trim().split('\n');
            if (lines.length > 200) {
                data = lines.slice(-200).join('\n') + '\n';
            }

            localStorage.setItem(STORAGE_KEYS.DECISION_LOG, data);
            return true;
        } catch (e) {
            console.error('[supervisor] failed to append decision-log:', e);
            return false;
        }
    }

    // ========== CLEANUP / TEARDOWN ==========

    _cleanup() {
        this._stopMonitoring();

        if (this._outroTimer) {
            clearTimeout(this._outroTimer);
            this._outroTimer = null;
        }
        if (this._manifestWriteTimer) {
            clearTimeout(this._manifestWriteTimer);
            this._manifestWriteTimer = null;
        }
        if (this._masterFadeTimer) {
            clearInterval(this._masterFadeTimer);
            this._masterFadeTimer = null;
        }

        // Stop render capacity observer
        var ctx = this._getAudioContext();
        if (ctx && ctx.renderCapacity && typeof ctx.renderCapacity.stop === 'function') {
            ctx.renderCapacity.stop();
        }

        this._renderCapacity = null;
        this._emergencyStartTime = null;

        console.log('[supervisor] session ' + this._sessionId + ' terminated (' +
            Math.round(this.getSessionElapsedMs() / 1000) + 's)');
    }

    destroy() {
        this._cleanup();
        window.removeEventListener('n0body-request-outro', this._onOutroRequest);
    }
}

export { SessionSupervisor, STATES };
