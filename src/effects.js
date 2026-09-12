// ============================================================================
// effects.js — camera shake, screen flash, slow-mo, glitch overlay
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // --- Camera / Screen Shake --------------------------------------------------
  const shake = {
    trauma: 0,         // 0..1
    seed:   Math.random() * 1000,
    decay:  0.88       // per-frame trauma decay when dt=1/60
  };

  function add(amount) { shake.trauma = PQ.clamp(shake.trauma + amount, 0, 1); }
  function update(dt) {
    // Trauma decays over time (exponential)
    shake.trauma = PQ.clamp(shake.trauma * Math.pow(shake.decay, dt * 60), 0, 1);
  }
  function offset() {
    const t2 = shake.trauma * shake.trauma;
    if (t2 < 0.0001) return { x: 0, y: 0, rot: 0 };
    const n = shake.seed + performance.now() * 0.02;
    const x = (Math.sin(n * 1.7) + Math.sin(n * 3.1)) * 14 * t2;
    const y = (Math.cos(n * 1.3) + Math.cos(n * 2.7)) * 14 * t2;
    const r = (Math.sin(n * 2.3)) * 0.02 * t2;
    return { x, y, rot: r };
  }

  // --- Screen Flash (full-screen color tint fading out) ----------------------
  let flashEl = null;
  function getFlashEl() {
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.className = 'fx-flash';
      document.body.appendChild(flashEl);
    }
    return flashEl;
  }
  function flash(color = 'rgba(255,255,255,0.5)', durationMs = 300) {
    const el = getFlashEl();
    el.style.background = color;
    el.style.opacity = '0.75';
    el.style.transition = 'none';
    // Force reflow
    void el.offsetWidth;
    el.style.transition = `opacity ${durationMs}ms ease-out`;
    el.style.opacity = '0';
  }

  // --- Glitch overlay (short, intense distortion on wrong answer etc.) ------
  function glitch(durationMs = 500) {
    const el = getFlashEl();
    el.style.background = 'transparent';
    el.style.opacity = '0';
    // Add/remove RGB-split & jitter via temp class on body
    document.body.classList.add('fx-glitching');
    setTimeout(() => document.body.classList.remove('fx-glitching'), durationMs);
  }

  // --- Time scaling for dramatic slow-mo moments -----------------------------
  let timeScale = 1;
  let timeScaleTarget = 1;
  function setTimeScale(v, smooth = 0.1) { timeScaleTarget = v; _tsSmooth = smooth; }
  function currentTimeScale() { return timeScale; }
  let _tsSmooth = 0.1;
  function updateTimeScale() { timeScale += (timeScaleTarget - timeScale) * _tsSmooth; }

  PQ.fx = { add, update, offset, flash, glitch, setTimeScale, currentTimeScale, updateTimeScale };
})();
