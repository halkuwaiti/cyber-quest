// ============================================================================
// player.js — "Packy" the data packet
// Tight platformer controls: variable-height jump, coyote time, jump buffer,
// squash & stretch, facing flip, particle trails, power-up modulation.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  const BASE = {
    width:  30,
    height: 36,
    maxRun: 360,     // px/sec
    accel:  2600,
    decel:  2300,
    airAccel: 2000,
    friction: 1800,
    gravity: 2100,
    jumpVel: -840,   // ↑ stronger jump — reaches ~168px peak (was 123)
    airJumpVel: -760,// 2nd+ air jumps slightly weaker for feel
    maxFall: 900,
    coyote:  0.10,   // seconds
    jumpBuf: 0.14,
    jumpCut: 0.42,   // multiplier for vy when jump released early
    maxJumps: 2      // DOUBLE JUMP ENABLED BY DEFAULT (was 1)
  };

  // Power-ups — final cyber-themed naming.
  // Active rotation: SHIELD (Antivirus Shield) / EXTRA_LIFE (2FA Token) / INVINCIBLE (Patch Update).
  const POWER_DEFAULTS = {
    SHIELD:      { dur: 12.0, label: 'Antivirus Shield', effect: 'Blocks one hit · 12s',   tint: '#6bf0ff' },
    EXTRA_LIFE:  { dur: 0.0,  label: '2FA Token',        effect: '+1 life',                tint: '#5eff9a' },
    INVINCIBLE:  { dur: 8.0,  label: 'Patch Update',     effect: 'Immune to damage · 8s',  tint: '#ffd15a' },
    SPEED:       { dur: 8.0,  label: 'Strong Password',  effect: '+55% run speed · 8s',    tint: '#ffc857' },
    TRIPLE_JUMP: { dur: 10.0, label: 'Encryption Cloak', effect: 'Three air jumps · 10s',  tint: '#b9ff6b' },
    MAGNET:      { dur: 10.0, label: 'Backup Drive',     effect: 'Pulls coins · 10s',      tint: '#ff6bd6' }
  };

  // Penalties — Malware (spawn), DDoS Attack (slow), Buffer Overflow (inverted controls).
  const PENALTY_DEFAULTS = {
    SLOW:     { dur: 6.0, label: 'DDoS Attack',      effect: '-50% run speed · 6s',   tint: '#ff5a7a' },
    SHRINK:   { dur: 8.0, label: 'Tracker Tag',      effect: 'Half size · 8s',        tint: '#ff5a7a' },
    DROP:     { dur: 0.0, label: 'Data Leak',        effect: '−1 life',               tint: '#ff5a7a' },
    SPAWN:    { dur: 0.0, label: 'Malware',          effect: '7 enemies appear',      tint: '#ff5a7a' },
    OVERFLOW: { dur: 2.0, label: 'Buffer Overflow',  effect: 'Controls inverted · 2s',tint: '#ff5a7a' }
  };

  class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = BASE.width; this.h = BASE.height;
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.coyoteT = 0;
      this.jumpBufT = 0;
      this.jumpReleased = true;
      this.maxJumps = BASE.maxJumps;   // 2 by default (single + double)
      this.jumpsUsed = 0;              // resets on landing
      this.squash = 1;     // x-scale
      this.stretch = 1;    // y-scale
      this.animT = 0;
      this.blinkT = PQ.rand(2, 5);
      this.blink = 0;
      this.alive = true;
      // 1.5s of spawn grace — used on initial level load AND on respawn
      // after a death, so the player never takes a hit the moment they
      // appear. Flickers visually during this window so you can see it.
      this.invulnT = 1.5;
      this.hurtT = 0;      // red flash timer

      // Power-ups / penalties — one active at a time (new replaces old)
      this.power = null;       // { type, t }
      this.penalty = null;

      // Cosmetic trail
      this.trailT = 0;
    }

    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }

    // Clear any active power-up's side effects before overwriting
    _clearPowerEffect() {
      if (!this.power) return;
      if (this.power.type === 'TRIPLE_JUMP') this.maxJumps = BASE.maxJumps;
    }

    // Apply power-up
    grant(type) {
      const def = POWER_DEFAULTS[type];
      if (!def) return;
      this._clearPowerEffect();
      // Instant-effect powers (no duration) — apply once and emit a flash.
      if (type === 'EXTRA_LIFE') {
        // Bump game lives by one. Capped at 9 to keep HUD readable.
        const game = PQ.game || (window.PQ && window.PQ.game);
        if (game) game.lives = Math.min(9, (game.lives || 0) + 1);
        this.power = { type, t: 0, total: 0, label: def.label, tint: def.tint };
        PQ.bus.emit('power', this.power);
        return;
      }
      this.power = { type, t: def.dur, total: def.dur, label: def.label, tint: def.tint };
      if (type === 'TRIPLE_JUMP') this.maxJumps = 3;
      PQ.bus.emit('power', this.power);
    }

    afflict(type) {
      const def = PENALTY_DEFAULTS[type];
      if (!def) return null;
      this.penalty = { type, t: def.dur, total: def.dur, label: def.label, tint: def.tint };
      PQ.bus.emit('penalty', this.penalty);
      return this.penalty;
    }

    hasPower(type) { return this.power && this.power.type === type && this.power.t > 0; }
    hasPenalty(type) { return this.penalty && this.penalty.type === type && this.penalty.t > 0; }

    // Called when an enemy/hazard hits us
    takeHit(fatal = false) {
      if (this.invulnT > 0) return 'invuln';
      if (this.hasPower('INVINCIBLE')) return 'invuln';
      if (this.hasPower('SHIELD')) {
        this.power = null;        // consume
        this.invulnT = 1.2;
        PQ.bus.emit('shieldBreak', this);
        return 'shield';
      }
      this.hurtT = 0.6;
      this.invulnT = 1.4;
      this.vy = -480;
      this.vx = -this.facing * 240;
      if (fatal) { this.alive = false; }
      return fatal ? 'died' : 'hurt';
    }

    // Movement update. `tiles` is the level's collider rectangles.
    update(dt, tiles, input) {
      if (!this.alive) {
        // Death fall physics
        this.vy += BASE.gravity * dt * 0.7;
        this.y += this.vy * dt;
        this.animT += dt;
        return;
      }

      this.animT += dt;
      this.invulnT = Math.max(0, this.invulnT - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blink = 0.14;
        this.blinkT = PQ.rand(2, 5);
      }
      this.blink = Math.max(0, this.blink - dt);

      // Power / penalty timers
      if (this.power) {
        this.power.t -= dt;
        if (this.power.t <= 0) {
          this._clearPowerEffect();
          this.power = null;
          PQ.bus.emit('power', null);
        }
      }
      if (this.penalty) {
        this.penalty.t -= dt;
        if (this.penalty.t <= 0) {
          this.penalty = null;
          PQ.bus.emit('penalty', null);
        }
      }

      // Timers
      if (this.onGround) this.coyoteT = BASE.coyote; else this.coyoteT = Math.max(0, this.coyoteT - dt);
      this.jumpBufT = Math.max(0, this.jumpBufT - dt);

      // Inputs — Buffer Overflow penalty inverts left/right for its duration.
      let left  = input.isDown('left');
      let right = input.isDown('right');
      if (this.hasPenalty('OVERFLOW')) {
        const tmp = left; left = right; right = tmp;
      }
      const jumpPressed = input.wasPressed('jump') || input.wasPressed('up');
      const jumpHeld = input.isDown('jump') || input.isDown('up');

      if (jumpPressed) this.jumpBufT = BASE.jumpBuf;
      if (!jumpHeld) this.jumpReleased = true;

      // Apply horizontal accel
      const speedMult = this.hasPower('SPEED') ? 1.55 : (this.hasPenalty('SLOW') ? 0.5 : 1.0);
      const maxRun = BASE.maxRun * speedMult;
      const accel  = (this.onGround ? BASE.accel : BASE.airAccel);

      if (left && !right) {
        this.vx -= accel * dt;
        if (this.vx > 0) this.vx -= BASE.decel * dt;
        this.facing = -1;
      } else if (right && !left) {
        this.vx += accel * dt;
        if (this.vx < 0) this.vx += BASE.decel * dt;
        this.facing = 1;
      } else {
        // friction
        if (this.onGround) {
          if (this.vx > 0) this.vx = Math.max(0, this.vx - BASE.friction * dt);
          else if (this.vx < 0) this.vx = Math.min(0, this.vx + BASE.friction * dt);
        }
      }
      this.vx = PQ.clamp(this.vx, -maxRun, maxRun);

      // Multi-jump: ground / coyote counts as jump #1, plus up to (maxJumps-1) air jumps.
      if (this.jumpBufT > 0) {
        const isGroundJump = this.onGround || this.coyoteT > 0;
        if (isGroundJump) {
          this.vy = BASE.jumpVel;
          this.onGround = false;
          this.coyoteT = 0;
          this.jumpBufT = 0;
          this.jumpReleased = false;
          this.jumpsUsed = 1;
          this.stretch = 1.25; this.squash = 0.82;
          PQ.sfx.play('jump');
          PQ.bus.emit('jump', this);
        } else if (this.jumpsUsed < this.maxJumps) {
          // Air jump
          this.vy = BASE.airJumpVel;
          this.jumpsUsed++;
          this.jumpBufT = 0;
          this.jumpReleased = false;
          this.stretch = 1.3; this.squash = 0.8;
          PQ.sfx.play('jump');
          PQ.bus.emit('doubleJump', this);
          // Puff of particles at feet to sell the mid-air kick
          PQ.bus.emit('jump', this);
        }
      }

      // Variable jump: cut upward velocity when jump released early
      if (this.jumpReleased === false && !jumpHeld && this.vy < 0) {
        this.vy *= BASE.jumpCut;
        this.jumpReleased = true;
      }

      // Gravity
      this.vy += BASE.gravity * dt;
      if (this.vy > BASE.maxFall) this.vy = BASE.maxFall;

      // Integrate + resolve collisions (X then Y)
      this.x += this.vx * dt;
      resolveX(this, tiles);
      this.y += this.vy * dt;
      const wasOnGround = this.onGround;
      this.onGround = false;
      resolveY(this, tiles);

      if (!wasOnGround && this.onGround) {
        this.stretch = 0.75; this.squash = 1.22;
        PQ.sfx.play('land');
      }

      // Ease squash/stretch back to 1
      this.squash += (1 - this.squash) * Math.min(1, dt * 12);
      this.stretch += (1 - this.stretch) * Math.min(1, dt * 12);

      // Particle trail when running fast or boosted
      this.trailT -= dt;
      const shouldTrail = this.hasPower('SPEED') || Math.abs(this.vx) > maxRun * 0.8;
      if (shouldTrail && this.trailT <= 0 && this.onGround) {
        this.trailT = 0.03;
        PQ.bus.emit('trail', { x: this.cx - this.facing * 6, y: this.y + this.h - 4, vx: -this.vx * 0.12, color: this.power ? this.power.tint : '#6bf0ff' });
      }

      // Fall death — catch-all so we never fall infinitely
      if (this.y > 1800) this.alive = false;
    }

    // Cosmetic scale (applied in render based on power state)
    get scaleMul() {
      if (this.hasPenalty('SHRINK')) return 0.55;
      if (this.hasPower('MAGNET'))   return 1.05;
      return 1.0;
    }

    draw(ctx) {
      // Invuln flicker: skip every other frame for a blink effect
      if (this.invulnT > 0 && !this.hasPower('INVINCIBLE') && Math.floor(this.animT * 20) % 2 === 0) return;

      ctx.save();
      const mul = this.scaleMul;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      ctx.translate(cx, cy);
      ctx.scale(this.facing * this.squash * mul, this.stretch * mul);

      // Aura — faint halo disc behind the character instead of shadowBlur.
      // Single draw, no GPU shadow pass.
      if (this.hasPower('INVINCIBLE')) {
        const hue = (this.animT * 360) | 0;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
        ctx.beginPath(); ctx.arc(0, 0, this.h * 0.95, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (this.power) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = this.power.tint;
        ctx.beginPath(); ctx.arc(0, 0, this.h * 0.82, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawHero(ctx, this);

      // Shield bubble — plain stroke, no shadow
      if (this.hasPower('SHIELD')) {
        ctx.strokeStyle = 'rgba(107,240,255,0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(this.w, this.h) * 0.72 + Math.sin(this.animT * 6) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // --- Hero character art (chibi Captain-Falcon-ish runner) ----------------
  // All coordinates are relative to the already-translated, scaled canvas.
  // Origin is the player's center; y grows downward.
  // Player is 30 wide × 36 tall — we draw head/torso/limbs proportionally.
  function drawHero(ctx, p) {
    const w = p.w, h = p.h;
    const x = -w / 2, y = -h / 2;

    // Palette
    const hurt       = p.hurtT > 0;
    const shrunk     = p.hasPenalty('SHRINK');
    const skin       = '#e1b48c';
    const helmetRed  = hurt ? '#ffa6a6' : '#d62a2a';
    const helmetDk   = '#8a1414';
    const visor      = '#0a0f22';
    const visorLit   = '#6bf0ff';
    const suitBlue   = hurt ? '#ff8aa0' : (shrunk ? '#9aa6d0' : '#3a6bff');
    const suitDk     = '#1f3db5';
    const trimYellow = '#ffd15a';
    const boot       = '#1a1d2e';
    const glove      = '#ffd15a';
    const scarf      = '#ff6bd6';

    // Running animation drivers
    const speed       = Math.min(1, Math.abs(p.vx) / 360);
    const airborne    = !p.onGround;
    const cycle       = p.animT * 14;
    const runAmt      = p.onGround ? (0.3 + speed * 0.9) : 0.25;
    const legA        = airborne ? 0.55 : Math.sin(cycle) * 0.55 * runAmt;
    const legB        = airborne ? -0.35 : -Math.sin(cycle) * 0.55 * runAmt;
    const armA        = airborne ? -0.8 : -Math.sin(cycle) * 0.5 * runAmt;
    const armB        = airborne ?  0.6 :  Math.sin(cycle) * 0.5 * runAmt;
    const bob         = p.onGround ? Math.abs(Math.sin(cycle)) * 1.2 * speed : 0;

    // Scarf flutter (drawn BEHIND the body, trailing opposite facing — but facing is
    // already baked into our scaled canvas, so "behind" is the +x side after flip)
    const scarfWave = Math.sin(p.animT * 10) * 2;
    ctx.save();
    ctx.fillStyle = scarf;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + 11);
    ctx.lineTo(x + w * 0.35 + 10 + scarfWave, y + 15);
    ctx.lineTo(x + w * 0.35 + 14 + scarfWave, y + 22 + scarfWave);
    ctx.lineTo(x + w * 0.35 + 4,  y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- LEGS (drawn behind torso) ---
    const hipY   = y + h - 11 - bob;
    const legLen = 9;
    const drawLeg = (dx, rot, front) => {
      ctx.save();
      ctx.translate(dx, hipY);
      ctx.rotate(rot);
      // upper leg (suit pants)
      ctx.fillStyle = front ? suitBlue : suitDk;
      PQ.roundRect(ctx, -3, 0, 6, legLen, 1.5);
      ctx.fill();
      // boot
      ctx.fillStyle = boot;
      PQ.roundRect(ctx, -4, legLen - 2, 8, 5, 1.5);
      ctx.fill();
      // boot trim (yellow stripe)
      ctx.fillStyle = trimYellow;
      ctx.fillRect(-4, legLen - 2, 8, 1);
      ctx.restore();
    };
    drawLeg(-3, legB, false);
    drawLeg( 3, legA, true);

    // --- TORSO — muscular V-shape ---
    ctx.save();
    // Shadow between legs & torso
    ctx.fillStyle = suitDk;
    PQ.roundRect(ctx, x + 4, y + 13 - bob, w - 8, 15, 2);
    ctx.fill();
    // Chest front (lighter blue, chest "pecs" look via diagonal gradient)
    const grad = ctx.createLinearGradient(x + 4, y + 13, x + w - 4, y + 28);
    grad.addColorStop(0, suitBlue);
    grad.addColorStop(1, suitDk);
    ctx.fillStyle = grad;
    // V-torso: wider at shoulders, narrower at waist
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 14 - bob);                 // left shoulder out
    ctx.lineTo(x + w - 3, y + 14 - bob);             // right shoulder
    ctx.lineTo(x + w - 6, y + h - 10 - bob);         // right waist
    ctx.lineTo(x + 6, y + h - 10 - bob);             // left waist
    ctx.closePath();
    ctx.fill();
    // Pec split (centerline groove)
    ctx.strokeStyle = suitDk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 15 - bob);
    ctx.lineTo(0, y + 22 - bob);
    ctx.stroke();
    // Emblem diamond (EC-441 insignia)
    ctx.fillStyle = trimYellow;
    const emY = y + 22 - bob;
    ctx.beginPath();
    ctx.moveTo(0, emY - 3);
    ctx.lineTo(3, emY);
    ctx.lineTo(0, emY + 3);
    ctx.lineTo(-3, emY);
    ctx.closePath();
    ctx.fill();
    // Shoulder trim
    ctx.fillStyle = trimYellow;
    ctx.fillRect(x + 3, y + 14 - bob, w - 6, 1.5);
    // Belt
    ctx.fillStyle = boot;
    ctx.fillRect(x + 6, y + h - 12 - bob, w - 12, 2);
    ctx.fillStyle = trimYellow;
    ctx.fillRect(-1.5, y + h - 12 - bob, 3, 2);       // buckle
    ctx.restore();

    // --- ARMS — drawn in front of torso, animated ---
    const shoulderY = y + 14 - bob;
    const drawArm = (dx, rot, front) => {
      ctx.save();
      ctx.translate(dx, shoulderY);
      ctx.rotate(rot);
      // upper arm (suit)
      ctx.fillStyle = front ? suitBlue : suitDk;
      PQ.roundRect(ctx, -2.5, 0, 5, 7, 1.5);
      ctx.fill();
      // forearm + glove
      ctx.fillStyle = glove;
      PQ.roundRect(ctx, -3, 6, 6, 6, 1.5);
      ctx.fill();
      // knuckle dots (tiny detail)
      ctx.fillStyle = '#8a5a00';
      ctx.fillRect(-2, 9, 1, 1);
      ctx.fillRect(0, 9, 1, 1);
      ctx.restore();
    };
    drawArm(x + 4.5, armB, false);
    drawArm(x + w - 4.5, armA, true);

    // --- HEAD + HELMET ---
    const headCX = 0;
    const headCY = y + 7 - bob * 0.5;
    // Neck
    ctx.fillStyle = skin;
    ctx.fillRect(-2, y + 11 - bob, 4, 3);
    // Face (skin circle)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(headCX, headCY + 1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Jaw shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-5, headCY + 3, 10, 1.5);
    // Helmet dome (red)
    ctx.fillStyle = helmetRed;
    ctx.beginPath();
    ctx.arc(headCX, headCY, 8, Math.PI, 0);
    ctx.fill();
    // Helmet side-flare (coming forward past ear)
    ctx.fillStyle = helmetRed;
    ctx.beginPath();
    ctx.moveTo(2, headCY - 2);
    ctx.lineTo(9, headCY - 2);
    ctx.lineTo(8, headCY + 2);
    ctx.lineTo(3, headCY + 1);
    ctx.closePath();
    ctx.fill();
    // Helmet shadow seam
    ctx.fillStyle = helmetDk;
    ctx.fillRect(-7, headCY - 1, 14, 1);
    // Visor (dark band with inner cyan glow)
    ctx.fillStyle = visor;
    ctx.fillRect(-7, headCY - 0.5, 14, 3);
    // Visor cyan highlight
    ctx.fillStyle = visorLit;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-5, headCY + 0.2, 4, 1);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(1, headCY + 0.2, 5, 0.8);
    ctx.globalAlpha = 1;
    // Chin strap accent
    ctx.fillStyle = helmetDk;
    ctx.fillRect(-5, headCY + 5, 10, 1);

    // --- HAIR TUFT (small) ---
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(-3, headCY - 6.5, 5, 1.5);
  }


  // AABB resolve along X axis
  function resolveX(p, tiles) {
    for (const t of tiles) {
      if (!t.solid) continue;
      if (!PQ.aabb(p, t)) continue;
      if (p.vx > 0) p.x = t.x - p.w;
      else if (p.vx < 0) p.x = t.x + t.w;
      p.vx = 0;
    }
  }

  // AABB resolve along Y axis, sets onGround
  function resolveY(p, tiles) {
    for (const t of tiles) {
      if (!t.solid) continue;
      if (!PQ.aabb(p, t)) continue;
      if (p.vy > 0) {
        p.y = t.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsUsed = 0;            // reset air jumps on landing
      } else if (p.vy < 0) {
        p.y = t.y + t.h;
        p.vy = 0;
      }
    }
  }

  PQ.Player = Player;
  PQ.POWER_DEFAULTS = POWER_DEFAULTS;
  PQ.PENALTY_DEFAULTS = PENALTY_DEFAULTS;
  PQ.BASE = BASE;
})();
