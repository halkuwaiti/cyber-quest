// ============================================================================
// utils.js — tiny helper library: rng, math, drawing, colors, geometry
// Everything here is side-effect free and global (attached to window.PQ).
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // --- math ------------------------------------------------------------------
  PQ.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  PQ.lerp  = (a, b, t) => a + (b - a) * t;
  PQ.invLerp = (a, b, v) => (v - a) / (b - a);
  PQ.rand  = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  PQ.randInt = (a, b) => Math.floor(PQ.rand(a, b + 1));
  PQ.pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
  PQ.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  PQ.ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outQuad:  t => 1 - (1 - t) * (1 - t),
    inOutCubic: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2,
    outBack:  t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }
  };

  // --- geometry --------------------------------------------------------------
  PQ.aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y;

  PQ.pointIn = (x, y, r) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  // --- color -----------------------------------------------------------------
  PQ.hsla = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  PQ.rgba = (r, g, b, a = 1) => `rgba(${r|0},${g|0},${b|0},${a})`;
  PQ.mixColor = (c1, c2, t) => {
    // Expects hex "#rrggbb"; returns "rgb(r,g,b)"
    const p1 = parseInt(c1.slice(1), 16), p2 = parseInt(c2.slice(1), 16);
    const r = Math.round(((p1 >> 16) & 255) * (1 - t) + ((p2 >> 16) & 255) * t);
    const g = Math.round(((p1 >> 8) & 255) * (1 - t) + ((p2 >> 8) & 255) * t);
    const b = Math.round((p1 & 255) * (1 - t) + (p2 & 255) * t);
    return `rgb(${r},${g},${b})`;
  };

  // --- canvas drawing helpers ------------------------------------------------
  PQ.roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  };

  PQ.glowRect = (ctx, x, y, w, h, r, fill, glow, glowSize = 20) => {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = fill;
    PQ.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  };

  PQ.text = (ctx, txt, x, y, opts = {}) => {
    ctx.save();
    ctx.font = `${opts.weight || 700} ${opts.size || 14}px ${opts.font || '"SF Pro Display",system-ui,sans-serif'}`;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = opts.glowSize || 12;
    }
    if (opts.stroke) {
      ctx.lineWidth = opts.strokeWidth || 3;
      ctx.strokeStyle = opts.stroke;
      ctx.strokeText(txt, x, y);
    }
    ctx.fillStyle = opts.color || '#fff';
    ctx.fillText(txt, x, y);
    ctx.restore();
  };

  // --- time ------------------------------------------------------------------
  PQ.fmtTime = (seconds) => {
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- event bus (decouples modules) -----------------------------------------
  PQ.bus = (function () {
    const listeners = {};
    return {
      on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
      off(evt, fn) {
        if (!listeners[evt]) return;
        listeners[evt] = listeners[evt].filter(f => f !== fn);
      },
      emit(evt, payload) {
        if (!listeners[evt]) return;
        for (const fn of listeners[evt].slice()) fn(payload);
      }
    };
  })();
})();
