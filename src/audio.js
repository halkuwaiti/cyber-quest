// ============================================================================
// audio.js — procedural sound synthesis
// All SFX are generated at runtime via Web Audio API. No sample files.
// This guarantees the game works offline even on a laptop with no assets.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let enabled = true;
  let musicTimer = null;
  let currentMusicLayer = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.18;
      musicBus.connect(master);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(master);
    } catch (e) {
      console.warn('[PQ] Web Audio unavailable:', e);
    }
    return ctx;
  }

  // Helper — schedule a simple envelope on a gain node
  function env(gain, t, attack, decay, peak = 1.0) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // --- SFX -------------------------------------------------------------------

  function play(name) {
    if (!enabled) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    try {
      switch (name) {
        case 'jump':      return sfxJump();
        case 'land':      return sfxLand();
        case 'coin':      return sfxCoin();
        case 'hit':       return sfxHit();
        case 'hurt':      return sfxHurt();
        case 'powerup':   return sfxPowerUp();
        case 'correct':   return sfxCorrect();
        case 'wrong':     return sfxWrong();
        case 'portal':    return sfxPortal();
        case 'questionIn':return sfxQuestionIn();
        case 'select':    return sfxSelect();
        case 'start':     return sfxStart();
        case 'die':       return sfxDie();
        case 'levelDone': return sfxLevelDone();
        case 'victory':   return sfxVictory();
      }
    } catch (e) { /* never let audio kill the game */ }
  }
  PQ.sfx = { play, setEnabled(v) { enabled = !!v; }, isEnabled() { return enabled; } };

  function beep(freq, dur, type = 'square', peak = 0.4, when = 0) {
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(g);
    g.connect(sfxBus);
    env(g, t, 0.004, dur, peak);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function sweep(freqA, freqB, dur, type = 'sine', peak = 0.35, when = 0) {
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t + dur);
    osc.connect(g);
    g.connect(sfxBus);
    env(g, t, 0.005, dur, peak);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, filterFreq = 2000, peak = 0.35, when = 0) {
    const t = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;
    const g = ctx.createGain();
    src.connect(filter); filter.connect(g); g.connect(sfxBus);
    env(g, t, 0.005, dur, peak);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // Concrete effects
  function sfxJump()     { sweep(520, 880, 0.16, 'square', 0.18); }
  function sfxLand()     { noiseBurst(0.08, 600, 0.12); }
  function sfxCoin()     { beep(988, 0.07, 'square', 0.22); beep(1319, 0.12, 'square', 0.22, 0.07); }
  function sfxHit()      { beep(180, 0.09, 'square', 0.28); beep(90, 0.15, 'sawtooth', 0.22, 0.05); }
  function sfxHurt()     { sweep(440, 80, 0.35, 'sawtooth', 0.32); }
  function sfxPowerUp()  {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => beep(f, 0.12, 'square', 0.22, i * 0.07));
  }
  function sfxCorrect()  {
    // Cheerful ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => beep(f, 0.18, 'triangle', 0.28, i * 0.08));
  }
  function sfxWrong() {
    // Descending dissonant
    const notes = [392.00, 349.23, 293.66, 220.00];
    notes.forEach((f, i) => beep(f, 0.22, 'sawtooth', 0.28, i * 0.10));
    noiseBurst(0.3, 300, 0.12, 0.0);
  }
  function sfxPortal()   {
    sweep(220, 880, 0.6, 'sine', 0.28);
    sweep(440, 1760, 0.6, 'sawtooth', 0.10, 0.05);
  }
  function sfxQuestionIn() { sweep(660, 1320, 0.22, 'triangle', 0.22); }
  function sfxSelect()   { beep(660, 0.06, 'square', 0.2); }
  function sfxStart()    { beep(523, 0.1, 'square', 0.25); beep(784, 0.18, 'square', 0.25, 0.08); }
  function sfxDie() {
    const notes = [523, 392, 330, 262, 196, 165, 131];
    notes.forEach((f, i) => beep(f, 0.14, 'square', 0.25, i * 0.08));
  }
  function sfxLevelDone() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => beep(f, 0.14, 'triangle', 0.28, i * 0.08));
  }
  function sfxVictory() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568, 1976];
    notes.forEach((f, i) => beep(f, 0.18, 'triangle', 0.32, i * 0.10));
  }

  // --- Background music (tiny procedural loop per level) --------------------
  // We keep this gentle and non-intrusive. Users can toggle with M key.

  const MUSIC_PATTERNS = {
    PHISHING:   { bpm: 126, root: 69, scale: [0, 2, 4, 7, 9],  pad: true, color: 'cyan'    },
    PASSWORD:   { bpm: 110, root: 72, scale: [0, 2, 4, 7, 11], pad: true, color: 'gold'    },
    MALWARE:    { bpm: 118, root: 65, scale: [0, 2, 5, 7, 9],  pad: true, color: 'green'   },
    PRIVACY:    { bpm: 138, root: 62, scale: [0, 3, 5, 7, 10], pad: true, color: 'magenta' },
    RANSOMWARE: { bpm: 108, root: 55, scale: [0, 3, 5, 7, 10], pad: true, color: 'amber'   }
  };

  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function startMusic(layerKey) {
    if (!enabled) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (currentMusicLayer === layerKey) return;
    stopMusic();
    currentMusicLayer = layerKey;

    const pat = MUSIC_PATTERNS[layerKey] || MUSIC_PATTERNS.PHISHING;
    const beat = 60 / pat.bpm;      // seconds per beat
    const eighth = beat / 2;

    let step = 0;
    function tick() {
      const t = ctx.currentTime;
      // Bass pluck every beat
      if (step % 4 === 0) {
        const note = pat.root + (step % 16 === 0 ? 0 : 7);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToHz(note);
        osc.connect(g); g.connect(musicBus);
        env(g, t, 0.005, 0.35, 0.6);
        osc.start(t); osc.stop(t + 0.4);
      }
      // Lead arp
      if (step % 2 === 0) {
        const s = pat.scale[Math.floor(Math.random() * pat.scale.length)];
        const note = pat.root + 24 + s;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = midiToHz(note);
        osc.connect(g); g.connect(musicBus);
        env(g, t, 0.005, 0.18, 0.18);
        osc.start(t); osc.stop(t + 0.25);
      }
      // Subtle hat (noise) on offbeats
      if (step % 2 === 1) {
        noiseBurst(0.04, 8000, 0.05);
      }
      step++;
    }

    tick();
    musicTimer = setInterval(tick, eighth * 1000);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    currentMusicLayer = null;
  }

  function setMusicEnabled(v) {
    enabled = !!v;
    if (!enabled) stopMusic();
  }

  PQ.music = { start: startMusic, stop: stopMusic, setEnabled: setMusicEnabled };
})();
