// ============================================================================
// ui.js — HTML overlay management
// Screens: title, howto, credits, level-intro, question modal, feedback,
// pause, end (grade report), game over. Plus the live HUD.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  const UI = {};
  const $ = (id) => document.getElementById(id);

  // --- Leaderboard storage ------------------------------------------------
  // Primary store: a JSON file in Electron's userData directory (via IPC).
  // This survives app restarts and DMG reinstalls because userData lives in
  // ~/Library/Application Support/Cyber Quest/ regardless of how the app
  // was launched.
  //
  // Fallback store: localStorage. Used when running outside Electron, or if
  // the IPC bridge happens to be unavailable. Also acts as a hot cache so
  // reads are synchronous once the initial bootstrap has completed.
  const LB_KEY = 'pq_leaderboard_v1';
  let cache = [];      // synchronous in-memory copy; source of truth at runtime
  let bootstrapped = false;

  function readLocal() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeLocal(entries) {
    try { localStorage.setItem(LB_KEY, JSON.stringify(entries)); } catch (e) {}
  }
  function writeFile(entries) {
    if (window.pqStore && window.pqStore.saveLeaderboard) {
      window.pqStore.saveLeaderboard(entries).catch(() => {});
    }
  }
  // Storage key: one entry per (NAME, DIFFICULTY). So a single person may
  // have up to 3 rows on disk — their best BEGINNER run, their best
  // INTERMEDIATE run, and their best ADVANCED run.
  //
  // At DISPLAY time, the ALL tab re-dedups by name alone (keeping their
  // overall best across all tiers), while the per-tier tabs filter to just
  // that difficulty's rows. That way:
  //   - ALL tab        → one row per person, their best run overall
  //   - BEGINNER tab   → one row per person, their best beginner run
  //   - INTERMEDIATE   → one row per person, their best intermediate run
  //   - ADVANCED       → one row per person, their best advanced run
  function entryKey(e) {
    return ((e && e.name) || '').trim().toUpperCase() + '|' + ((e && e.difficulty) || '');
  }
  function nameOnlyKey(e) {
    return ((e && e.name) || '').trim().toUpperCase();
  }
  function isBetter(a, b) {
    // returns true iff a strictly beats b
    if (a.correct !== b.correct) return a.correct > b.correct;
    if (a.score   !== b.score)   return a.score   > b.score;
    // tie-breaker: more recent
    return (a.ts || 0) > (b.ts || 0);
  }
  function dedupKeepBest(arr, keyFn) {
    const kfn = keyFn || entryKey;
    const byKey = new Map();
    for (const e of arr) {
      if (!e) continue;
      const k = kfn(e);
      const prev = byKey.get(k);
      if (!prev || isBetter(e, prev)) byKey.set(k, e);
    }
    return Array.from(byKey.values());
  }
  function mergeDedup(a, b) {
    return dedupKeepBest([].concat(a || [], b || []));
  }
  function sortEntries(arr) {
    arr.sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      if (b.score !== a.score)     return b.score - a.score;
      return (b.ts || 0) - (a.ts || 0);
    });
    return arr.slice(0, 200);
  }

  const Leaderboard = {
    // Synchronous read — returns the in-memory cache. Use after bootstrap.
    load() { return cache.slice(); },
    // Async one-shot that returns latest cache (and triggers bootstrap if needed).
    async loadAsync() { await Leaderboard.bootstrap(); return cache.slice(); },
    async bootstrap() {
      if (bootstrapped) return;
      // Flip the flag immediately so parallel bootstrap() calls don't race.
      bootstrapped = true;
      let fromFile = [];
      if (window.pqStore && window.pqStore.loadLeaderboard) {
        try { fromFile = await window.pqStore.loadLeaderboard(); } catch (e) { fromFile = []; }
      }
      const fromLocal = readLocal();
      // Merge disk + localStorage into the CURRENT cache (not over it) so
      // any add() calls that happened during the async IPC read are kept.
      // dedupKeepBest collapses any duplicates that came in from older
      // versions of the code when dedup was scoped differently.
      cache = sortEntries(mergeDedup(cache, mergeDedup(fromFile, fromLocal)));
      writeLocal(cache);
      writeFile(cache);
    },
    add(entry) {
      // Dedup at add time. If an earlier entry exists for this (name,
      // difficulty), keep the stronger of the two.
      const key = entryKey(entry);
      const idx = cache.findIndex(e => entryKey(e) === key);
      let status = 'added';
      if (idx >= 0) {
        if (isBetter(entry, cache[idx])) {
          cache[idx] = entry;
          status = 'improved';
        } else {
          status = 'kept-old';
        }
      } else {
        cache.push(entry);
      }
      cache = sortEntries(cache);
      writeLocal(cache);
      writeFile(cache);
      return { entries: cache.slice(), status };
    },
    clear() {
      cache = [];
      writeLocal(cache);
      writeFile(cache);
    }
  };

  // Kick off bootstrap as soon as this script loads. Leaderboard UI won't
  // open for a few seconds at the earliest so this almost always completes
  // before the user ever opens the panel.
  Leaderboard.bootstrap();

  UI.Leaderboard = Leaderboard;
  PQ.Leaderboard = Leaderboard;

  function show(id) {
    const el = $(id);
    if (el) el.classList.add('visible');
  }
  function hide(id) {
    const el = $(id);
    if (el) el.classList.remove('visible');
  }
  function hideAll() {
    document.querySelectorAll('.overlay.visible').forEach(el => el.classList.remove('visible'));
  }

  UI.show = show;
  UI.hide = hide;
  UI.hideAll = hideAll;

  // ---- HUD ----------------------------------------------------------------
  UI.showHUD = function () {
    $('hud').classList.add('visible');
    const ss = $('stack-sidebar');
    if (ss) ss.classList.add('visible');
  };
  UI.hideHUD = function () {
    $('hud').classList.remove('visible');
    const ss = $('stack-sidebar');
    if (ss) ss.classList.remove('visible');
  };

  // ---- Network Stack sidebar ---------------------------------------------
  // Highlights the current layer and plays a brief "just-activated" pulse
  // whenever the active layer changes (e.g. on level transition).
  UI.setStackLayer = function (layerKey) {
    const sidebar = $('stack-sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('.stack-layer').forEach(el => {
      const active = el.dataset.layer === layerKey;
      // Remove any in-flight pulse animation class first
      el.classList.remove('just-activated');
      if (active) {
        el.classList.add('is-active');
        // Force reflow so restarting the animation is reliable
        void el.offsetWidth;
        el.classList.add('just-activated');
      } else {
        el.classList.remove('is-active');
      }
    });
  };

  UI.updateHUD = function (state) {
    $('hud-lives').textContent = '♥ '.repeat(Math.max(0, state.lives)).trim() || '—';
    $('hud-packets').textContent = String(state.packets);
    $('hud-score').textContent = state.score.toLocaleString();
    $('hud-level').textContent = `L${state.levelIdx} · ${state.levelName}`;
    $('hud-correct').textContent = String(state.correct);
    $('hud-total').textContent = String(state.totalAnswered);
    if (state.power) {
      $('hud-power-name').textContent = state.power.label;
      $('hud-power-name').style.color = state.power.tint;
      const pct = Math.max(0, state.power.t / state.power.total) * 100;
      $('hud-power-fill').style.width = pct + '%';
      $('hud-power-fill').style.background = `linear-gradient(90deg, ${state.power.tint}, #fff)`;
    } else {
      $('hud-power-name').textContent = '—';
      $('hud-power-name').style.color = '';
      $('hud-power-fill').style.width = '0%';
    }
  };

  // ---- Level intro --------------------------------------------------------
  // Shows layer description with a CONTINUE button — user advances manually.
  UI.showLevelIntro = function (level, onDone) {
    $('li-num').textContent = `LEVEL 0${level.id}`;
    $('li-name').textContent = level.name;
    $('li-tag').textContent = level.tagline;
    $('li-desc').textContent = (PQ.LAYER_INTROS && PQ.LAYER_INTROS[level.layer]) || '';
    show('level-intro');

    const btn = $('btn-level-continue');
    const onClick = () => {
      btn.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      hide('level-intro');
      PQ.sfx.play('select');
      onDone && onDone();
    };
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') onClick();
    };
    btn.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  };

  // ---- Question modal -----------------------------------------------------
  // Returns a Promise<{ correct: boolean, chosen: number|null, question }>
  // No timer — the player/demo host decides when to answer.
  UI.askQuestion = function (question) {
    PQ.sfx.play('questionIn');
    $('q-topic').textContent = `${PQ.LAYERS[question.layer].label.toUpperCase()} · ${question.topic.toUpperCase()}`;
    $('q-text').textContent = question.q;

    const answersEl = $('q-answers');
    answersEl.innerHTML = '';
    const letters = ['A','B','C','D'];
    const btns = question.a.map((text, i) => {
      const b = document.createElement('button');
      b.className = 'answer-btn';
      b.innerHTML = `<span class="answer-key">${letters[i]}</span><span>${text}</span>`;
      answersEl.appendChild(b);
      return b;
    });

    show('question-modal');

    return new Promise((resolve) => {
      let finished = false;

      function done(chosenIdx) {
        if (finished) return;
        finished = true;
        btns.forEach((b, i) => {
          b.disabled = true;
          if (i === question.correct) b.classList.add('correct');
          if (chosenIdx !== null && i === chosenIdx && i !== question.correct) b.classList.add('wrong');
        });
        const correct = chosenIdx === question.correct;
        setTimeout(() => {
          hide('question-modal');
          resolve({ correct, chosen: chosenIdx, question });
        }, 900);
      }

      btns.forEach((b, i) => {
        b.addEventListener('click', () => { PQ.sfx.play('select'); done(i); });
      });
      // Mouse-only by design.
    });
  };

  // ---- Stop & Think scenario modal ---------------------------------------
  // Same return shape as askQuestion: { correct, chosen, question } where
  // `question` is synthesized so applyAnswer in game.js works unchanged.
  UI.askScenario = function (sc) {
    PQ.sfx.play('questionIn');
    $('sc-title').textContent = sc.title;
    $('sc-situation').textContent = sc.situation;
    $('sc-q').textContent = sc.q;

    const answersEl = $('sc-answers');
    answersEl.innerHTML = '';
    const letters = ['A','B','C','D'];
    const btns = sc.a.map((text, i) => {
      const b = document.createElement('button');
      b.className = 'answer-btn';
      b.innerHTML = `<span class="answer-key">${letters[i]}</span><span>${text}</span>`;
      answersEl.appendChild(b);
      return b;
    });

    show('scenario-modal');

    const question = {
      layer: sc.layer,
      topic: sc.title,
      q: sc.q,
      a: sc.a,
      correct: sc.correct,
      why: sc.why
    };

    return new Promise((resolve) => {
      let finished = false;
      function done(chosenIdx) {
        if (finished) return;
        finished = true;
        btns.forEach((b, i) => {
          b.disabled = true;
          if (i === sc.correct) b.classList.add('correct');
          if (chosenIdx !== null && i === chosenIdx && i !== sc.correct) b.classList.add('wrong');
        });
        const correct = chosenIdx === sc.correct;
        setTimeout(() => {
          hide('scenario-modal');
          resolve({ correct, chosen: chosenIdx, question });
        }, 900);
      }
      btns.forEach((b, i) => {
        b.addEventListener('click', () => { PQ.sfx.play('select'); done(i); });
      });
      // Mouse-only.
    });
  };

  // ---- Phishing Email mini-game ------------------------------------------
  // The mechanic-based learning loop. Player flags suspicious parts, then
  // chooses REPORT or OPEN. Correct = flagged most suspicious AND right call.
  UI.runPhishingMiniGame = function (email) {
    PQ.sfx.play('questionIn');

    const fromEl = $('phish-from');
    fromEl.textContent = email.from.text;
    fromEl.dataset.suspicious = email.from.suspicious ? '1' : '0';
    fromEl.classList.remove('flagged', 'reveal-suspicious', 'reveal-safe');

    const subjEl = $('phish-subject');
    subjEl.textContent = email.subject.text;
    subjEl.dataset.suspicious = email.subject.suspicious ? '1' : '0';
    subjEl.classList.remove('flagged', 'reveal-suspicious', 'reveal-safe');

    const bodyEl = $('phish-body');
    bodyEl.innerHTML = '';
    const bodyParts = [];
    email.body.forEach((p) => {
      const span = document.createElement('div');
      span.className = 'phish-part phish-line';
      span.textContent = p.text;
      span.dataset.suspicious = p.suspicious ? '1' : '0';
      bodyEl.appendChild(span);
      bodyParts.push(span);
    });

    const allParts = [fromEl, subjEl, ...bodyParts];
    const totalSuspicious = allParts.filter(p => p.dataset.suspicious === '1').length;
    $('phish-flag-needed').textContent = totalSuspicious;
    $('phish-flag-count').textContent = '0';

    const reportBtn = $('btn-phish-report');
    const openBtn = $('btn-phish-open');
    reportBtn.disabled = false;
    openBtn.disabled = false;

    show('phish-modal');

    const question = {
      layer: 'PHISHING',
      topic: 'Phishing Email Sorter',
      q: 'Was this email phishing?',
      a: ['Reported (phishing)', 'Opened (safe)'],
      correct: email.verdict === 'phishing' ? 0 : 1,
      why: email.verdict === 'phishing'
        ? 'This email was phishing. Tell-tale signs: look-alike sender domain (zeros instead of letters), threatening urgency, and a link that doesn\'t go to the real company. Always REPORT and delete.'
        : 'This email was safe — a real sender, normal request, no urgent threats or suspicious links.'
    };

    return new Promise((resolve) => {
      let finished = false;

      function updateCount() {
        const flaggedCount = allParts.filter(p => p.classList.contains('flagged')).length;
        $('phish-flag-count').textContent = flaggedCount;
      }

      function flagToggle(part) {
        if (finished) return;
        part.classList.toggle('flagged');
        PQ.sfx.play('select');
        updateCount();
      }

      allParts.forEach(p => p.addEventListener('click', () => flagToggle(p)));

      function judge(action /* 'report' | 'open' */) {
        if (finished) return;
        finished = true;
        reportBtn.disabled = true;
        openBtn.disabled = true;

        const flaggedSuspicious = allParts.filter(p => p.classList.contains('flagged') && p.dataset.suspicious === '1').length;
        const flaggedSafe = allParts.filter(p => p.classList.contains('flagged') && p.dataset.suspicious !== '1').length;

        // Reveal what was actually suspicious
        allParts.forEach(p => {
          if (p.dataset.suspicious === '1') p.classList.add('reveal-suspicious');
          else if (p.classList.contains('flagged')) p.classList.add('reveal-safe');
        });

        let correct;
        if (email.verdict === 'phishing') {
          // Right = REPORT and flagged at least (total - 1) suspicious parts
          correct = action === 'report' && flaggedSuspicious >= Math.max(1, totalSuspicious - 1);
        } else {
          // Safe email — right = OPEN with no false flags
          correct = action === 'open' && flaggedSafe === 0;
        }
        const chosen = action === 'report' ? 0 : 1;

        setTimeout(() => {
          hide('phish-modal');
          document.removeEventListener('keydown', keyHandler);
          // Cleanup so a second mini-game starts clean
          allParts.forEach(p => p.classList.remove('flagged', 'reveal-suspicious', 'reveal-safe'));
          resolve({ correct, chosen, question });
        }, 1500);
      }

      reportBtn.addEventListener('click', () => judge('report'), { once: true });
      openBtn.addEventListener('click', () => judge('open'), { once: true });

      function keyHandler(e) {
        if (finished) return;
        if (e.key.toLowerCase() === 'r') judge('report');
        else if (e.key.toLowerCase() === 'o') judge('open');
      }
      document.addEventListener('keydown', keyHandler);
    });
  };

  // ---- Password Strength Builder mini-game (Password Castle) -------------
  UI.runPasswordMiniGame = function () {
    PQ.sfx.play('questionIn');
    const rules = PQ.PASSWORD_RULES;
    const rulesEl = $('pw-rules');
    rulesEl.innerHTML = '';
    const ruleEls = rules.map((r) => {
      const el = document.createElement('div');
      el.className = 'pw-rule';
      el.innerHTML = `<span class="pw-rule-dot">○</span><span>${r.label}</span>`;
      rulesEl.appendChild(el);
      return el;
    });
    const input = $('pw-input');
    const submit = $('btn-pw-submit');
    const fill = $('pw-strength-fill');
    input.value = '';
    submit.disabled = true;
    fill.style.width = '0%';

    show('pw-modal');
    setTimeout(() => input.focus(), 100);

    const question = {
      layer: 'PASSWORD',
      topic: 'Password Strength Builder',
      q: 'Did you build a strong password?',
      a: ['Built a strong password', 'Skipped without meeting all rules'],
      correct: 0,
      why: 'Strong passwords are 12+ characters, mix uppercase / lowercase / numbers / symbols, and aren\'t common words. Length matters most. Use a different one for every account.'
    };

    return new Promise((resolve) => {
      let finished = false;
      function recheck() {
        const v = input.value;
        let met = 0;
        rules.forEach((r, i) => {
          const ok = !!v && r.test(v);
          if (ok) met++;
          ruleEls[i].classList.toggle('met', ok);
          ruleEls[i].querySelector('.pw-rule-dot').textContent = ok ? '●' : '○';
        });
        fill.style.width = (100 * met / rules.length) + '%';
        submit.disabled = met < rules.length;
      }
      input.addEventListener('input', recheck);

      function commit(skipped) {
        if (finished) return;
        finished = true;
        submit.disabled = true;
        input.disabled = true;
        const correct = !skipped;
        setTimeout(() => {
          hide('pw-modal');
          input.disabled = false;
          input.removeEventListener('input', recheck);
          document.removeEventListener('keydown', keyHandler);
          resolve({ correct, chosen: correct ? 0 : 1, question });
        }, 700);
      }
      submit.addEventListener('click', () => { PQ.sfx.play('select'); commit(false); }, { once: true });
      function keyHandler(e) {
        if (finished) return;
        if (e.code === 'Enter' && !submit.disabled) { e.preventDefault(); commit(false); }
        if (e.code === 'Escape') { commit(true); }
      }
      document.addEventListener('keydown', keyHandler);
    });
  };

  // ---- Generic file/info sorter (Malware + Privacy mini-games) ----------
  // Reusable: every item is a card with two action buttons. After a sort
  // commit, reveal correctness and resolve.
  function runSorter({ modalId, gridId, judgeBtnId, items, leftLabel, leftCorrect, rightLabel, layer, topic, why, threshold }) {
    PQ.sfx.play('questionIn');
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    const judge = document.getElementById(judgeBtnId);
    judge.disabled = true;

    // Each item gets choice 'left' or 'right'; correctChoice is determined by the
    // item's safe/share boolean (true → leftCorrect, false → other).
    const state = items.map((item) => ({ item, choice: null }));

    state.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'mg-sort-card';
      card.innerHTML = `
        <div class="mg-sort-name">${s.item.name || s.item.text}</div>
        <div class="mg-sort-buttons">
          <button class="mg-sort-btn mg-sort-left"  data-choice="left">${leftLabel}</button>
          <button class="mg-sort-btn mg-sort-right" data-choice="right">${rightLabel}</button>
        </div>`;
      grid.appendChild(card);
      const buttons = card.querySelectorAll('.mg-sort-btn');
      buttons.forEach((b) => b.addEventListener('click', () => {
        s.choice = b.dataset.choice;
        buttons.forEach((bb) => bb.classList.toggle('chosen', bb === b));
        PQ.sfx.play('select');
        if (state.every((x) => x.choice !== null)) judge.disabled = false;
      }));
    });

    show(modalId);

    const question = {
      layer, topic,
      q: `Did you sort all ${items.length} correctly?`,
      a: ['Sorted correctly', 'Got some wrong'],
      correct: 0,
      why
    };

    return new Promise((resolve) => {
      let finished = false;
      function commit() {
        if (finished) return;
        finished = true;
        judge.disabled = true;
        let right = 0;
        const cards = grid.querySelectorAll('.mg-sort-card');
        state.forEach((s, i) => {
          const card = cards[i];
          const correctChoice = (leftCorrect(s.item)) ? 'left' : 'right';
          const ok = s.choice === correctChoice;
          card.classList.add(ok ? 'right-pick' : 'wrong-pick');
          if (s.item.hint) {
            const hint = document.createElement('div');
            hint.className = 'mg-sort-hint';
            hint.textContent = (ok ? '✓ ' : '✗ ') + s.item.hint;
            card.appendChild(hint);
          }
          if (ok) right++;
        });
        const overallCorrect = right >= (threshold || items.length - 1);
        setTimeout(() => {
          hide(modalId);
          resolve({ correct: overallCorrect, chosen: 0, question: { ...question, why: why + ` You got ${right} of ${items.length}.` } });
        }, 1800);
      }
      judge.addEventListener('click', () => { PQ.sfx.play('select'); commit(); }, { once: true });
    });
  }

  UI.runMalwareMiniGame = function () {
    return runSorter({
      modalId: 'mw-modal',
      gridId: 'mw-grid',
      judgeBtnId: 'btn-mw-judge',
      items: PQ.MALWARE_FILES,
      leftLabel: '✓ TRUST',
      leftCorrect: (item) => item.safe === true,
      rightLabel: '🗑️ DELETE',
      layer: 'MALWARE',
      topic: 'Safe vs Malware Sorter',
      why: 'Files like .exe and .scr from unknown senders or "free Robux / free crack" sources are almost always malware. Trusted sources, normal extensions (.docx, .pdf, .jpg) from people you know are safe.',
      threshold: 5
    });
  };

  UI.runPrivacyMiniGame = function () {
    return runSorter({
      modalId: 'pv-modal',
      gridId: 'pv-grid',
      judgeBtnId: 'btn-pv-judge',
      items: PQ.PRIVACY_INFO.map(x => ({ ...x, name: x.text })),
      leftLabel: '🌐 OK TO SHARE',
      leftCorrect: (item) => item.share === true,
      rightLabel: '🔒 KEEP PRIVATE',
      layer: 'PRIVACY',
      topic: 'Share or Keep Private',
      why: 'Personal info — home address, school name, phone number — should always stay private online. Things like favorite games, movies, or memes are fine to share. The rule: if it can find you in real life, keep it private.',
      threshold: 5
    });
  };

  // ---- Ransomware Decision (Ransomware Vault) ---------------------------
  UI.runRansomwareMiniGame = function () {
    PQ.sfx.play('questionIn');
    const data = PQ.RANSOMWARE_DECISION;
    $('rw-lockscreen').textContent = data.lockMessage;
    const payBtn = $('btn-rw-pay');
    const restoreBtn = $('btn-rw-restore');
    const outcomeEl = $('rw-outcome');
    payBtn.disabled = false;
    restoreBtn.disabled = false;
    outcomeEl.textContent = '';
    outcomeEl.className = 'rw-outcome';
    show('rw-modal');

    const question = {
      layer: 'RANSOMWARE',
      topic: 'Pay or Restore Decision',
      q: 'Did you make the right call?',
      a: ['Restored from backup', 'Paid the ransom'],
      correct: 0,
      why: 'NEVER pay a ransom. About half the people who pay never get their files back, and every payment funds the next attack. Backups are the answer — that\'s why companies and schools should always keep them.'
    };

    return new Promise((resolve) => {
      let finished = false;
      function decide(action /* 'pay' | 'restore' */) {
        if (finished) return;
        finished = true;
        payBtn.disabled = true;
        restoreBtn.disabled = true;
        const opt = data.options[action];
        outcomeEl.textContent = opt.outcome;
        outcomeEl.classList.add(action === data.correct ? 'right' : 'wrong');
        const correct = action === data.correct;
        setTimeout(() => {
          hide('rw-modal');
          resolve({ correct, chosen: correct ? 0 : 1, question });
        }, 1800);
      }
      payBtn.addEventListener('click', () => { PQ.sfx.play('select'); decide('pay'); }, { once: true });
      restoreBtn.addEventListener('click', () => { PQ.sfx.play('select'); decide('restore'); }, { once: true });
    });
  };

  // ---- Feedback panel ----------------------------------------------------
  // Returns a Promise that resolves when the user clicks CONTINUE (or presses
  // Enter/Space). No auto-dismiss — players read the explanation at their
  // own pace, which is the whole point of the post-question explanation.
  UI.showFeedback = function ({ correct, badgeLabel, badgeName, badgeEffect, explain, correctAnswer }) {
    const fb = $('feedback-overlay');
    fb.classList.remove('correct', 'wrong');
    fb.classList.add(correct ? 'correct' : 'wrong');
    $('fb-stamp').textContent = correct ? 'CORRECT' : 'WRONG';
    // Badge card — label (small caps) / name (big, networking term) / effect (small).
    const msgEl = $('fb-msg');
    if (badgeName) {
      msgEl.innerHTML =
        `<div class="fb-msg-label">${badgeLabel || (correct ? 'POWER-UP' : 'PENALTY')}</div>` +
        `<div class="fb-msg-name">${badgeName}</div>` +
        (badgeEffect ? `<div class="fb-msg-effect">${badgeEffect}</div>` : '');
      msgEl.classList.add('has-badge');
    } else {
      msgEl.innerHTML = '';
      msgEl.classList.remove('has-badge');
    }
    const ansEl = $('fb-answer');
    if (!correct && correctAnswer) {
      ansEl.textContent = 'CORRECT ANSWER — ' + correctAnswer;
      ansEl.classList.add('visible');
    } else {
      ansEl.textContent = '';
      ansEl.classList.remove('visible');
    }
    $('fb-explain').textContent = explain || '';
    show('feedback-overlay');

    if (correct) {
      PQ.confetti(60);
      PQ.fx.flash('rgba(94, 255, 154, 0.35)', 500);
    } else {
      PQ.fx.glitch(400);
      PQ.fx.flash('rgba(255, 90, 122, 0.35)', 400);
      PQ.fx.add(0.6);
    }

    return new Promise((resolve) => {
      const btn = $('btn-feedback-continue');
      const onClick = () => {
        btn.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        hide('feedback-overlay');
        PQ.sfx.play('select');
        resolve();
      };
      const onKey = (e) => {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') onClick();
      };
      btn.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
    });
  };

  // ---- Professor Mode list ----------------------------------------------
  UI.showProfessorPanel = function () {
    renderProfessorList('BEGINNER');
    show('professor-screen');
  };
  function renderProfessorList(difficulty) {
    const container = $('prof-list');
    container.innerHTML = '';
    const set = PQ.QUESTION_SETS[difficulty];
    if (!set) return;
    const order = ['PHISHING', 'PASSWORD', 'MALWARE', 'PRIVACY', 'RANSOMWARE'];
    for (const layer of order) {
      const title = document.createElement('div');
      title.className = 'prof-layer-title';
      title.textContent = PQ.LAYERS[layer].label;
      container.appendChild(title);
      for (const q of set[layer]) {
        const card = document.createElement('div');
        card.className = 'prof-q';
        const topic = document.createElement('div');
        topic.className = 'prof-q-topic';
        topic.textContent = `${q.topic} · ${q.id}`;
        const text = document.createElement('div');
        text.className = 'prof-q-text';
        text.textContent = q.q;
        const ul = document.createElement('ul');
        ul.className = 'prof-q-ans';
        const letters = ['A','B','C','D'];
        q.a.forEach((ans, i) => {
          const li = document.createElement('li');
          li.textContent = `${letters[i]}.  ${ans}`;
          if (i === q.correct) li.className = 'correct';
          ul.appendChild(li);
        });
        const why = document.createElement('div');
        why.className = 'prof-q-why';
        why.textContent = q.why;
        card.appendChild(topic);
        card.appendChild(text);
        card.appendChild(ul);
        card.appendChild(why);
        container.appendChild(card);
      }
    }
    // Tab highlighting
    document.querySelectorAll('.prof-tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.profDiff === difficulty);
    });
  }
  UI._renderProfessorList = renderProfessorList;

  // ---- Grade Report -------------------------------------------------------
  // Grade is computed against the TOTAL number of questions in the run (15),
  // not against "questions attempted". Skipping a level still drops the grade.
  UI.showEndScreen = function (stats) {
    const total = PQ.TOTAL_QUESTIONS || 15;
    const correct = stats.correct;
    const pct = Math.round(100 * correct / total);
    const { letter, note } = gradeFor(correct, total, stats);
    $('end-letter').textContent = letter;
    $('end-pct').textContent = `${correct} / ${total}  ·  ${pct}%`;
    $('end-comment').textContent = note;
    $('end-correct').textContent = `${correct} / ${total}`;
    $('end-packets').textContent = String(stats.packets);
    $('end-levels').textContent = `${stats.levelsComplete} / ${PQ.LEVEL_COUNT}`;
    $('end-lives').textContent = String(stats.lives);
    $('end-score').textContent = stats.score.toLocaleString();
    $('end-time').textContent = PQ.fmtTime(stats.runTimeSec);

    // Per-domain skill bars + plain-language strengths/needs summary.
    const topics = stats.topicBreakdown; // { PHISHING: {c,t}, ... }
    const bars = $('end-topic-bars');
    bars.innerHTML = '';
    const order = ['PHISHING', 'PASSWORD', 'MALWARE', 'PRIVACY', 'RANSOMWARE'];
    const FRIENDLY_DOMAIN = {
      PHISHING:   'spotting phishing',
      PASSWORD:   'password safety',
      MALWARE:    'avoiding malware',
      PRIVACY:    'protecting privacy',
      RANSOMWARE: 'handling ransomware'
    };
    const strengths = [];
    const needsWork = [];
    for (const k of order) {
      const { c = 0, t = 0 } = topics[k] || {};
      const p = t === 0 ? 0 : Math.round(100 * c / t);
      const row = document.createElement('div');
      row.className = 'topic-row';
      row.innerHTML = `
        <div class="topic-name">${PQ.LAYERS[k].short}</div>
        <div class="topic-bar"><div class="topic-bar-fill" style="width:0%"></div></div>
        <div class="topic-pct">${t ? p + '%' : '—'}</div>
      `;
      bars.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector('.topic-bar-fill').style.width = p + '%';
      });
      if (t > 0) {
        if (p >= 70) strengths.push(FRIENDLY_DOMAIN[k]);
        else if (p < 50) needsWork.push(FRIENDLY_DOMAIN[k]);
      }
    }

    // Plain-language summary like "Strong at spotting phishing, needs work on privacy."
    const summaryEl = $('end-summary');
    if (summaryEl) {
      const list = (arr) => arr.length === 1 ? arr[0]
                          : arr.length === 2 ? `${arr[0]} and ${arr[1]}`
                          : arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
      let txt = '';
      if (strengths.length) txt += `<b>Strong at:</b> ${list(strengths)}.`;
      if (needsWork.length) txt += (txt ? ' &nbsp;·&nbsp; ' : '') + `<b>Needs work:</b> ${list(needsWork)}.`;
      if (!txt) txt = 'Solid run across the board — review any domains scored below 70% for next time.';
      summaryEl.innerHTML = txt;
    }

    show('end-screen');
    // Reset save button so each run can save once
    const saveBtn = $('btn-save-score');
    if (saveBtn) {
      saveBtn.classList.remove('is-saved');
      saveBtn.textContent = '🏆 SAVE TO LEADERBOARD';
      saveBtn.disabled = false;
    }
    // Prefill name with last-used value for friction-free repeat play
    const nameInput = $('end-student-input');
    if (nameInput) {
      try {
        const last = localStorage.getItem('pq_last_name') || '';
        nameInput.value = last;
      } catch (e) { nameInput.value = ''; }
      setTimeout(() => { nameInput.focus(); nameInput.select(); }, 120);
    }
    // Remember the computed stats for the save button handler
    UI._lastRunStats = { letter, pct, correct, total, stats };
    // Kick off a celebration for passing grades
    if (pct >= 73) { PQ.confetti(120); PQ.sfx.play('victory'); }
  };

  // Called when the user clicks SAVE TO LEADERBOARD on the grade report.
  UI.saveLastRunToLeaderboard = function () {
    if (!UI._lastRunStats) return false;
    const { letter, pct, correct, total, stats } = UI._lastRunStats;
    const nameInput = $('end-student-input');
    let name = (nameInput && nameInput.value || '').trim().slice(0, 20);
    if (!name) name = 'ANON';
    try { localStorage.setItem('pq_last_name', name); } catch (e) {}
    const entry = {
      name,
      letter,
      pct,
      correct,
      total,
      score: stats.score,
      packets: stats.packets,
      difficulty: stats.difficulty || 'INTERMEDIATE',
      timeSec: stats.runTimeSec || 0,
      ts: Date.now()
    };
    const result = Leaderboard.add(entry);
    // Confirm visually on the button, with a distinct message if this run
    // didn't beat the player's prior best at this difficulty.
    const saveBtn = $('btn-save-score');
    if (saveBtn) {
      saveBtn.classList.add('is-saved');
      let label;
      if (result && result.status === 'improved')      label = '✓ NEW BEST  ·  ' + name.toUpperCase();
      else if (result && result.status === 'kept-old') label = '✓ PRIOR BEST KEPT  ·  ' + name.toUpperCase();
      else                                              label = '✓ SAVED  ·  ' + name.toUpperCase();
      saveBtn.textContent = label;
    }
    return true;
  };

  // ---- Leaderboard panel ------------------------------------------------
  let currentLBFilter = 'ALL';
  UI.showLeaderboard = function () {
    currentLBFilter = 'ALL';
    renderLeaderboard();
    show('leaderboard-screen');
    // Re-render after disk-bootstrap completes in case it finished late.
    if (Leaderboard.loadAsync) {
      Leaderboard.loadAsync().then(() => renderLeaderboard()).catch(() => {});
    }
  };

  function renderLeaderboard() {
    const list = $('lb-list');
    list.innerHTML = '';
    const all = Leaderboard.load();
    // ALL tab → one row per person (best run across all tiers).
    // Per-tier tab → filter first, then already one row per person at that tier.
    let filtered;
    if (currentLBFilter === 'ALL') {
      filtered = sortEntries(dedupKeepBest(all, nameOnlyKey));
    } else {
      filtered = all.filter(e => e.difficulty === currentLBFilter);
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.textContent = currentLBFilter === 'ALL'
        ? 'No runs saved yet. Finish a run and sign the report card to appear here.'
        : 'No runs on this difficulty yet.';
      list.appendChild(empty);
    } else {
      filtered.slice(0, 100).forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        if (i === 0) row.classList.add('is-top1');
        else if (i === 1) row.classList.add('is-top2');
        else if (i === 2) row.classList.add('is-top3');
        // letter → class-safe suffix (A+ → Aplus)
        const cls = 'lb-grade-' + String(e.letter).replace('+','plus').replace('-','minus').replace('−','minus');
        const dateStr = e.ts ? new Date(e.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
        row.innerHTML = `
          <div class="lb-rank">#${i + 1}</div>
          <div class="lb-name">${escapeHTML(e.name)}</div>
          <div class="lb-grade ${cls}">${e.letter}</div>
          <div class="lb-correct">${e.correct}/${e.total}</div>
          <div class="lb-score">${Number(e.score).toLocaleString()}</div>
          <div class="lb-diff lb-diff-${e.difficulty}">${e.difficulty}</div>
          <div class="lb-date">${dateStr}</div>
        `;
        list.appendChild(row);
      });
    }
    // Highlight the right tab
    document.querySelectorAll('.lb-tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.lbFilter === currentLBFilter);
    });
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  UI._renderLeaderboard = renderLeaderboard;
  UI._setLBFilter = (f) => { currentLBFilter = f; renderLeaderboard(); };

  // Grade thresholds — keyed to raw correct count out of 15 total questions,
  // matching the professor's distribution table exactly. Anyone can tweak the
  // sentences in GRADE_REMARKS below without touching the logic.
  // Per-grade remark shown on the report card. One remark per tier.
  const GRADE_REMARKS = {
    'A+': ['Outstanding cyber awareness across every threat.'],
    'A':  ['Strong cyber awareness — confident and consistent across the board.'],
    'A-': ['Strong cyber awareness — a few areas worth a quick review.'],
    'B+': ['Solid cyber awareness with one or two soft spots to revisit.'],
    'B':  ['Solid cyber awareness — review the topics flagged below.'],
    'B-': ['Decent cyber awareness — focus on the weakest domain to level up.'],
    'C+': ['Mixed results — multiple domains need a refresher.'],
    'C':  ['Mixed results — multiple domains need a refresher.'],
    'C-': ['Mixed results — multiple domains need a refresher.'],
    'D':  ['Important gaps in cyber awareness. Worth a focused conversation.'],
    'F':  ['Significant gaps in cyber awareness. Take it as a sign to start the conversation now — every kid starts somewhere.']
  };
  UI.GRADE_REMARKS = GRADE_REMARKS;

  function gradeFor(correct, total) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    // Thresholds on raw correct count out of 15 (per professor's table).
    // Scale proportionally if total ever changes (unlikely).
    const scale = total / 15;
    const t = (n) => Math.ceil(n * scale);
    let letter = 'F';
    if      (correct >= t(15)) letter = 'A+';
    else if (correct >= t(13)) letter = 'A';
    else if (correct >= t(11)) letter = 'A-';
    else if (correct >= t(10)) letter = 'B+';
    else if (correct >= t(9))  letter = 'B';
    else if (correct >= t(8))  letter = 'B-';
    else if (correct >= t(7))  letter = 'C+';
    else if (correct >= t(6))  letter = 'C';
    else if (correct >= t(5))  letter = 'C-';
    else if (correct >= t(4))  letter = 'D';
    return { letter, note: pick(GRADE_REMARKS[letter] || GRADE_REMARKS.F) };
  }
  UI.gradeFor = gradeFor;

  // ---- wire up static buttons --------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        hide(btn.dataset.close);
        show('title-screen');
        PQ.sfx.play('select');
      });
    });

    $('btn-howto').addEventListener('click', () => {
      hide('title-screen'); show('howto-screen'); PQ.sfx.play('select');
    });
    $('btn-credits').addEventListener('click', () => {
      hide('title-screen'); show('credits-screen'); PQ.sfx.play('select');
    });
    const profBtn = $('btn-professor');
    if (profBtn) profBtn.addEventListener('click', () => {
      hide('title-screen');
      UI.showProfessorPanel();
      PQ.sfx.play('select');
    });
    // Professor tab switching
    document.querySelectorAll('.prof-tab').forEach(t => {
      t.addEventListener('click', () => {
        PQ.sfx.play('select');
        renderProfessorList(t.dataset.profDiff);
      });
    });
  });

  PQ.UI = UI;
})();
