// ============================================================================
// enemies.js — walkers, bouncers, spikes, and chasers
// Plus: pickups (packets), question blocks, and end-of-level portal.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // ---- base entity -------------------------------------------------------
  class Entity {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.dead = false;
      this.animT = PQ.rand(0, 100);
    }
    update(dt, world) { this.animT += dt; }
    draw(ctx) {}
  }

  // ---- BugWalker ---------------------------------------------------------
  // Walks along a platform, flipping at edges and walls.
  class BugWalker extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, 34, 28);
      this.vx = (opts.dir || 1) * 70;
      this.vy = 0;
      this.theme = opts.theme || 'default';
      this.squish = 1;
    }
    update(dt, world) {
      super.update(dt, world);
      if (this.dead) return;
      this.squish += (1 - this.squish) * Math.min(1, dt * 10);

      // gravity + platform collision
      this.vy += 2000 * dt;
      if (this.vy > 800) this.vy = 800;
      this.x += this.vx * dt;
      for (const t of world.tiles) {
        if (!t.solid) continue;
        if (PQ.aabb(this, t)) {
          if (this.vx > 0) this.x = t.x - this.w;
          else             this.x = t.x + t.w;
          this.vx = -this.vx;
        }
      }
      this.y += this.vy * dt;
      let landed = false;
      for (const t of world.tiles) {
        if (!t.solid) continue;
        if (PQ.aabb(this, t)) {
          if (this.vy > 0) { this.y = t.y - this.h; this.vy = 0; landed = true; }
          else             { this.y = t.y + t.h; this.vy = 0; }
        }
      }
      // If about to walk off a ledge, flip direction
      if (landed) {
        const probeX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
        const probeY = this.y + this.h + 4;
        let supported = false;
        for (const t of world.tiles) {
          if (!t.solid) continue;
          if (probeX >= t.x && probeX <= t.x + t.w && probeY >= t.y && probeY <= t.y + t.h) {
            supported = true; break;
          }
        }
        if (!supported) this.vx = -this.vx;
      }

      if (this.y > 1800) this.dead = true;
    }
    stomp() {
      this.dead = true;
      this.squish = 0.2;
    }
    draw(ctx) {
      if (this.dead) return;
      ctx.save();
      const cx = this.x + this.w/2;
      const cy = this.y + this.h/2;
      ctx.translate(cx, cy);
      const wobble = Math.sin(this.animT * 6) * 0.08;
      ctx.scale(Math.sign(this.vx) || 1, this.squish * (1 + wobble));
      // body
      ctx.fillStyle = '#22112a';
      PQ.roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
      // glitchy chevrons
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(-this.w/2 + 4, -this.h/2 + 4, this.w - 8, 3);
      ctx.fillRect(-this.w/2 + 4, this.h/2 - 7, this.w - 8, 3);
      // eyes
      ctx.fillStyle = '#ff6bd6';
      ctx.fillRect(-6, -3, 4, 4);
      ctx.fillRect(2, -3, 4, 4);
      // antenna bit
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(-1, -this.h/2 - 5, 2, 5);
      ctx.restore();
    }
  }

  // ---- DroppedPacket (bouncer) -------------------------------------------
  class DroppedPacket extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, 30, 30);
      this.origin = y;
      this.amp = opts.amp || 80;
      this.speed = opts.speed || 2.0;
    }
    update(dt, world) {
      super.update(dt, world);
      if (this.dead) return;
      this.y = this.origin + Math.sin(this.animT * this.speed) * this.amp;
    }
    stomp() { this.dead = true; }
    draw(ctx) {
      if (this.dead) return;
      ctx.save();
      ctx.translate(this.x + this.w/2, this.y + this.h/2);
      ctx.fillStyle = '#2a0d16';
      PQ.roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 2;
      ctx.stroke();
      // X mark (dropped)
      ctx.strokeStyle = '#ff5a7a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-7,-7); ctx.lineTo(7,7);
      ctx.moveTo(7,-7);  ctx.lineTo(-7,7);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- Spike (static hazard) ---------------------------------------------
  class Spike extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, opts.w || 40, opts.h || 20);
      this.count = Math.max(1, Math.floor(this.w / 10));
    }
    // Spikes aren't stompable — only damage the player.
    stomp() { return false; }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = '#ff5a7a';
      const step = this.w / this.count;
      for (let i = 0; i < this.count; i++) {
        const x = this.x + i * step;
        ctx.beginPath();
        ctx.moveTo(x, this.y + this.h);
        ctx.lineTo(x + step / 2, this.y + 2);
        ctx.lineTo(x + step,     this.y + this.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- DDoSCloud (homing) ------------------------------------------------
  class DDoSCloud extends Entity {
    constructor(x, y) {
      super(x, y, 36, 28);
      this.vx = 0; this.vy = 0;
      this.speed = 90;
    }
    update(dt, world) {
      super.update(dt, world);
      if (this.dead) return;
      if (!world.player) return;
      const dx = world.player.cx - (this.x + this.w/2);
      const dy = world.player.cy - (this.y + this.h/2);
      const d = Math.hypot(dx, dy) || 1;
      this.vx += (dx/d * this.speed - this.vx) * Math.min(1, dt * 2);
      this.vy += (dy/d * this.speed - this.vy) * Math.min(1, dt * 2);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > 1800) this.dead = true;
    }
    stomp() { this.dead = true; }
    draw(ctx) {
      if (this.dead) return;
      ctx.save();
      const cx = this.x + this.w/2, cy = this.y + this.h/2;
      ctx.translate(cx, cy);
      // Three overlapping soft circles
      const pulse = 1 + Math.sin(this.animT * 8) * 0.08;
      ctx.fillStyle = 'rgba(255,107,214,0.85)';
      ctx.beginPath(); ctx.arc(-8, 0, 12*pulse, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 0, 12*pulse, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -6, 14*pulse, 0, Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -4, 3, 3);
      ctx.fillRect(3, -4, 3, 3);
      ctx.restore();
    }
  }

  // ---- Coin (collectible) — was "Packet" in Cyber Quest -----------------
  class Packet extends Entity {
    constructor(x, y) {
      super(x, y, 22, 22);
      this.baseY = y;
    }
    update(dt, world) {
      super.update(dt, world);
      this.y = this.baseY + Math.sin(this.animT * 4) * 3;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.w/2, this.y + this.h/2);
      // Spin: stretch X by cos(animT) so the coin appears to rotate edge-on.
      const spin = Math.cos(this.animT * 4);
      const radius = 11;
      const sx = Math.max(0.18, Math.abs(spin));   // never fully flat
      ctx.scale(sx, 1);
      // Outer disk — radial gradient gold
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, radius);
      g.addColorStop(0, '#fff7c2');
      g.addColorStop(0.45, '#ffd45a');
      g.addColorStop(1, '#a06b00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI*2);
      ctx.fill();
      // Rim
      ctx.strokeStyle = 'rgba(120,80,0,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // "$" mark when facing forward
      if (sx > 0.55) {
        ctx.fillStyle = 'rgba(120,80,0,0.85)';
        ctx.font = '900 13px "SF Pro Display", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
  }

  // ---- QuestionBlock -----------------------------------------------------
  class QuestionBlock extends Entity {
    constructor(x, y, opts = {}) {
      super(x, y, 42, 42);
      this.used = false;       // once answered, block is used
      this.topicHint = opts.topic || null;
      this.index = opts.index != null ? opts.index : 0;  // which question in the layer set
      // kind: 'question' (regular MCQ), 'phishing' (mini-game), 'scenario' (Stop & Think card)
      this.kind = opts.kind || 'question';
      this.pulse = 0;
    }
    update(dt, world) {
      super.update(dt, world);
      this.pulse = 0.5 + Math.sin(this.animT * 3) * 0.5;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x + this.w/2, this.y + this.h/2);
      const used = this.used;
      // Color theme by kind: cyan ? for regular question, gold ! for scenario,
      // magenta ★ for level-specific interactive mini-game.
      const colors = {
        question: { bg: '#0d1a3a', glow: '#6bf0ff', icon: '?'  },
        scenario: { bg: '#3a2d0d', glow: '#ffd15a', icon: '!'  },
        minigame: { bg: '#3a0d2a', glow: '#ff6bd6', icon: '★'  }
      };
      const c = colors[this.kind] || colors.question;
      ctx.fillStyle = used ? '#2a2f40' : c.bg;
      PQ.roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 8);
      ctx.fill();
      if (!used) {
        ctx.globalAlpha = 0.18 + this.pulse * 0.22;
        ctx.fillStyle = c.glow;
        PQ.roundRect(ctx, -this.w/2 + 4, -this.h/2 + 4, this.w - 8, this.h - 8, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = used ? '#444' : c.glow;
      ctx.lineWidth = 2;
      PQ.roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 8);
      ctx.stroke();
      ctx.fillStyle = used ? '#555' : '#eaffff';
      ctx.font = `900 26px "SF Pro Display", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(used ? '·' : c.icon, 0, 1);
      ctx.restore();
    }
  }

  // ---- Portal (end of level) --------------------------------------------
  class Portal extends Entity {
    constructor(x, y) {
      super(x, y, 60, 90);
    }
    draw(ctx) {
      ctx.save();
      const cx = this.x + this.w/2, cy = this.y + this.h/2;
      // Beams
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const r = 30 + i * 10 + Math.sin(this.animT * 3 + i) * 6;
        ctx.strokeStyle = `hsla(${(this.animT * 80 + i * 60) % 360}, 100%, 65%, ${0.45 - i*0.1})`;
        ctx.lineWidth = 3 - i;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 1.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Core — flat bright core without shadowBlur
      ctx.fillStyle = 'rgba(107,240,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  PQ.Entity = Entity;
  PQ.BugWalker = BugWalker;
  PQ.DroppedPacket = DroppedPacket;
  PQ.Spike = Spike;
  PQ.DDoSCloud = DDoSCloud;
  PQ.Packet = Packet;
  PQ.QuestionBlock = QuestionBlock;
  PQ.Portal = Portal;
})();
