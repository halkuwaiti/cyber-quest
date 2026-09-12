// ============================================================================
// particles.js — small but flexible particle system
// Two layers: world-space particles (in camera) and screen-space (HUD/confetti)
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  class Particle {
    constructor(x, y, opts = {}) {
      this.x = x; this.y = y;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.ax = opts.ax || 0;
      this.ay = opts.ay || 0;        // gravity-like
      this.life = opts.life || 1.0;  // seconds
      this.age = 0;
      this.size = opts.size || 3;
      this.sizeEnd = opts.sizeEnd !== undefined ? opts.sizeEnd : this.size * 0.2;
      this.color = opts.color || '#6bf0ff';
      this.colorEnd = opts.colorEnd || null;
      this.blend = opts.blend || 'lighter';
      this.shape = opts.shape || 'circle';   // circle | square | spark | star | text
      this.text = opts.text || '';            // for shape:'text'
      this.rot = opts.rot || 0;
      this.rotV = opts.rotV || 0;
      this.drag = opts.drag || 0;            // e.g. 0.96 per-frame multiplier
      this.glow = opts.glow || 0;            // extra shadowBlur
      this.dead = false;
    }
    update(dt) {
      this.age += dt;
      if (this.age >= this.life) { this.dead = true; return; }
      this.vx += this.ax * dt;
      this.vy += this.ay * dt;
      if (this.drag) {
        const d = Math.pow(this.drag, dt * 60);
        this.vx *= d; this.vy *= d;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.rotV * dt;
    }
    draw(ctx) {
      const t = PQ.clamp(this.age / this.life, 0, 1);
      const size = PQ.lerp(this.size, this.sizeEnd, t);
      const alpha = 1 - t;
      // NOTE: no shadowBlur. It was the #1 source of stutter on bursts
      // (40 shadow-blurred draws per shield-break = GPU nightmare). We fake
      // the "glow" via additive compositing + a faint halo when glow > 0.
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = this.blend;
      let fill = this.color;
      if (this.colorEnd) fill = PQ.mixColor(this.color, this.colorEnd, t);
      ctx.fillStyle = fill;
      ctx.translate(this.x, this.y);
      if (this.rot) ctx.rotate(this.rot);

      if (this.shape === 'square') {
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else if (this.shape === 'spark') {
        ctx.fillRect(-size / 2, -1, size, 2);
        ctx.fillRect(-1, -size / 2, 2, size);
      } else if (this.shape === 'text') {
        ctx.font = `900 ${Math.round(size)}px "SF Pro Display", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // soft outline so "+10" reads against any backdrop
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(this.text, 0, 0);
        ctx.fillText(this.text, 0, 0);
      } else {
        // circle (default) — faint halo via second translucent disc for "glow"
        if (this.glow) {
          ctx.globalAlpha = alpha * 0.28;
          ctx.beginPath(); ctx.arc(0, 0, size * 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = alpha;
        }
        ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  class ParticleSystem {
    constructor() { this.items = []; }
    emit(x, y, opts) {
      this.items.push(new Particle(x, y, opts));
    }
    // add({x,y,...}) — convenience for emitter call sites that already carry x/y inline.
    add(opts) {
      this.items.push(new Particle(opts.x || 0, opts.y || 0, opts));
    }
    burst(x, y, count, optsFn) {
      for (let i = 0; i < count; i++) this.items.push(new Particle(x, y, optsFn(i)));
    }
    update(dt) {
      for (const p of this.items) p.update(dt);
      if (this.items.length > 0) {
        // remove dead — fast in-place compaction
        let j = 0;
        for (let i = 0; i < this.items.length; i++) {
          if (!this.items[i].dead) this.items[j++] = this.items[i];
        }
        this.items.length = j;
      }
    }
    draw(ctx) { for (const p of this.items) p.draw(ctx); }
    clear() { this.items.length = 0; }
    count() { return this.items.length; }
  }

  PQ.Particle = Particle;
  PQ.ParticleSystem = ParticleSystem;

  // --- HTML-layer confetti (for CORRECT celebration). Heavier, screen-space.
  const COLORS = ['#6bf0ff', '#ff6bd6', '#b9ff6b', '#ffd15a', '#5eff9a', '#ff9e64'];

  PQ.confetti = function confetti(n = 80) {
    let layer = document.getElementById('confetti-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'confetti-layer';
      document.body.appendChild(layer);
    }
    for (let i = 0; i < n; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      piece.style.background = color;
      piece.style.left = (50 + (Math.random() - 0.5) * 40) + 'vw';
      const rot = Math.random() * 360;
      const x = (Math.random() - 0.5) * 600;
      const y = window.innerHeight + 200;
      const dur = 1800 + Math.random() * 1400;
      piece.style.transform = `translate(0,0) rotate(${rot}deg)`;
      piece.style.borderRadius = Math.random() > 0.5 ? '2px' : '50%';
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (10 + Math.random() * 10) + 'px';
      piece.style.boxShadow = `0 0 10px ${color}`;
      piece.style.opacity = '1';
      layer.appendChild(piece);
      piece.animate(
        [
          { transform: `translate(0,0) rotate(${rot}deg)`, opacity: 1 },
          { transform: `translate(${x}px, ${y}px) rotate(${rot + 720}deg)`, opacity: 0 }
        ],
        { duration: dur, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)', fill: 'forwards' }
      );
      setTimeout(() => piece.remove(), dur + 50);
    }
  };
})();
