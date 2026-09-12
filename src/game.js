// ============================================================================
// game.js — the orchestrator
// State machine: TITLE → INTRO → PLAY ↔ QUESTION ↔ PAUSE → (LEVEL_OUTRO)
//   → (next level) … → END (grade report) or GAME_OVER
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // ---- Canvas setup -------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let viewW = 1280, viewH = 720;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    // Target aspect 16:9. Letterbox gracefully.
    const aspect = 16 / 9;
    if (w / h > aspect) {
      viewH = h;
      viewW = Math.floor(h * aspect);
    } else {
      viewW = w;
      viewH = Math.floor(w / aspect);
    }
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
    canvas.style.left = ((w - viewW) / 2) + 'px';
    canvas.style.top = ((h - viewH) / 2) + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Game state ---------------------------------------------------------
  const STATES = {
    TITLE: 'TITLE',
    INTRO: 'INTRO',
    PLAY:  'PLAY',
    QUESTION: 'QUESTION',
    PAUSE: 'PAUSE',
    DEATH: 'DEATH',
    LEVEL_DONE: 'LEVEL_DONE',
    END:   'END',
    GAME_OVER: 'GAME_OVER'
  };
  let state = STATES.TITLE;

  const game = {
    levelIdx: 0,
    level: null,
    player: null,
    camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeX: 0, shakeY: 0 },
    particles: new PQ.ParticleSystem(),
    bgParticles: new PQ.ParticleSystem(),
    lives: 3,
    packets: 0,
    score: 0,
    correct: 0,
    totalAnswered: 0,
    topicBreakdown: { PHISHING: {c:0,t:0}, PASSWORD:{c:0,t:0}, MALWARE:{c:0,t:0}, PRIVACY:{c:0,t:0}, RANSOMWARE:{c:0,t:0} },
    runStartMs: 0,
    levelsComplete: 0,
    difficulty: 'INTERMEDIATE',
    // Power-up / penalty rotation state — advance through the lists in a
    // fixed cycle so each answer demos a *different* effect. Shuffled once
    // per run so the first pick isn't predictable.
    powerOrder:  [],
    powerIdx:    0,
    penaltyOrder:[],
    penaltyIdx:  0,
    // Transient
    deathT: 0,
    levelDoneT: 0,
    bgTime: 0,
    // Ransomware Vault hard countdown — 60 s; reaching 0 triggers game over.
    // Reset on each loadLevel() call. Only ticks when state === PLAY.
    ransomTimerActive: false,
    ransomTimerSec: 0,
    ransomTimerLimit: 60
  };
  PQ.game = game;

  // ---- Event bus wiring ---------------------------------------------------
  PQ.bus.on('trail', (p) => {
    game.particles.emit(p.x, p.y, {
      vx: p.vx, vy: -40 + PQ.rand(-20, 20),
      size: 4, sizeEnd: 0, life: 0.45,
      color: p.color, blend: 'lighter', glow: 6, shape: 'circle'
    });
  });
  PQ.bus.on('jump', (p) => {
    // small dust ring on jump — reduced from 10 → 5
    game.particles.burst(p.cx, p.y + p.h, 5, (i) => ({
      vx: Math.cos(i / 5 * Math.PI) * 120 * (Math.random() - 0.5),
      vy: -PQ.rand(20, 60),
      size: PQ.rand(3, 6), sizeEnd: 0, life: 0.3,
      color: '#9bd7ff', blend: 'lighter'
    }));
  });
  PQ.bus.on('shieldBreak', (p) => {
    game.particles.burst(p.cx, p.cy, 18, () => ({
      vx: PQ.rand(-300, 300),
      vy: PQ.rand(-300, 200),
      ay: 600,
      size: PQ.rand(2, 5), sizeEnd: 0, life: 0.7,
      color: '#6bf0ff', colorEnd: '#ffffff',
      blend: 'lighter'
    }));
    PQ.fx.flash('rgba(107,240,255,0.25)', 260);
    PQ.fx.add(0.35);
  });

  // ---- State transitions --------------------------------------------------
  function startGame() {
    // Read whichever difficulty button is active on the title screen.
    const activeDiff = document.querySelector('.diff-btn.is-active');
    game.difficulty = (activeDiff && activeDiff.dataset.diff) || 'INTERMEDIATE';
    game.levelIdx = 0;
    game.lives = 3;
    game.packets = 0;
    game.score = 0;
    game.correct = 0;
    game.totalAnswered = 0;
    game.levelsComplete = 0;
    game.topicBreakdown = { PHISHING: {c:0,t:0}, PASSWORD:{c:0,t:0}, MALWARE:{c:0,t:0}, PRIVACY:{c:0,t:0}, RANSOMWARE:{c:0,t:0} };
    // Shuffle rotation orders once per run so the sequence varies run-to-run
    // but every unique effect is demoed once before any repeats.
    game.powerOrder   = PQ.shuffle(['SHIELD', 'EXTRA_LIFE', 'INVINCIBLE']);
    game.powerIdx     = 0;
    game.penaltyOrder = PQ.shuffle(['SLOW', 'SPAWN', 'OVERFLOW']);
    game.penaltyIdx   = 0;
    game.runStartMs = performance.now();
    loadLevel(1);
  }

  function loadLevel(idx) {
    const lv = PQ.buildLevel(idx);
    if (!lv) return endGame(true);
    lv.totalCoins = lv.packets.length;        // for "all collected → +1 life"
    lv.coinsCollected = 0;
    lv.lifeGranted = false;
    game.levelIdx = idx;
    game.level = lv;
    // Ransomware Vault — start the 60-second doomsday timer fresh.
    if (lv.layer === 'RANSOMWARE') {
      game.ransomTimerActive = true;
      game.ransomTimerSec = game.ransomTimerLimit;   // 60s
    } else {
      game.ransomTimerActive = false;
      game.ransomTimerSec = 0;
    }
    game.player = new PQ.Player(lv.playerStart.x, lv.playerStart.y);
    game.camera.x = 0; game.camera.y = 0;
    game.camera.targetX = 0; game.camera.targetY = 0;
    game.particles.clear();

    PQ.UI.hideAll();
    PQ.UI.showHUD();
    PQ.UI.setStackLayer(lv.layer);  // highlight this level's layer in the sidebar
    syncHUD();
    state = STATES.INTRO;
    PQ.UI.showLevelIntro(lv, () => {
      state = STATES.PLAY;
      PQ.music.start(lv.layer);
    });
  }

  function endGame(won) {
    state = STATES.END;
    PQ.music.stop();
    PQ.UI.hideHUD();
    const runTimeSec = (performance.now() - game.runStartMs) / 1000;
    PQ.UI.showEndScreen({
      correct: game.correct,
      totalAnswered: game.totalAnswered,
      packets: game.packets,
      levelsComplete: game.levelsComplete,
      lives: game.lives,
      score: game.score,
      runTimeSec,
      difficulty: game.difficulty,
      topicBreakdown: game.topicBreakdown
    });
  }

  function gameOver() {
    state = STATES.GAME_OVER;
    game.ransomTimerActive = false;
    PQ.music.stop();
    PQ.UI.hideHUD();
    PQ.UI.show('gameover-screen');
    PQ.sfx.play('die');
  }

  // "Escape the Matrix" — jump past this level. On the final level go to grades.
  function skipLevel() {
    PQ.UI.hide('pause-screen');
    PQ.music.stop();
    // Award a modest bonus so it doesn't screw up scoring completely
    game.levelsComplete++;
    game.score += 250;
    PQ.sfx.play('levelDone');
    PQ.fx.flash('rgba(185, 255, 107, 0.35)', 500);
    if (game.levelIdx >= PQ.LEVEL_COUNT) {
      endGame(true);
    } else {
      loadLevel(game.levelIdx + 1);
    }
  }

  function respawn() {
    // Respawn at start of level after brief delay; costs one life.
    const lv = game.level;
    game.player = new PQ.Player(lv.playerStart.x, lv.playerStart.y);
    game.camera.x = 0; game.camera.y = 0;
    PQ.fx.flash('rgba(107,240,255,0.15)', 300);
    state = STATES.PLAY;
  }

  function syncHUD() {
    PQ.UI.updateHUD({
      lives: game.lives,
      packets: game.packets,
      score: game.score,
      levelIdx: game.levelIdx,
      levelName: game.level ? game.level.name.replace(' LAYER','') : '',
      correct: game.correct,
      totalAnswered: game.totalAnswered,
      power: game.player ? game.player.power : null
    });
  }

  // ---- Question flow ------------------------------------------------------
  let activeQuestionBlock = null;

  async function triggerQuestion(block) {
    if (block.used) return;
    if (state !== STATES.PLAY) return;
    block.used = true;
    activeQuestionBlock = block;
    state = STATES.QUESTION;
    PQ.fx.setTimeScale(0.0);    // freeze gameplay during question
    PQ.music.stop();

    // Route based on block.kind:
    //   'minigame' → level-specific interactive mini-game
    //   'scenario' → Stop & Think real-world card
    //   'question' (default) → Multiple-choice cyber question
    let result;
    if (block.kind === 'minigame') {
      const layer = game.level.layer;
      if (layer === 'PHISHING' && PQ.UI.runPhishingMiniGame && PQ.getEmailForBlock) {
        result = await PQ.UI.runPhishingMiniGame(PQ.getEmailForBlock(block.index));
      } else if (layer === 'PASSWORD' && PQ.UI.runPasswordMiniGame) {
        result = await PQ.UI.runPasswordMiniGame();
      } else if (layer === 'MALWARE' && PQ.UI.runMalwareMiniGame) {
        result = await PQ.UI.runMalwareMiniGame();
      } else if (layer === 'PRIVACY' && PQ.UI.runPrivacyMiniGame) {
        result = await PQ.UI.runPrivacyMiniGame();
      } else if (layer === 'RANSOMWARE' && PQ.UI.runRansomwareMiniGame) {
        result = await PQ.UI.runRansomwareMiniGame();
      } else {
        // Fallback: regular MCQ
        const q = PQ.getQuestionForBlock(layer, block.index, game.difficulty);
        result = await PQ.UI.askQuestion(q);
      }
    } else if (block.kind === 'scenario' && PQ.UI.askScenario && PQ.getScenarioForBlock) {
      const sc = PQ.getScenarioForBlock(block.index);
      result = await PQ.UI.askScenario(sc);
    } else {
      const q = PQ.getQuestionForBlock(game.level.layer, block.index, game.difficulty);
      result = await PQ.UI.askQuestion(q);
    }
    await applyAnswer(result);
  }

  async function applyAnswer({ correct, chosen, question }) {
    game.totalAnswered++;
    const tb = game.topicBreakdown[question.layer];
    if (tb) tb.t++;

    let feedbackPromise;
    if (correct) {
      game.correct++;
      tb && tb.c++;
      game.score += 500;
      // Rotate through the shuffled power order so each correct answer in a
      // demo shows a *different* power-up before any repeats.
      const powers = game.powerOrder.length ? game.powerOrder
                   : ['SHIELD', 'EXTRA_LIFE', 'INVINCIBLE'];
      const pick = powers[game.powerIdx % powers.length];
      game.powerIdx++;
      game.player.grant(pick);
      const def = PQ.POWER_DEFAULTS[pick];
      PQ.sfx.play('correct');
      PQ.sfx.play('powerup');
      feedbackPromise = PQ.UI.showFeedback({
        correct: true,
        badgeLabel: 'POWER-UP EARNED',
        badgeName:  def.label,
        badgeEffect:def.effect,
        explain:    question.why
      });
    } else {
      game.score = Math.max(0, game.score - 100);
      // Penalties rotate SLOW → SPAWN → OVERFLOW (shuffled once per run) so
      // each wrong answer demos a different punishment before any repeats.
      const penalties = game.penaltyOrder.length ? game.penaltyOrder : ['SLOW', 'SPAWN', 'OVERFLOW'];
      const pick = penalties[game.penaltyIdx % penalties.length];
      game.penaltyIdx++;
      const correctText = question.a[question.correct];
      PQ.sfx.play('wrong');
      if (pick === 'SPAWN') {
        // Spawn 7 BugWalkers in a row off-screen right of the player.
        for (let i = 0; i < 7; i++) {
          const e = new PQ.BugWalker(game.player.x + 340 + i * 70, 0, { dir: -1 });
          e.vy = 0; e.y = 120;
          game.level.enemies.push(e);
        }
      }
      if (pick === 'SLOW' || pick === 'OVERFLOW') game.player.afflict(pick);
      const pdef = PQ.PENALTY_DEFAULTS[pick];
      feedbackPromise = PQ.UI.showFeedback({
        correct: false,
        badgeLabel: 'PENALTY',
        badgeName:  pdef.label,
        badgeEffect:pdef.effect,
        correctAnswer: correctText,
        explain: question.why
      });
    }

    // Wait for the user to hit CONTINUE on the feedback panel before resuming.
    await feedbackPromise;

    activeQuestionBlock = null;
    state = STATES.PLAY;
    PQ.fx.setTimeScale(1.0);
    PQ.music.start(game.level.layer);
    syncHUD();
    if (game.lives <= 0) gameOver();
  }

  // ---- Update -------------------------------------------------------------
  let lastMs = performance.now();

  function loop(nowMs) {
    const rawDt = Math.min(0.033, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    PQ.fx.updateTimeScale();
    const ts = PQ.fx.currentTimeScale();
    const dt = rawDt * ts;

    game.bgTime += rawDt;

    update(dt, rawDt);
    render();

    PQ.input.endFrame();
    requestAnimationFrame(loop);
  }

  function update(dt, rawDt) {
    PQ.fx.update(rawDt);

    // Global mute toggle (works from any state)
    if (PQ.input.wasPressed('mute')) {
      const enabled = !PQ.sfx.isEnabled();
      PQ.sfx.setEnabled(enabled);
      PQ.music.setEnabled(enabled);
      if (enabled && game.level && state === STATES.PLAY) {
        PQ.music.start(game.level.layer);
      } else {
        PQ.music.stop();
      }
    }

    if (state === STATES.PLAY) {
      // Pause check
      if (PQ.input.wasPressed('pause')) {
        state = STATES.PAUSE;
        PQ.music.stop();
        PQ.UI.show('pause-screen');
        return;
      }

      // Ransomware Vault — hard 60-second countdown. Tick only while PLAYing
      // so the timer doesn't burn down during questions, scenarios, or pause.
      if (game.ransomTimerActive) {
        game.ransomTimerSec -= rawDt;
        if (game.ransomTimerSec <= 0) {
          game.ransomTimerSec = 0;
          game.ransomTimerActive = false;
          gameOver();
          return;
        }
      }

      const lv = game.level;
      const p = game.player;
      p.update(dt, lv.tiles, PQ.input);
      game.particles.update(rawDt);

      // Camera cull bounds — only update entities near the visible area
      const cullL = game.camera.x - 400;
      const cullR = game.camera.x + viewW + 400;

      // Enemies — only tick those close enough to matter
      for (const e of lv.enemies) {
        if (e.x + e.w < cullL || e.x > cullR) continue;
        e.update(dt, { tiles: lv.tiles, player: p });
      }
      lv.enemies = lv.enemies.filter(e => !e.dead);

      // Packet magnet
      const magnet = p.hasPower('MAGNET');

      // Packet pickup
      for (const pk of lv.packets) {
        if (pk.x + pk.w < cullL || pk.x > cullR) continue;
        const dx = (pk.x + 9) - p.cx;
        const dy = (pk.y + 9) - p.cy;
        if (magnet) {
          const d = Math.hypot(dx, dy);
          if (d < 260) {
            pk.x -= (dx / Math.max(1,d)) * 360 * dt;
            pk.y -= (dy / Math.max(1,d)) * 360 * dt;
            pk.baseY = pk.y;
          }
        }
        pk.update(dt, { tiles: lv.tiles, player: p });
      }
      lv.packets = lv.packets.filter(pk => {
        if (PQ.aabb(pk, p)) {
          game.packets++;
          game.score += 10;
          lv.coinsCollected++;
          // floating "+10" text
          game.particles.add({
            x: pk.x + 11, y: pk.y + 6,
            vx: 0, vy: -60, ay: 0,
            size: 16, sizeEnd: 16, life: 0.9,
            color: '#fff7c2', blend: 'source-over',
            shape: 'text', text: '+10'
          });
          // sparkle
          game.particles.burst(pk.x + 11, pk.y + 11, 5, () => ({
            vx: PQ.rand(-140, 140), vy: PQ.rand(-200, -30), ay: 400,
            size: PQ.rand(2, 4), sizeEnd: 0, life: 0.55,
            color: '#ffd45a', blend: 'lighter', shape: 'spark'
          }));
          PQ.sfx.play('coin');
          // All-collected bonus: +1 life, fanfare burst
          if (!lv.lifeGranted && lv.coinsCollected >= lv.totalCoins) {
            lv.lifeGranted = true;
            game.lives = Math.min(9, game.lives + 1);
            game.particles.add({
              x: p.x + p.w/2, y: p.y - 10,
              vx: 0, vy: -50, ay: 0,
              size: 22, sizeEnd: 22, life: 1.6,
              color: '#5eff9a', blend: 'source-over',
              shape: 'text', text: '+1 LIFE — ALL COINS!'
            });
            game.particles.burst(p.x + p.w/2, p.y, 22, () => ({
              vx: PQ.rand(-260, 260), vy: PQ.rand(-300, -60), ay: 380,
              size: PQ.rand(2, 5), sizeEnd: 0, life: 0.8,
              color: '#5eff9a', blend: 'lighter', shape: 'spark'
            }));
            try { PQ.sfx.play('powerup'); } catch (e) {}
            syncHUD();
          }
          return false;
        }
        return true;
      });

      // Question blocks — head-on collision
      for (const qb of lv.questions) {
        qb.update(dt);
        if (!qb.used && PQ.aabb(qb, p)) {
          // Pop animation: small burst (no blur), then trigger question modal
          game.particles.burst(qb.x + qb.w/2, qb.y + qb.h/2, 12, () => ({
            vx: PQ.rand(-220, 220), vy: PQ.rand(-260, -40),
            size: PQ.rand(2, 5), sizeEnd: 0, life: 0.6,
            color: '#6bf0ff', colorEnd: '#ff6bd6', blend: 'lighter'
          }));
          PQ.fx.add(0.2);
          triggerQuestion(qb);
          break;
        }
      }

      // Spike hazards
      for (const sp of lv.hazards) {
        if (PQ.aabb(sp, p)) {
          const result = p.takeHit(false);
          if (result === 'hurt') {
            PQ.sfx.play('hurt');
            game.lives = Math.max(0, game.lives - 1);
            PQ.fx.add(0.5);
          }
        }
      }

      // Enemy collision
      for (const e of lv.enemies) {
        if (e.dead) continue;
        if (!PQ.aabb(e, p)) continue;

        // Stomp check: player coming down + above enemy's midline
        const playerBottom = p.y + p.h;
        const eMid = e.y + e.h * 0.55;
        const stomping = p.vy > 0 && playerBottom < e.y + e.h * 0.55 + 6;

        if (stomping && typeof e.stomp === 'function' && e.stomp() !== false) {
          p.vy = -480;  // bounce
          game.score += 150;
          // reduced from 20 → 10, no glow halo (much cheaper on stomps)
          game.particles.burst(e.x + e.w/2, e.y + e.h/2, 10, () => ({
            vx: PQ.rand(-260, 260), vy: PQ.rand(-260, 40),
            ay: 500, size: PQ.rand(2, 4), sizeEnd: 0, life: 0.5,
            color: '#ff6bd6', blend: 'lighter'
          }));
          PQ.sfx.play('hit');
          PQ.fx.add(0.15);
        } else {
          const result = p.takeHit(false);
          if (result === 'hurt') {
            PQ.sfx.play('hurt');
            game.lives = Math.max(0, game.lives - 1);
            PQ.fx.add(0.5);
          }
        }
      }

      // Portal
      if (PQ.aabb(lv.portal, p)) {
        completeLevel();
        return;
      }

      // Death by falling off the world
      if (!p.alive) {
        PQ.sfx.play('die');
        PQ.fx.add(0.9);
        game.lives = Math.max(0, game.lives - 1);
        if (game.lives <= 0) { gameOver(); return; }
        state = STATES.DEATH;
        game.deathT = 0;
        PQ.music.stop();
      } else if (game.lives <= 0) {
        gameOver();
        return;
      }

      // Camera: horizontal follow only, centered on the player. No facing
      // look-ahead — that was causing the camera to swing back and forth
      // across the player every time direction flipped, which felt dizzying.
      game.camera.targetX = PQ.clamp(p.cx - viewW / 2, 0, lv.width - viewW);
      game.camera.targetY = 0;
      game.camera.x += (game.camera.targetX - game.camera.x) * Math.min(1, dt * 8);
      game.camera.y = 0;

      syncHUD();

    } else if (state === STATES.QUESTION) {
      // Question modal handled entirely in UI; particles still animate slowly
      game.particles.update(rawDt * 0.3);
      for (const pk of (game.level ? game.level.packets : [])) pk.animT += rawDt * 0.2;
    } else if (state === STATES.PAUSE) {
      // Handle resume via ESC too
      if (PQ.input.wasPressed('pause')) {
        PQ.UI.hide('pause-screen');
        state = STATES.PLAY;
        PQ.music.start(game.level.layer);
      }
    } else if (state === STATES.INTRO) {
      // wait for intro to dismiss
    } else if (state === STATES.LEVEL_DONE) {
      game.levelDoneT += rawDt;
      game.particles.update(rawDt);
      // Final level gets a longer hold so the "Generating Cyber Security
      // Report…" loading animation has time to play and feels earned.
      const isFinal = game.levelIdx >= PQ.LEVEL_COUNT;
      const wait = isFinal ? 3.5 : 2.0;
      if (game.levelDoneT > wait) {
        game.levelDoneT = 0;
        if (isFinal) endGame(true);
        else loadLevel(game.levelIdx + 1);
      }
    } else if (state === STATES.DEATH) {
      game.deathT += rawDt;
      // Keep player's death fall animating
      if (game.player) {
        game.player.vy += 2100 * rawDt * 0.7;
        game.player.y += game.player.vy * rawDt;
        game.player.animT += rawDt;
      }
      game.particles.update(rawDt);
      if (game.deathT > 0.9) {
        game.deathT = 0;
        respawn();
      }
    }
  }

  function completeLevel() {
    if (state === STATES.LEVEL_DONE) return;
    state = STATES.LEVEL_DONE;
    game.levelsComplete++;
    game.score += 1000;
    // Stop the Ransomware Vault doomsday clock if it was running.
    game.ransomTimerActive = false;
    PQ.sfx.play('levelDone');
    PQ.confetti(70);
    PQ.fx.flash('rgba(107,240,255,0.3)', 600);
    PQ.music.stop();
    // Let player see a brief celebration + stats
    game.levelDoneT = 0;
  }

  // ---- Render -------------------------------------------------------------
  function render() {
    // Clear
    ctx.clearRect(0, 0, viewW, viewH);

    if (state === STATES.TITLE) {
      drawTitleBackground();
      return;
    }

    if (!game.level) return;

    const shake = PQ.fx.offset();
    ctx.save();
    ctx.translate(-game.camera.x + shake.x, -game.camera.y + shake.y);

    drawBackground(game.level);
    drawWorld(game.level);
    drawEntities(game.level);
    drawPlayer();
    drawForegroundFog(game.level);

    ctx.restore();

    // Screen-space overlays (aim reticle, level intro banners, etc.)
    if (state === STATES.LEVEL_DONE && game.levelsComplete > 0) {
      drawLevelCompleteBanner();
    }
  }

  function drawTitleBackground() {
    // Animated network topology
    const t = game.bgTime;
    ctx.save();

    // Gradient
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#101a3a');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    // Grid of nodes + edges
    const cols = 10, rows = 6;
    const margin = 80;
    const sx = margin, sy = margin;
    const dx = (viewW - 2 * margin) / (cols - 1);
    const dy = (viewH - 2 * margin) / (rows - 1);
    const nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = sx + c * dx + Math.sin(t * 0.7 + r + c * 0.3) * 8;
        const y = sy + r * dy + Math.cos(t * 0.6 + c + r * 0.5) * 8;
        nodes.push({ x, y });
      }
    }
    // edges (sparse)
    ctx.strokeStyle = 'rgba(107,240,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 170) {
          ctx.globalAlpha = (1 - d / 170) * 0.55;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Pulse packets along some edges
    const pulses = 24;
    for (let i = 0; i < pulses; i++) {
      const seed = i * 17.31;
      const k1 = Math.floor(((t * 0.2 + seed) * 3) % nodes.length);
      const k2 = (k1 + 1 + (i % 5)) % nodes.length;
      const a = nodes[k1], b = nodes[k2];
      const phase = (t * 0.7 + i * 0.3) % 1;
      const x = a.x + (b.x - a.x) * phase;
      const y = a.y + (b.y - a.y) * phase;
      ctx.fillStyle = i % 2 ? '#6bf0ff' : '#ff6bd6';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Nodes
    for (const n of nodes) {
      const glow = 0.4 + 0.3 * Math.sin(t * 2 + n.x * 0.01 + n.y * 0.01);
      ctx.fillStyle = 'rgba(107,240,255,' + (0.35 + glow * 0.25) + ')';
      ctx.shadowColor = '#6bf0ff'; ctx.shadowBlur = 10 + glow * 6;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Cyber-tip ticker — replaces the old Wireshark capture log. A rotating
  // band of plain-language safety tips, themed by domain, that scrolls right-
  // to-left at the top of every level. Reinforces the lesson while playing.
  const CYBER_TIPS = [
    '🎣 PHISHING · Real companies never ask for your password through a link.',
    '🎣 PHISHING · "URGENT: act now!" pressure is a phishing red flag — slow down.',
    '🎣 PHISHING · Always check the sender domain. amaz0n with a zero is NOT amazon.',
    '🔒 PASSWORDS · Never share your password — even with friends.',
    '🔒 PASSWORDS · Use a different password for every account. One leak shouldn\'t hack them all.',
    '🔒 PASSWORDS · Length beats complexity. 12+ characters is the floor.',
    '🔒 PASSWORDS · Turn on 2FA on every account that offers it.',
    '🦠 MALWARE · "Free Robux" downloads are always malware. There is no real generator.',
    '🦠 MALWARE · Keep your phone, computer, and browser updated. Updates patch security holes.',
    '🦠 MALWARE · Don\'t plug in random USB sticks — they can install malware automatically.',
    '👁 PRIVACY · Strangers online don\'t need your school name, address, or photos.',
    '👁 PRIVACY · A school-uniform selfie tells strangers exactly where to find you weekdays.',
    '👁 PRIVACY · Once you post something online, it\'s very hard to take back.',
    '💾 RANSOMWARE · NEVER pay a ransom. Half of payers never get their files back.',
    '💾 RANSOMWARE · Backups are your best protection — ransomware loses if you can restore.',
    '💾 RANSOMWARE · Tell a trusted adult immediately if a screen demands money.'
  ];
  // Each line takes CROSS_DURATION seconds to sweep the screen, and a new
  // line starts every START_INTERVAL seconds. With 5 < 9, usually two lines
  // are visible at once — one finishing its exit on the left while the next
  // enters on the right. Gives a continuous capture feel with clear spacing
  // between entries (~1200 px gap).
  const TICKER_START_INTERVAL = 5;
  const TICKER_CROSS_DURATION = 9;

  function drawWiresharkTicker(level) {
    const cam = game.camera;
    const t = game.bgTime;
    const y = cam.y + Math.floor(viewH * 0.18);

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#000';
    ctx.fillRect(cam.x, y - 16, viewW, 32);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = level.theme.decorFg;
    ctx.fillRect(cam.x, y - 16, 4, 32);

    const kMin = Math.ceil((t - TICKER_CROSS_DURATION) / TICKER_START_INTERVAL);
    const kMax = Math.floor(t / TICKER_START_INTERVAL);

    ctx.font = '700 14px "SF Pro Text", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.97;

    for (let k = kMin; k <= kMax; k++) {
      const phase = (t - k * TICKER_START_INTERVAL) / TICKER_CROSS_DURATION;
      const idx   = ((k % CYBER_TIPS.length) + CYBER_TIPS.length) % CYBER_TIPS.length;
      const line  = CYBER_TIPS[idx];
      const textX = cam.x + viewW - (phase * (viewW + 900)) + 20;
      ctx.fillText(line, textX, y);
    }
    ctx.restore();
  }

  function drawBackground(level) {
    const theme = level.theme;
    const cam = game.camera;
    // Sky gradient (covers entire world view)
    const g = ctx.createLinearGradient(0, cam.y, 0, cam.y + viewH);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(0.6, theme.sky[1]);
    g.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(cam.x, cam.y, viewW, viewH);

    // Far parallax stars
    const t = game.bgTime;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 137 + 120) % 1280) + Math.sin(t + i) * 0.3;
      const sy = ((i * 71 + 40) % 420);
      const px = cam.x * 0.15 + sx; // slow parallax
      const py = cam.y * 0.1 + sy;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.globalAlpha = 0.25 + tw * 0.35;
      ctx.fillRect(px, py, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Per-theme backdrop decorations — Cyber Quest theming first, with the
    // older Cyber Quest renderers kept as legacy fallbacks.
    switch (theme.bgStyle) {
      case 'phishingLake':   drawBgPhishingLake(level); break;
      case 'passwordCastle': drawBgPasswordCastle(level); break;
      case 'malwareForest':  drawBgMalwareForest(level); break;
      case 'privacyPlaza':   drawBgPrivacyPlaza(level); break;
      case 'ransomwareVault':drawBgRansomwareVault(level); break;
      case 'wires':    drawBgWires(level); break;
      case 'pcb':      drawBgPCB(level); break;
      case 'clouds':   drawBgClouds(level); break;
      case 'tunnel':   drawBgTunnel(level); break;
      case 'cityscape':drawBgCityscape(level); break;
    }

    // Universal tshark ticker on top of every theme's backdrop.
    drawWiresharkTicker(level);
  }

  // Stable per-cable bit patterns — random once, then reused forever so
  // the stream doesn't flicker when re-rendered each frame.
  const CABLE_BITS = [];
  function cableBits(i) {
    if (!CABLE_BITS[i]) {
      let s = '';
      for (let j = 0; j < 512; j++) s += Math.random() < 0.5 ? '0' : '1';
      CABLE_BITS[i] = s;
    }
    return CABLE_BITS[i];
  }

  function drawBgWires(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // Four sine cables with bit streams flowing along each curve.
    // The bits are literally "bits on the wire" — Physical-layer metaphor.
    const BIT_SPACING = 46;       // px between bit characters along a cable
    const BIT_COLORS  = ['#ffd15a', '#ff9e48', '#ffb65c', '#ff8a3a']; // amber variations

    for (let i = 0; i < 4; i++) {
      const baseY = 150 + i * 110;

      // Cable (the sine wave itself)
      ctx.globalAlpha = 0.32 - i * 0.04;
      ctx.strokeStyle = level.theme.decorFg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < viewW + 200; x += 10) {
        const wx = cam.x + x;
        const yy = baseY + Math.sin((wx + t * 120) * 0.006 + i) * 22;
        if (x === 0) ctx.moveTo(cam.x + x, yy);
        else ctx.lineTo(cam.x + x, yy);
      }
      ctx.stroke();

      // Bit glyphs evenly spaced along the cable, drifting right slowly.
      // Speeds vary slightly per cable so they don't all move in lockstep.
      const bits    = cableBits(i);
      const speed   = 72 + i * 18;         // 72 / 90 / 108 / 126 px/sec — brisk, data-flowing vibe
      const pan     = t * speed;
      const startK  = Math.floor(pan / BIT_SPACING);
      const pxOff   = pan - startK * BIT_SPACING;

      ctx.font = '700 12px "SF Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const slots = Math.ceil(viewW / BIT_SPACING) + 2;
      for (let slot = -1; slot < slots; slot++) {
        const screenX = slot * BIT_SPACING + pxOff;
        const wx = cam.x + screenX;
        const yy = baseY + Math.sin((wx + t * 120) * 0.006 + i) * 22;
        const ch = bits[(startK + slot + bits.length) % bits.length];

        // Dark halo behind each character — guarantees contrast on any bg
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = '#000';
        ctx.fillText(ch, wx, yy + 1);
        ctx.fillText(ch, wx + 1, yy);
        // Main bit
        ctx.globalAlpha = 0.92 - i * 0.1;
        ctx.fillStyle = BIT_COLORS[i];
        ctx.fillText(ch, wx, yy);
      }
      ctx.textAlign = 'left';   // reset for other drawers
    }

    ctx.restore();
  }

  // Link-Layer backdrop — you're looking at the inside of an Ethernet switch.
  //   • subtle grid of PCB contact pads all across the board
  //   • four bright bus traces running horizontally
  //   • each trace carries a scrolling MAC-address pair (src → dst)
  //   • small frame dots travel along the traces at different phases
  const PCB_MAC_PAIRS = [
    '0A:1F:3C:AA:BB:CC   →   7B:4E:9D:11:22:33',
    'F0:0D:12:34:56:78   →   BA:BE:AB:CD:EF:01',
    '3C:55:B1:DE:AD:BE   →   88:C0:D1:FA:CE:77',
    'AA:BB:CC:11:22:33   →   44:55:66:77:88:99',
    'C4:D7:8A:02:99:FE   →   01:23:45:AB:CD:EF'
  ];

  function drawBgPCB(level) {
    const cam = game.camera;
    const t   = game.bgTime;
    const color = level.theme.decorFg;
    ctx.save();

    // 1. PCB contact-pad grid — subtle board substrate
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    const padSpacing = 88;
    const xStart = Math.floor(cam.x / padSpacing) * padSpacing;
    for (let x = xStart - padSpacing; x < xStart + viewW + padSpacing; x += padSpacing) {
      for (let yi = 0; yi < 6; yi++) {
        const y = 70 + yi * 100;
        ctx.fillRect(x, y, 3, 3);
        // Short perpendicular lead on every other pad for "solder joint" look
        if (yi % 2 === 0) ctx.fillRect(x + 1, y + 3, 1, 4);
      }
    }

    // 2. Horizontal bus traces + scrolling MAC address pairs
    const lanes = [
      { y: 210, speed: 42, pair: PCB_MAC_PAIRS[0] },
      { y: 320, speed: 56, pair: PCB_MAC_PAIRS[1] },
      { y: 440, speed: 48, pair: PCB_MAC_PAIRS[2] },
      { y: 560, speed: 38, pair: PCB_MAC_PAIRS[3] }
    ];
    ctx.font = '700 12px "SF Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li];

      // The trace — a bright thin green line running the whole viewport
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cam.x - 50,        lane.y);
      ctx.lineTo(cam.x + viewW + 50, lane.y);
      ctx.stroke();

      // Solder joints every 110 px along the trace
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      const jx0 = Math.floor(cam.x / 110) * 110;
      for (let jx = jx0 - 110; jx < jx0 + viewW + 110; jx += 110) {
        ctx.beginPath();
        ctx.arc(jx, lane.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // A single traveling frame dot — small bright pulse riding the trace
      const cycle    = (viewW + 300) / lane.speed;
      const framePh  = (t % cycle) / cycle;
      const frameX   = cam.x + framePh * (viewW + 300) - 150;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#eaffd4';
      ctx.beginPath();
      ctx.arc(frameX, lane.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Faint tail behind the dot
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(frameX - 26, lane.y - 1, 22, 2);

      // Scrolling MAC address pair — slow, readable
      const totalSpan = viewW + 700;
      const macSpeed  = 28 + li * 2;  // 28..34 px/sec
      const macCycle  = totalSpan / macSpeed;
      const macPhase  = (t % macCycle) / macCycle;
      const textX     = cam.x + viewW + 40 - macPhase * totalSpan;
      const textW     = ctx.measureText(lane.pair).width;
      // Dark reader strip behind the MAC for contrast
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#000';
      ctx.fillRect(textX - 8, lane.y - 11, textW + 16, 22);
      // MAC text
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#eaffd4';
      ctx.fillText(lane.pair, textX, lane.y);
    }

    ctx.restore();
  }

  // Network Layer backdrop — a mini routing mesh, viewport-anchored so the
  // full graph stays on screen as the player walks across the level.
  // Five routers with IP + CIDR labels, six edges, packets carrying TTL
  // values that decrement along the path.
  const NW_ROUTERS = [
    { x: 180,  y: 210, ip: '10.0.0.1',    cidr: '10.0.0.0/8'    },
    { x: 420,  y: 160, ip: '192.168.1.1', cidr: '192.168.0.0/16'},
    { x: 680,  y: 260, ip: '8.8.8.8',     cidr: 'AS 15169'      },
    { x: 940,  y: 175, ip: '172.16.0.1',  cidr: '172.16.0.0/12' },
    { x: 1180, y: 230, ip: '1.1.1.1',     cidr: 'AS 13335'      }
  ];
  const NW_EDGES = [[0,1],[1,2],[0,3],[2,3],[2,4],[3,4]];

  function drawBgClouds(level) {
    const cam = game.camera;
    const t   = game.bgTime;
    const color = level.theme.decorFg;
    ctx.save();

    // 1. Edges first (behind nodes)
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    for (const [a, b] of NW_EDGES) {
      const ra = NW_ROUTERS[a], rb = NW_ROUTERS[b];
      ctx.beginPath();
      ctx.moveTo(cam.x + ra.x, ra.y);
      ctx.lineTo(cam.x + rb.x, rb.y);
      ctx.stroke();
    }

    // 2. Packets on each edge — two per edge, phases offset, TTL labeled.
    ctx.font = '700 10px "SF Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < NW_EDGES.length; i++) {
      const [a, b] = NW_EDGES[i];
      const ra = NW_ROUTERS[a], rb = NW_ROUTERS[b];
      const baseTTL = 64 - (i * 8);
      for (let j = 0; j < 2; j++) {
        const phase = ((t * 0.18 + i * 0.17 + j * 0.5) % 1);
        const x = cam.x + ra.x + (rb.x - ra.x) * phase;
        const y = ra.y + (rb.y - ra.y) * phase;
        // Packet dot (white on cyan edge)
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
        // TTL label — drops slightly as the packet progresses
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = color;
        const ttl = baseTTL - Math.floor(phase * 2);
        ctx.fillText('TTL=' + ttl, x + 6, y - 1);
      }
    }

    // 3. Router nodes on top of the edges
    for (const r of NW_ROUTERS) {
      const x = cam.x + r.x, y = r.y;
      // Soft pulse ring
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 11 + Math.sin(t * 1.8 + r.x * 0.01) * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      // Filled core
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      // IP label
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 11px "SF Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(r.ip, x, y + 26);
      // CIDR / AS below
      ctx.globalAlpha = 0.55;
      ctx.font = '600 9px "SF Mono", ui-monospace, monospace';
      ctx.fillText(r.cidr, x, y + 38);
    }
    ctx.textAlign = 'left';

    ctx.restore();
  }

  // Transport Layer backdrop — 3 horizontal lanes of TCP segment "pills"
  // sliding left with fields visible (flags + Seq/Ack). Reads like a
  // wire-format packet trace for the three-way handshake and teardown.
  const TCP_LANES = [
    {
      y: 205, speed: 68,
      pills: ['[SYN]  Seq=0', '[SYN, ACK]  Seq=0 Ack=1', '[ACK]  Seq=1 Ack=1']
    },
    {
      y: 345, speed: 82,
      pills: ['[PSH, ACK]  Len=150', '[ACK]  Seq=151', '[PSH, ACK]  Len=400']
    },
    {
      y: 490, speed: 62,
      pills: ['[FIN, ACK]  Seq=401', '[ACK]  Seq=153', '[FIN, ACK]  Seq=152']
    }
  ];

  function drawBgTunnel(level) {
    const cam = game.camera;
    const t   = game.bgTime;
    const color = level.theme.decorFg;
    ctx.save();

    // 1. Faint tunnel streaks (kept so the level still feels magenta-y)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const phase = (t * 0.15 + i * 0.13) % 1;
      const x = cam.x + phase * viewW;
      const y = 90 + ((i * 67) % (viewH - 140));
      ctx.globalAlpha = 0.08 * (1 - phase);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + 110, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // 2. TCP segment pills — rounded capsules with flag + seq/ack text
    ctx.font = '700 11px "SF Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';

    for (let li = 0; li < TCP_LANES.length; li++) {
      const lane = TCP_LANES[li];

      // Lane guideline
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cam.x, lane.y);
      ctx.lineTo(cam.x + viewW, lane.y);
      ctx.stroke();

      for (let j = 0; j < lane.pills.length; j++) {
        const totalSpan = viewW + 600;
        const cycle = totalSpan / lane.speed;
        // Offset phases so pills are evenly distributed across the lane
        const phase = (((t + j * cycle / lane.pills.length) % cycle) / cycle);
        const text = lane.pills[j];
        const textW = ctx.measureText(text).width;
        const padX = 10;
        const pillW = textW + padX * 2;
        const x = cam.x + viewW + 40 - phase * totalSpan;

        // Pill body (dark fill + theme-colored border)
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#1a0a1f';
        PQ.roundRect(ctx, x, lane.y - 12, pillW, 24, 12);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        PQ.roundRect(ctx, x, lane.y - 12, pillW, 24, 12);
        ctx.stroke();
        // Pill text
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#ffe5f7';
        ctx.fillText(text, x + padX, lane.y);
      }
    }

    ctx.restore();
  }

  // Application Layer backdrop — parallax cityscape (kept) + floating HTTP
  // request/response/DNS/TLS cards drifting across the sky. Literally shows
  // the protocols you teach at layer 7.
  const APP_CARDS = [
    { kind: 'req', text: 'GET /index.html HTTP/1.1' },
    { kind: 'res', text: 'HTTP/1.1  200 OK' },
    { kind: 'dns', text: 'DNS  A?  www.bu.edu' },
    { kind: 'tls', text: 'TLS 1.3  Client Hello' },
    { kind: 'req', text: 'GET /api/v1/users' },
    { kind: 'res', text: 'HTTP/1.1  404 Not Found' },
    { kind: 'dns', text: 'DNS  →  128.197.26.35' }
  ];

  function drawBgCityscape(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();
    // Two parallax layers of buildings
    for (let layer = 0; layer < 2; layer++) {
      const parallax = 0.25 + layer * 0.2;
      const alpha = 0.55 - layer * 0.15;
      const tint = layer === 0 ? '#2a1f56' : '#432a66';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tint;
      const startX = Math.floor((cam.x * parallax) / 80) * 80;
      for (let i = 0; i < 30; i++) {
        const wx = startX + i * 80 - cam.x * parallax + cam.x;
        const seed = (Math.floor(startX/80) + i) * 9301 + 49297;
        const rh = ((seed * 9301 + 49297) % 233280) / 233280;
        const h = 120 + rh * (layer ? 220 : 320);
        const y = cam.y + viewH - 60 - h;
        ctx.fillRect(wx, y, 70, h);
        // Windows
        ctx.fillStyle = layer === 0 ? '#ffd15a' : '#ff6bd6';
        for (let wi = 0; wi < 6; wi++) {
          for (let wj = 1; wj < Math.floor(h / 18); wj++) {
            const lit = (Math.sin(t * 0.8 + wi * 1.3 + wj * 0.7 + seed * 0.001) > 0.4);
            if (lit) {
              ctx.globalAlpha = 0.45 - layer * 0.1;
              ctx.fillRect(wx + 10 + wi * 10, y + wj * 18, 4, 8);
            }
          }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = tint;
      }
    }

    // Floating HTTP / DNS / TLS cards — drift across the sky slowly.
    ctx.font = '700 11px "SF Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const color = level.theme.decorFg;    // gold
    for (let i = 0; i < APP_CARDS.length; i++) {
      const card = APP_CARDS[i];
      const y = 190 + (i % 5) * 55;       // spread in the upper sky, above platforms
      const speed = 34 + (i % 3) * 12;    // slow drift
      const totalSpan = viewW + 520;
      const cycle = totalSpan / speed;
      const phase = (((t + i * cycle / APP_CARDS.length) % cycle) / cycle);
      const x = cam.x + viewW + 40 - phase * totalSpan;
      const w = ctx.measureText(card.text).width + 22;

      // Card body — dark fill + tier-colored border, with a small protocol
      // chip inside to the left (GET / RES / DNS / TLS)
      const kindLabel = card.kind.toUpperCase();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#1a1434';
      PQ.roundRect(ctx, x, y - 14, w + 40, 28, 8);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      PQ.roundRect(ctx, x, y - 14, w + 40, 28, 8);
      ctx.stroke();
      // Kind chip
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      PQ.roundRect(ctx, x + 6, y - 9, 34, 18, 4);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#2a2000';
      ctx.font = '900 10px "SF Mono", ui-monospace, monospace';
      ctx.fillText(kindLabel, x + 11, y);
      // Main text
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fffbe5';
      ctx.font = '700 11px "SF Mono", ui-monospace, monospace';
      ctx.fillText(card.text, x + 48, y);
    }

    ctx.restore();
  }

  // ==========================================================================
  // CYBER QUEST BACKDROPS — one per threat domain
  // Each one gets a unique visual identity tied to the real-world threat:
  //   PHISHING LAKE     → envelopes, @-symbols, dropping fishhooks
  //   PASSWORD CASTLE   → padlocks, keys, rotating combination dial
  //   MALWARE FOREST    → infected pixel-decay trees + popup ads
  //   PRIVACY PLAZA     → social-media profile cards + watching eyes
  //   RANSOMWARE VAULT  → filing cabinets + countdown + red haze
  // ==========================================================================

  function drawBgPhishingLake(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // Far water surface lines — wavy sine across the sky horizon
    ctx.strokeStyle = 'rgba(107,240,255,0.18)';
    ctx.lineWidth = 1.2;
    for (let row = 0; row < 4; row++) {
      const yBase = cam.y + 180 + row * 50;
      ctx.globalAlpha = 0.18 - row * 0.03;
      ctx.beginPath();
      for (let x = cam.x; x < cam.x + viewW; x += 16) {
        const wy = yBase + Math.sin((x + t * 80) * 0.012 + row) * 6;
        if (x === cam.x) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // *** Fake login-page popups in the back — heavily faded for atmosphere
    // only, do not interfere with gameplay reads ***
    const fakeLogins = [
      { brand: 'PayPa1', tint: '#0079c1' },
      { brand: 'app1e id', tint: '#aaa'    },
      { brand: 'NetfIix', tint: '#e50914' },
      { brand: 'Goog1e',  tint: '#4285f4' },
      { brand: 'Faceb00k', tint: '#1877f2' }
    ];
    for (let i = 0; i < 5; i++) {
      const speed = 12 + (i % 3) * 5;
      const span = level.width + 900;
      const x = ((i * 720) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 140;
      const wy = cam.y + 140 + (i * 67) % 220;
      const f = fakeLogins[i % fakeLogins.length];
      const w = 200, h = 130;

      ctx.globalAlpha = 0.16;       // very faded — atmosphere, not foreground
      // Browser-like window with title bar
      ctx.fillStyle = '#0a1a3a';
      ctx.strokeStyle = '#6bf0ff';
      ctx.lineWidth = 1.2;
      PQ.roundRect(ctx, wx, wy, w, h, 6);
      ctx.fill(); ctx.stroke();
      // Title bar
      ctx.fillStyle = '#1a2a5a';
      ctx.fillRect(wx, wy, w, 18);
      // URL bar (with the look-alike domain — visible at lower zoom)
      ctx.fillStyle = '#0a0f1f';
      ctx.fillRect(wx + 6, wy + 22, w - 12, 12);
      ctx.fillStyle = '#cdd6e8';
      ctx.font = '700 9px ui-monospace, "SF Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${f.brand.toLowerCase()}-secure-login.ru`, wx + 12, wy + 28);
      // "Sign in" header
      ctx.fillStyle = f.tint;
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.brand, wx + w / 2, wy + 50);
      ctx.fillStyle = '#cdd6e8';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText('Sign in to continue', wx + w / 2, wy + 65);
      // Email field
      ctx.fillStyle = '#cdd6e8';
      ctx.fillRect(wx + 24, wy + 78, w - 48, 12);
      // Password field
      ctx.fillRect(wx + 24, wy + 96, w - 48, 12);
      // Sign-in button
      ctx.fillStyle = f.tint;
      PQ.roundRect(ctx, wx + 60, wy + 114, w - 120, 12, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating envelopes — bumped from 12 → 20 with full vertical spread
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 20; i++) {
      const speed = 22 + (i % 4) * 10;
      const span = level.width + 800;
      const cycleLen = span;
      const startY = 70 + (i * 41) % 380;
      const x = ((i * 200) - t * speed) % cycleLen;
      const wx = cam.x + ((x % cycleLen) + cycleLen) % cycleLen - 80;
      const wy = cam.y + startY + Math.sin(t * 0.6 + i) * 6;
      ctx.fillStyle = '#0a1a3a';
      ctx.strokeStyle = '#6bf0ff';
      ctx.lineWidth = 1.5;
      PQ.roundRect(ctx, wx, wy, 56, 36, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 28, wy + 18);
      ctx.lineTo(wx + 56, wy);
      ctx.stroke();
      ctx.fillStyle = '#ffd15a';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('@', wx + 28, wy + 22);
    }
    ctx.globalAlpha = 1;

    // Dropping fishhooks — bumped from 5 → 9 with varied lengths
    for (let i = 0; i < 9; i++) {
      const xOff = (i * 360 + ((t * 35) % 360));
      const fx = cam.x + ((xOff % (viewW + 200)) - 100);
      const phase = (t * 0.5 + i * 0.4) % 6;
      const fy = cam.y + 60 + Math.sin(phase) * 14;
      const len = 80 + (i % 3) * 30 + Math.sin(phase * 0.7) * 12;
      ctx.strokeStyle = 'rgba(255,209,90,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(fx, cam.y);
      ctx.lineTo(fx, fy + len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx + 5, fy + len, 5, Math.PI * 0.4, Math.PI * 1.6);
      ctx.stroke();
      // Bait dot at the hook tip
      ctx.fillStyle = 'rgba(255,107,214,0.5)';
      ctx.beginPath(); ctx.arc(fx + 7, fy + len + 4, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  function drawBgPasswordCastle(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // ======== STONE MASONRY BACKDROP ========
    // Faux brick wall behind everything — gives the level a castle-floor feel
    // even without changing the actual platform render. Two parallax layers.
    ctx.globalAlpha = 0.18;
    const brickW = 56, brickH = 24;
    const par0 = 0.15;
    const startBrickX = Math.floor((cam.x * par0) / brickW) * brickW;
    for (let row = 0; row < 18; row++) {
      const offset = (row % 2) * (brickW / 2);
      for (let col = 0; col < 25; col++) {
        const bx = startBrickX + col * brickW + offset - cam.x * par0 + cam.x;
        const by = cam.y + row * brickH + 60;
        const seed = (Math.floor(startBrickX / brickW) + col + row * 17) * 9301;
        const shade = ((seed >> 8) & 0x07);          // 0..7
        ctx.fillStyle = shade < 2 ? '#332108' : shade < 5 ? '#3d2c0a' : '#241804';
        ctx.fillRect(bx, by, brickW - 2, brickH - 2);
      }
    }
    ctx.globalAlpha = 1;

    // ======== CRACKED-WALL SECTIONS ========
    // "Weak passwords broke through" — irregular zigzag cracks where bricks
    // are missing, with debris glow.
    const par2 = 0.22;
    const startCrack = Math.floor((cam.x * par2) / 380) * 380;
    for (let i = 0; i < 8; i++) {
      const wx = startCrack + i * 380 - cam.x * par2 + cam.x;
      const seed = Math.floor(startCrack / 380) + i;
      const wy = cam.y + 120 + ((seed * 71) % 220);
      // Skip some so they're spread irregularly, not in a row
      if ((seed * 9301) % 3 === 0) continue;
      ctx.globalAlpha = 0.55;
      // Dark gap underneath
      ctx.fillStyle = '#0a0700';
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + 14, wy + 28);
      ctx.lineTo(wx + 4,  wy + 50);
      ctx.lineTo(wx + 28, wy + 76);
      ctx.lineTo(wx + 12, wy + 104);
      ctx.lineTo(wx + 38, wy + 132);
      ctx.lineTo(wx + 60, wy + 110);
      ctx.lineTo(wx + 48, wy + 80);
      ctx.lineTo(wx + 70, wy + 50);
      ctx.lineTo(wx + 50, wy + 18);
      ctx.closePath();
      ctx.fill();
      // Cracked edge highlight
      ctx.strokeStyle = '#ffd15a';
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      // "WEAK PASSWORD" label etched faintly inside the gap
      ctx.fillStyle = '#ffd15a';
      ctx.font = '900 8px ui-monospace, "SF Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.4;
      ctx.fillText('weak pw', wx + 32, wy + 70);
      // Tiny rubble pieces around the crack
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#3d2c0a';
      for (let r = 0; r < 5; r++) {
        const rx = wx + ((seed + r) * 13 % 80) - 6;
        const ry = wy + 130 + (r * 7 % 12);
        ctx.fillRect(rx, ry, 5, 4);
      }
    }
    ctx.globalAlpha = 1;

    // ======== Far layer — large padlock silhouettes (parallax 0.3) ========
    const par1 = 0.3;
    const startA = Math.floor((cam.x * par1) / 320) * 320;
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 14; i++) {
      const wx = startA + i * 320 - cam.x * par1 + cam.x;
      const wy = cam.y + 240 + ((i * 71) % 80);
      // Lock body
      ctx.fillStyle = '#3d2c0a';
      PQ.roundRect(ctx, wx, wy, 80, 90, 8);
      ctx.fill();
      // Shackle
      ctx.strokeStyle = '#3d2c0a';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(wx + 40, wy, 28, Math.PI, 0);
      ctx.stroke();
      // Keyhole
      ctx.fillStyle = '#1a1206';
      ctx.beginPath(); ctx.arc(wx + 40, wy + 40, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(wx + 36, wy + 40, 8, 18);
    }
    ctx.globalAlpha = 1;

    // Floating golden keys — bumped from 9 → 16
    for (let i = 0; i < 16; i++) {
      const speed = 18 + (i % 3) * 10;
      const span = level.width + 600;
      const x = ((i * 360) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 60;
      const wy = cam.y + 110 + (i * 53) % 280 + Math.sin(t * 0.8 + i) * 7;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(Math.sin(t + i) * 0.3);
      ctx.fillStyle = '#ffd15a';
      ctx.strokeStyle = '#a06b00';
      ctx.lineWidth = 1.5;
      // Key bow (loop)
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1206';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      // Shaft + teeth
      ctx.fillStyle = '#ffd15a';
      ctx.fillRect(7, -2.5, 26, 5);
      ctx.fillRect(28, -7, 4, 12);
      ctx.fillRect(22, -7, 4, 9);
      ctx.restore();
    }

    // Combination dial in lower right (decorative anchor)
    const dialX = cam.x + viewW - 80;
    const dialY = cam.y + viewH - 200;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#3d2c0a';
    ctx.beginPath(); ctx.arc(dialX, dialY, 50, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd15a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(dialX, dialY, 50, 0, Math.PI * 2); ctx.stroke();
    // Tick marks
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + t * 0.2;
      const x1 = dialX + Math.cos(ang) * 38;
      const y1 = dialY + Math.sin(ang) * 38;
      const x2 = dialX + Math.cos(ang) * 48;
      const y2 = dialY + Math.sin(ang) * 48;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Pointer
    const pang = t * 0.4;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(dialX + Math.cos(pang) * 36, dialY + Math.sin(pang) * 36);
    ctx.stroke();

    ctx.restore();
  }

  function drawBgMalwareForest(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // Static noise — random pixel grid that flickers each frame, low alpha
    // so it reads as "screen interference" without overwhelming the FG.
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 220; i++) {
      const sx = (i * 173 + Math.floor(t * 800)) % viewW;
      const sy = (i * 91 + Math.floor(t * 600)) % viewH;
      const v = ((i * 9301 + Math.floor(t * 12)) % 5);
      ctx.fillStyle = v < 2 ? '#5eff9a' : v < 4 ? '#1a3a22' : '#ff5a7a';
      ctx.fillRect(cam.x + sx, cam.y + sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Horizontal scan-line glitch bars — occasionally jump across the screen
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#5eff9a';
    for (let i = 0; i < 8; i++) {
      const phase = (t * 0.7 + i * 0.4) % 5;
      if (phase > 4.6) {
        const y = cam.y + ((i * 89 + Math.floor(t * 100)) % viewH);
        ctx.fillRect(cam.x, y, viewW, 2);
      }
    }
    ctx.globalAlpha = 1;

    // Broken code fragments — green-on-black hex dump scrolling slowly
    ctx.font = '700 12px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = '#5eff9a';
    ctx.globalAlpha = 0.20;
    const codeLines = [
      '0xDEADBEEF  FF FE 00 7C  push rbp',
      'SEGFAULT  null pointer @ 0x00000000',
      'ERROR 0xC0000005: ACCESS_VIOLATION',
      '0x4A1F  E8 ?? ?? ??  call <unresolved>',
      'STACK_OVERFLOW exception not handled',
      '0xBADC0DE  CC CC CC CC  int3 (debug)',
      'KERNEL PANIC: encrypted_files=4096',
      '> exec(./payload.exe) :: PID 0x6666',
      'WARN: signature mismatch, continue?',
      '0xCAFEBABE  payload injected ✓'
    ];
    const lineH = 18;
    const startLine = Math.floor((t * 12) % codeLines.length);
    for (let i = 0; i < 14; i++) {
      const ly = cam.y + 90 + i * lineH;
      const line = codeLines[(startLine + i) % codeLines.length];
      const lx = cam.x + 30 + ((i * 41) % 80);
      ctx.fillText(line, lx, ly);
    }
    ctx.globalAlpha = 1;

    // BSOD-style error blocks scattered in the back layer — "blue screen of death"
    // but recolored to the level palette. Static, but jitter-twitch every couple frames.
    const par1 = 0.4;
    const startB = Math.floor((cam.x * par1) / 380) * 380;
    for (let i = 0; i < 9; i++) {
      const seed = Math.floor(startB / 380) + i;
      const wx = startB + i * 380 - cam.x * par1 + cam.x;
      const wy = cam.y + 80 + (seed * 71) % 280;
      const jitter = (Math.sin(t * 18 + i) > 0.92) ? 4 : 0;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#0d2218';
      ctx.fillRect(wx + jitter, wy, 240, 110);
      ctx.strokeStyle = '#a01030';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx + jitter, wy, 240, 110);
      // Error icon
      ctx.fillStyle = '#ff5a7a';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('✕', wx + jitter + 12, wy + 10);
      // Title + body lines
      ctx.fillStyle = '#5eff9a';
      ctx.font = '900 11px ui-monospace, "SF Mono", monospace';
      ctx.fillText('FATAL ERROR 0x' + (seed * 9301 % 0xFFFF).toString(16).toUpperCase().padStart(4, '0'), wx + jitter + 38, wy + 16);
      ctx.fillStyle = '#cdd6e8';
      ctx.font = '600 10px ui-monospace, "SF Mono", monospace';
      ctx.fillText('A problem has been detected.', wx + jitter + 12, wy + 44);
      ctx.fillText('Process: malware.exe (PID ' + (seed * 17 % 9999) + ')', wx + jitter + 12, wy + 60);
      ctx.fillText('Click any key to continue…', wx + jitter + 12, wy + 76);
      // Decorative scanline
      ctx.fillStyle = 'rgba(94,255,154,0.10)';
      ctx.fillRect(wx + jitter, wy + 92, 240, 4);
    }
    ctx.globalAlpha = 1;

    // *** Drifting fake-malware popup ads — the headline visual ***
    // Many of them, dense, including down in the lower play area so it
    // really feels like an infected screen during gameplay.
    const popups = [
      { text: 'YOU WON A FREE IPHONE!',          color: '#ff5a7a' },
      { text: 'CLAIM YOUR FREE ROBUX NOW!',      color: '#ffd15a' },
      { text: '⚠ WARNING: VIRUS DETECTED!',     color: '#ff5a7a' },
      { text: 'CLICK HERE TO SPEED UP YOUR PC!', color: '#5eff9a' },
      { text: 'FREE V-BUCKS GENERATOR',          color: '#ffd15a' },
      { text: '🎁 Hot deals near you!',          color: '#ff6bd6' },
      { text: '⚡ Your battery is at risk!',     color: '#ff5a7a' },
      { text: '💎 Mine BITCOIN in your browser', color: '#5eff9a' }
    ];
    for (let i = 0; i < 16; i++) {
      const speed = 22 + (i % 5) * 7;
      const span = level.width + 700;
      const x = ((i * 230) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 100;
      // Spread vertically across the FULL viewport including lower areas
      // so popups crowd the gameplay zone.
      const lane = i % 6;
      const wy = cam.y + 90 + lane * 95 + Math.sin(t * 0.7 + i) * 8;
      const popup = popups[i % popups.length];
      const w = 175, h = 44;

      ctx.globalAlpha = 0.7;
      // Window body
      ctx.fillStyle = '#0d0a18';
      ctx.strokeStyle = popup.color;
      ctx.lineWidth = 1.5;
      PQ.roundRect(ctx, wx, wy, w, h, 4);
      ctx.fill(); ctx.stroke();
      // Title bar
      ctx.fillStyle = popup.color;
      ctx.fillRect(wx, wy, w, 14);
      // Window controls (—, □, ×)
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = '900 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('— □ ×', wx + w - 22, wy + 7);
      // Body text
      ctx.fillStyle = '#fff';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, wx + w / 2, wy + 30);
    }
    ctx.globalAlpha = 1;

    // Top-of-screen RGB chromatic-aberration band — corrupted-monitor feel
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(cam.x, cam.y + Math.sin(t * 1.5) * 4 + 2, viewW, 1);
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(cam.x, cam.y + Math.sin(t * 1.5 + 1) * 4 + 5, viewW, 1);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawBgPrivacyPlaza(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // Far skyline — building silhouettes with lit windows (eyes watching)
    const par1 = 0.25;
    const startA = Math.floor((cam.x * par1) / 100) * 100;
    for (let i = 0; i < 32; i++) {
      const wx = startA + i * 100 - cam.x * par1 + cam.x;
      const seed = Math.floor(startA / 100) + i;
      const h = 180 + ((seed * 9301 + 49297) % 220);
      const y = cam.y + viewH - 60 - h;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#1f0a2e';
      ctx.fillRect(wx, y, 88, h);
      // Lit windows = "eyes watching"
      ctx.fillStyle = '#ff6bd6';
      for (let wi = 0; wi < 5; wi++) {
        for (let wj = 1; wj < Math.floor(h / 30); wj++) {
          const lit = (Math.sin(t * 1.2 + wi * 1.7 + wj * 0.8 + seed * 0.001) > 0.55);
          if (lit) {
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.ellipse(wx + 14 + wi * 14, y + wj * 30, 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // CCTV cameras mounted on the upper edges, panning side to side.
    for (let i = 0; i < 6; i++) {
      const camPx = cam.x + ((i / 6) * viewW) + Math.sin(t * 0.3 + i) * 30;
      const camPy = cam.y + 70 + (i % 2) * 32;
      const pan = Math.sin(t * 0.9 + i) * 0.4;
      ctx.save();
      ctx.translate(camPx, camPy);
      ctx.globalAlpha = 0.65;
      // Mount arm
      ctx.strokeStyle = '#ff6bd6';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 0); ctx.stroke();
      // Camera body
      ctx.rotate(pan);
      ctx.fillStyle = '#2a0a3c';
      PQ.roundRect(ctx, -18, -8, 30, 16, 3);
      ctx.fill();
      ctx.strokeStyle = '#ff6bd6';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Lens
      ctx.fillStyle = '#ff6bd6';
      ctx.beginPath(); ctx.arc(14, 0, 5, 0, Math.PI * 2); ctx.fill();
      // Red record dot
      ctx.fillStyle = '#ff5a7a';
      ctx.beginPath(); ctx.arc(-13, -3, 1.6, 0, Math.PI * 2); ctx.fill();
      // View cone
      ctx.fillStyle = 'rgba(255,107,214,0.10)';
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(110, -36);
      ctx.lineTo(110, 36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Floating profile cards — denser, with fake names + blurred photos
    const fakeNames = ['Ahmad K.', 'Sara L.', 'David M.', 'Lina F.', 'James W.', 'Mia O.', 'Omar S.', 'Eva H.', 'Noah P.', 'Layla R.'];
    for (let i = 0; i < 13; i++) {
      const speed = 22 + (i % 4) * 9;
      const span = level.width + 700;
      const x = ((i * 280) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 70;
      const wy = cam.y + 100 + (i * 47) % 320;
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = '#1a0a2e';
      ctx.strokeStyle = '#ff6bd6';
      ctx.lineWidth = 1.4;
      PQ.roundRect(ctx, wx, wy, 132, 50, 8);
      ctx.fill(); ctx.stroke();
      // Blurred avatar (concentric circles to fake a Gaussian blur)
      const ax = wx + 25, ay = wy + 25;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ff6bd6';
      ctx.beginPath(); ctx.arc(ax, ay, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.32;
      ctx.beginPath(); ctx.arc(ax, ay, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(ax, ay, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.62;
      // Name + verification dot
      ctx.fillStyle = '#fff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(fakeNames[i % fakeNames.length], wx + 50, wy + 10);
      ctx.fillStyle = '#6bf0ff';
      ctx.beginPath(); ctx.arc(wx + 122, wy + 14, 3, 0, Math.PI * 2); ctx.fill();
      // Handle line
      ctx.fillStyle = '#a8b3cc';
      ctx.fillRect(wx + 50, wy + 27, 50, 4);
      // 3 stat dots (likes / followers / posts)
      ctx.fillStyle = '#ff6bd6';
      ctx.fillRect(wx + 50, wy + 38, 18, 4);
      ctx.fillRect(wx + 72, wy + 38, 14, 4);
      ctx.fillRect(wx + 90, wy + 38, 10, 4);
    }
    ctx.globalAlpha = 1;

    // Floating social-media icons (heart, like, share, location pin, camera)
    // drift across in their own slower lane
    const icons = ['❤', '👍', '↗', '📍', '📷', '👁'];
    for (let i = 0; i < 18; i++) {
      const speed = 30 + (i % 4) * 6;
      const span = level.width + 600;
      const x = ((i * 200) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 50;
      const wy = cam.y + 120 + ((i * 79) % 360) + Math.sin(t + i) * 12;
      ctx.globalAlpha = 0.65;
      ctx.font = '900 22px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Glow circle
      ctx.fillStyle = 'rgba(255,107,214,0.18)';
      ctx.beginPath(); ctx.arc(wx, wy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6bd6';
      ctx.fillText(icons[i % icons.length], wx, wy);
    }
    ctx.globalAlpha = 1;

    // Vertical data streams (matrix-style binary digits flowing down)
    ctx.globalAlpha = 0.22;
    ctx.font = '700 12px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = '#ff6bd6';
    for (let col = 0; col < 14; col++) {
      const colX = cam.x + ((col * 130 + Math.floor(cam.x * 0.4)) % (viewW + 130)) - 60;
      const offset = (col * 73) % 220;
      const speed = 60 + (col % 3) * 25;
      for (let r = 0; r < 14; r++) {
        const y = ((t * speed + offset + r * 22) % (viewH + 200)) - 50;
        const ch = (col + r) % 2 ? '0' : '1';
        ctx.globalAlpha = 0.06 + (r === 0 ? 0.30 : (1 - r / 14) * 0.18);
        ctx.fillText(ch, colX, cam.y + y);
      }
    }
    ctx.globalAlpha = 1;

    // Location pins falling — geolocation leaks
    for (let i = 0; i < 6; i++) {
      const x = (i * 460 + t * 60) % (level.width + 200);
      const wx = cam.x + ((x % (level.width + 200)) + (level.width + 200)) % (level.width + 200) - 100;
      const fall = ((t * 80 + i * 200) % 600);
      const wy = cam.y + fall;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ff6bd6';
      ctx.beginPath();
      ctx.arc(wx, wy, 8, Math.PI, 0);
      ctx.lineTo(wx + 8, wy);
      ctx.lineTo(wx, wy + 16);
      ctx.lineTo(wx - 8, wy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a0a2e';
      ctx.beginPath(); ctx.arc(wx, wy - 1, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawBgRansomwareVault(level) {
    const cam = game.camera;
    const t = game.bgTime;
    ctx.save();

    // Filing cabinet wall (back layer)
    const par1 = 0.3;
    const startA = Math.floor((cam.x * par1) / 90) * 90;
    for (let i = 0; i < 36; i++) {
      const wx = startA + i * 90 - cam.x * par1 + cam.x;
      const wy = cam.y + 100;
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = '#2a0a14';
      ctx.fillRect(wx, wy, 80, viewH - 100);
      ctx.strokeStyle = '#ff5a7a';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const dy = wy + 50 + k * 110;
        ctx.beginPath(); ctx.moveTo(wx, dy); ctx.lineTo(wx + 80, dy); ctx.stroke();
        if (k < 3) {
          ctx.fillStyle = '#ff5a7a';
          ctx.fillRect(wx + 30, dy + 50, 20, 4);
        }
      }
    }
    ctx.globalAlpha = 1;

    // ======== Locked file & folder icons — scattered background decoration ========
    // Mid layer with parallax 0.5 so they feel embedded in the vault.
    const par2 = 0.5;
    const startFiles = Math.floor((cam.x * par2) / 160) * 160;
    for (let i = 0; i < 22; i++) {
      const wx = startFiles + i * 160 - cam.x * par2 + cam.x;
      const seed = Math.floor(startFiles / 160) + i;
      const wy = cam.y + 80 + ((seed * 71) % 420);
      const isFolder = (seed % 2) === 0;
      const jitter = Math.sin(t * 1.5 + i) * 1.5;
      ctx.globalAlpha = 0.55;
      if (isFolder) {
        // Folder icon
        ctx.fillStyle = '#ff5a7a';
        // Tab
        ctx.fillRect(wx, wy + jitter, 20, 5);
        // Body
        PQ.roundRect(ctx, wx, wy + jitter + 4, 36, 26, 2);
        ctx.fill();
        // Inner shadow line
        ctx.fillStyle = '#5a0e16';
        ctx.fillRect(wx + 2, wy + jitter + 8, 32, 1);
      } else {
        // File icon (folded-corner page)
        ctx.fillStyle = '#cdd6e8';
        ctx.beginPath();
        ctx.moveTo(wx, wy + jitter);
        ctx.lineTo(wx + 22, wy + jitter);
        ctx.lineTo(wx + 30, wy + jitter + 8);
        ctx.lineTo(wx + 30, wy + jitter + 36);
        ctx.lineTo(wx, wy + jitter + 36);
        ctx.closePath();
        ctx.fill();
        // Folded corner triangle
        ctx.fillStyle = '#9aa3b8';
        ctx.beginPath();
        ctx.moveTo(wx + 22, wy + jitter);
        ctx.lineTo(wx + 30, wy + jitter + 8);
        ctx.lineTo(wx + 22, wy + jitter + 8);
        ctx.closePath();
        ctx.fill();
        // Text lines
        ctx.fillStyle = '#5a6a82';
        for (let r = 0; r < 3; r++) ctx.fillRect(wx + 4, wy + jitter + 14 + r * 5, 20, 2);
      }
      // Padlock overlay (bottom-right of every file/folder)
      ctx.fillStyle = '#ffd15a';
      const lx = wx + (isFolder ? 22 : 18);
      const ly = wy + jitter + (isFolder ? 18 : 22);
      PQ.roundRect(ctx, lx, ly, 12, 14, 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd15a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx + 6, ly, 4, Math.PI, 0);
      ctx.stroke();
      // Tiny keyhole
      ctx.fillStyle = '#3a0a08';
      ctx.fillRect(lx + 5, ly + 5, 2, 6);
    }
    ctx.globalAlpha = 1;

    // ======== Ransom note fragments — torn paper drifting across ========
    const noteTexts = [
      'YOUR FILES ARE LOCKED.',
      'PAY $500 IN BITCOIN.',
      '24 HOURS OR FILES DELETED.',
      'DO NOT CONTACT POLICE.',
      'NO POLICE. NO BACKUPS.',
      'SEND TO BTC: 1qZ8X4yK…',
      '⚠ ENCRYPTED ⚠',
      'PAYMENT REQUIRED.'
    ];
    for (let i = 0; i < 7; i++) {
      const speed = 16 + (i % 3) * 8;
      const span = level.width + 700;
      const x = ((i * 460) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 90;
      const wy = cam.y + 90 + (i * 67) % 380;
      const tilt = Math.sin(t * 0.6 + i) * 0.08;
      const text = noteTexts[i % noteTexts.length];

      ctx.save();
      ctx.translate(wx + 70, wy + 28);
      ctx.rotate(tilt);
      ctx.globalAlpha = 0.7;
      // Torn paper background — irregular polygon
      ctx.fillStyle = '#f0ebd8';
      ctx.beginPath();
      ctx.moveTo(-70, -22);
      ctx.lineTo(-60, -28);
      ctx.lineTo(-30, -22);
      ctx.lineTo(  0, -26);
      ctx.lineTo( 35, -20);
      ctx.lineTo( 70, -22);
      ctx.lineTo( 68,  22);
      ctx.lineTo( 30,  28);
      ctx.lineTo(  0,  22);
      ctx.lineTo(-40,  26);
      ctx.lineTo(-70,  20);
      ctx.closePath();
      ctx.fill();
      // Edge shading
      ctx.strokeStyle = 'rgba(150,90,30,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Ransom note text — looks scrawled / mismatched fonts (ransom-letter feel)
      ctx.fillStyle = '#7a1428';
      ctx.font = '900 13px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ======== Locked chest icons drifting across ========
    for (let i = 0; i < 12; i++) {
      const speed = 22 + (i % 3) * 9;
      const span = level.width + 600;
      const x = ((i * 360) - t * speed) % span;
      const wx = cam.x + ((x % span) + span) % span - 70;
      const wy = cam.y + 130 + (i * 47) % 240;
      ctx.globalAlpha = 0.65;
      // Chest body
      ctx.fillStyle = '#3a0a08';
      ctx.strokeStyle = '#ff5a7a';
      ctx.lineWidth = 1.5;
      PQ.roundRect(ctx, wx, wy, 60, 38, 4);
      ctx.fill(); ctx.stroke();
      // Lid
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 30, wy - 14, wx + 60, wy);
      ctx.fill(); ctx.stroke();
      // Padlock
      ctx.fillStyle = '#ffd15a';
      PQ.roundRect(ctx, wx + 25, wy + 14, 10, 14, 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd15a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx + 30, wy + 14, 4, Math.PI, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // *** Real 60-second doomsday timer driven by game.ransomTimerSec. ***
    // Last 10 seconds pulse hard. Always visible top-center.
    const remaining = Math.max(0, game.ransomTimerSec || 0);
    const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
    const ss = Math.floor(remaining % 60).toString().padStart(2, '0');
    const tenths = Math.floor((remaining * 10) % 10);
    const critical = remaining <= 10;
    const pulse = 0.5 + Math.sin(t * (critical ? 8 : 2.5)) * 0.5;

    // Backplate so the timer pops against any backdrop chaos.
    const tx = cam.x + viewW * 0.5;
    const ty = cam.y + 110;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0a0204';
    PQ.roundRect(ctx, tx - 200, ty - 50, 400, 100, 12);
    ctx.fill();
    ctx.strokeStyle = '#ff5a7a';
    ctx.lineWidth = 2 + (critical ? pulse * 3 : 0);
    PQ.roundRect(ctx, tx - 200, ty - 50, 400, 100, 12);
    ctx.stroke();

    ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle = critical ? '#ff2030' : '#ff5a7a';
    ctx.font = '900 56px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 1-decimal display in last 10s for extra urgency.
    const display = critical ? `${mm}:${ss}.${tenths}` : `${mm}:${ss}`;
    ctx.fillText(display, tx, ty - 8);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ff5a7a';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText('⚠ TIME UNTIL FILES DELETED ⚠', tx, ty + 28);
    ctx.globalAlpha = 1;

    // Red haze that intensifies as time runs out
    const danger = 1 - (remaining / 60);
    ctx.globalAlpha = 0.04 + 0.16 * danger * (critical ? pulse : 1);
    ctx.fillStyle = '#ff0028';
    ctx.fillRect(cam.x, cam.y, viewW, viewH);

    ctx.restore();
  }

  function drawWorld(level) {
    const theme = level.theme;
    const camL = game.camera.x - 50, camR = game.camera.x + viewW + 50;

    // Platforms — drawn WITHOUT shadowBlur (huge perf win). A solid top-edge
    // stripe + a hairline bottom accent sells the glow without the cost.
    ctx.fillStyle = theme.platformFill;
    for (const t of level.tiles) {
      if (!t.solid) continue;
      if (t.x + t.w < camL || t.x > camR) continue;
      if (t.y < -40) continue;
      PQ.roundRect(ctx, t.x, t.y, t.w, t.h, 6);
      ctx.fill();
    }

    // Top-edge accents (bright stripe)
    ctx.fillStyle = theme.platformEdge;
    for (const t of level.tiles) {
      if (!t.solid) continue;
      if (t.x + t.w < camL || t.x > camR) continue;
      if (t.y < -40) continue;
      ctx.fillRect(t.x + 2, t.y, t.w - 4, 2);
    }

    // Bottom hairline
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = theme.platformEdge;
    for (const t of level.tiles) {
      if (!t.solid) continue;
      if (t.x + t.w < camL || t.x > camR) continue;
      if (t.y < -40) continue;
      ctx.fillRect(t.x + 4, t.y + t.h - 2, t.w - 8, 1);
    }
    ctx.restore();

    // Hazards
    for (const h of level.hazards) {
      if (h.x + h.w < camL || h.x > camR) continue;
      h.draw(ctx);
    }

    // Portal — always visible (end of level)
    if (level.portal) {
      level.portal.animT = (level.portal.animT || 0) + 0.016;
      if (level.portal.x + level.portal.w > camL - 200 && level.portal.x < camR + 200) {
        level.portal.draw(ctx);
      }
    }
  }

  function drawEntities(level) {
    // Particles behind entities
    game.particles.draw(ctx);

    // Packets
    for (const pk of level.packets) {
      if (pk.x + pk.w < game.camera.x - 40) continue;
      if (pk.x > game.camera.x + viewW + 40) continue;
      pk.draw(ctx);
    }

    // Question blocks
    for (const qb of level.questions) qb.draw(ctx);

    // Enemies
    for (const e of level.enemies) {
      if (e.x + e.w < game.camera.x - 80) continue;
      if (e.x > game.camera.x + viewW + 80) continue;
      e.draw(ctx);
    }
  }

  function drawPlayer() {
    if (!game.player) return;
    game.player.draw(ctx);
  }

  function drawForegroundFog(level) {
    // Subtle vignette glow tint at top edge for atmosphere
    ctx.save();
    const g = ctx.createLinearGradient(0, game.camera.y, 0, game.camera.y + 160);
    g.addColorStop(0, level.theme.ambient);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(game.camera.x, game.camera.y, viewW, 160);
    ctx.restore();
  }

  function drawLevelCompleteBanner() {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 6, 15, 0.65)';
    ctx.fillRect(0, 0, viewW, viewH);

    const isFinal = game.levelIdx >= PQ.LEVEL_COUNT;
    const headline = isFinal ? 'ALL THREATS DEFEATED' : 'THREAT NEUTRALIZED';
    const sub      = isFinal
      ? 'Generating your Cyber Security Report'
      : 'Moving to next level…';

    PQ.text(ctx, headline, viewW / 2, viewH / 2 - 20, {
      size: 64, align: 'center', baseline: 'middle', color: isFinal ? '#5eff9a' : '#6bf0ff',
      glow: isFinal ? '#5eff9a' : '#6bf0ff', glowSize: 40, stroke: '#05060f', strokeWidth: 6, weight: 900
    });

    // Subtitle — final level appends animated dots so the wait feels like
    // the report is actually being computed, not just a delay.
    let subText = sub;
    if (isFinal) {
      const dots = Math.floor(game.levelDoneT * 2) % 4;
      subText = sub + '.'.repeat(dots);
    }
    PQ.text(ctx, subText, viewW / 2, viewH / 2 + 28, {
      size: 17, align: 'center', baseline: 'middle', color: '#cdd6e8'
    });

    // Final level: progress bar that fills over the wait window so the
    // generation feels real. Width tracked vs the FINAL_WAIT timer below.
    if (isFinal) {
      const total = 3.5; // matches FINAL_WAIT below
      const t = Math.min(1, game.levelDoneT / total);
      const barW = 360, barH = 6;
      const barX = (viewW - barW) / 2;
      const barY = viewH / 2 + 60;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      PQ.roundRect(ctx, barX, barY, barW, barH, 3);
      ctx.fill();
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#6bf0ff');
      grad.addColorStop(1, '#5eff9a');
      ctx.fillStyle = grad;
      PQ.roundRect(ctx, barX, barY, barW * t, barH, 3);
      ctx.fill();

      // Console-style line of "scanning" steps that flash through
      const steps = [
        '> scanning phishing scenarios…',
        '> evaluating password skill…',
        '> checking malware decisions…',
        '> reviewing privacy choices…',
        '> assessing ransomware response…'
      ];
      const stepIdx = Math.min(steps.length - 1, Math.floor(game.levelDoneT / (total / steps.length)));
      PQ.text(ctx, steps[stepIdx], viewW / 2, barY + 28, {
        size: 12, align: 'center', baseline: 'middle', color: '#7e8aa8',
        weight: 600
      });
    }
    ctx.restore();
  }

  // ---- Buttons ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // Difficulty toggle — just swap the .is-active class. startGame() reads it.
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        PQ.sfx.play('select');
      });
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      PQ.UI.hide('title-screen');
      PQ.sfx.play('start');
      startGame();
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      PQ.UI.hide('pause-screen');
      if (game.level) {
        state = STATES.PLAY;
        PQ.music.start(game.level.layer);
      }
    });
    document.getElementById('btn-restart-level').addEventListener('click', () => {
      PQ.UI.hide('pause-screen');
      loadLevel(game.levelIdx);
    });
    document.getElementById('btn-skip-level').addEventListener('click', () => {
      PQ.sfx.play('select');
      skipLevel();
    });
    document.getElementById('btn-quit-title').addEventListener('click', () => {
      PQ.UI.hide('pause-screen');
      PQ.UI.hideHUD();
      PQ.music.stop();
      state = STATES.TITLE;
      PQ.UI.show('title-screen');
    });
    document.getElementById('btn-play-again').addEventListener('click', () => {
      PQ.UI.hide('end-screen');
      startGame();
    });
    document.getElementById('btn-back-title').addEventListener('click', () => {
      PQ.UI.hide('end-screen');
      state = STATES.TITLE;
      PQ.UI.show('title-screen');
    });
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        try { window.print(); } catch (e) {}
      });
    }
    document.getElementById('btn-retry-run').addEventListener('click', () => {
      PQ.UI.hide('gameover-screen');
      startGame();
    });
    document.getElementById('btn-go-title').addEventListener('click', () => {
      PQ.UI.hide('gameover-screen');
      state = STATES.TITLE;
      PQ.UI.show('title-screen');
    });

    // Leaderboard — title-screen entry + end-screen save + tab filters + clear
    const lbBtn = document.getElementById('btn-leaderboard');
    if (lbBtn) lbBtn.addEventListener('click', () => {
      PQ.UI.hide('title-screen');
      PQ.UI.showLeaderboard();
      PQ.sfx.play('select');
    });
    const saveBtn = document.getElementById('btn-save-score');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const ok = PQ.UI.saveLastRunToLeaderboard();
      if (ok) { PQ.sfx.play('correct'); PQ.confetti(30); }
    });
    document.querySelectorAll('.lb-tab').forEach(t => {
      t.addEventListener('click', () => {
        PQ.sfx.play('select');
        PQ.UI._setLBFilter(t.dataset.lbFilter);
      });
    });
    const clearBtn = document.getElementById('btn-lb-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire leaderboard? This cannot be undone.')) {
        PQ.Leaderboard.clear();
        PQ.UI._renderLeaderboard();
      }
    });
  });

  // ---- Kickoff ------------------------------------------------------------
  requestAnimationFrame((t) => { lastMs = t; loop(t); });

  console.log('[CQ] Cyber Quest — ready to play.');
})();
