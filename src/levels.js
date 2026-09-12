// ============================================================================
// levels.js — Cyber Quest: 5 short levels themed by cyber threat domain.
// Each level is ~3200px wide with exactly 3 question blocks at evenly spaced
// checkpoints. Designed for a fast demo (< 1 minute per level at pace).
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // ---- Level themes: palette + background style ---------------------------
  // Palette-to-domain mapping:
  //   PHISHING   → cyan/blue water (Phishing Lake)
  //   PASSWORD   → gold castle (Password Castle)
  //   MALWARE    → green corrupted forest (Malware Forest)
  //   PRIVACY    → magenta neon plaza (Privacy Plaza)
  //   RANSOMWARE → red/amber danger vault (Ransomware Vault)
  const THEMES = {
    PHISHING: {
      sky: ['#03112a', '#0a1f4a', '#031c3f'],
      platformFill: '#0a1a3a',
      platformEdge: '#6bf0ff',
      platformGlow: '#6bf0ff',
      accent: '#ffd15a',
      bgStyle: 'phishingLake',
      decorFg: '#6bf0ff',
      ambient: 'rgba(107, 240, 255, 0.14)'
    },
    PASSWORD: {
      sky: ['#06061a', '#1a113b', '#0b0418'],
      platformFill: '#1a1434',
      platformEdge: '#ffd15a',
      platformGlow: '#ffd15a',
      accent: '#ff6bd6',
      bgStyle: 'passwordCastle',
      decorFg: '#ffd15a',
      ambient: 'rgba(255, 209, 90, 0.12)'
    },
    MALWARE: {
      sky: ['#050f0b', '#0d1e14', '#051a10'],
      platformFill: '#0a2418',
      platformEdge: '#b9ff6b',
      platformGlow: '#b9ff6b',
      accent: '#5eff9a',
      bgStyle: 'malwareForest',
      decorFg: '#5eff9a',
      ambient: 'rgba(185, 255, 107, 0.12)'
    },
    PRIVACY: {
      sky: ['#12041c', '#2a0a3c', '#1a0624'],
      platformFill: '#1f0a2e',
      platformEdge: '#ff6bd6',
      platformGlow: '#ff6bd6',
      accent: '#b0c7ff',
      bgStyle: 'privacyPlaza',
      decorFg: '#ff6bd6',
      ambient: 'rgba(255, 107, 214, 0.14)'
    },
    RANSOMWARE: {
      sky: ['#1a0408', '#3a0a14', '#1f0506'],
      platformFill: '#2a0a14',
      platformEdge: '#ff5a7a',
      platformGlow: '#ff5a7a',
      accent: '#ffd15a',
      bgStyle: 'ransomwareVault',
      decorFg: '#ff5a7a',
      ambient: 'rgba(255, 90, 122, 0.18)'
    }
  };

  function tile(x, y, w, h) { return { x, y, w, h, solid: true }; }

  const BUILDERS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5];
  PQ.buildLevel = function (index) {
    const b = BUILDERS[index - 1];
    if (!b) return null;
    return b();
  };
  PQ.LEVEL_COUNT = BUILDERS.length;

  // Common world width
  const W = 3200;

  // ==========================================================================
  // LEVEL 1 — PHISHING LAKE
  // ==========================================================================
  function buildLevel1() {
    const tiles = [], enemies = [], packets = [], questions = [], hazards = [];
    const GROUND_Y = 620;

    const gaps = [[900, 1020], [2150, 2290]];
    let cursor = 0;
    for (const [a, b] of gaps) {
      tiles.push(tile(cursor, GROUND_Y, a - cursor, 120));
      cursor = b;
    }
    tiles.push(tile(cursor, GROUND_Y, W - cursor, 120));

    tiles.push(tile(400, 520, 120, 20));
    tiles.push(tile(640, 460, 120, 20));
    tiles.push(tile(830, 470, 120, 20));

    tiles.push(tile(950, 520, 80, 20));

    tiles.push(tile(1300, 500, 120, 20));
    tiles.push(tile(1480, 430, 140, 20));
    tiles.push(tile(1680, 500, 100, 20));

    tiles.push(tile(1900, 520, 120, 20));
    tiles.push(tile(2080, 470, 120, 20));
    tiles.push(tile(2280, 520, 120, 20));
    tiles.push(tile(2480, 460, 140, 20));
    tiles.push(tile(2700, 500, 140, 20));

    tiles.push(tile(0, -60, W, 20));

    // Block order: regular MCQ → Stop & Think → interactive mini-game.
    questions.push(new PQ.QuestionBlock(860, 380, { topic: 'Phishing Quick Quiz', index: 0 }));
    questions.push(new PQ.QuestionBlock(1520, 340, { topic: 'Stop and Think',    index: 0, kind: 'scenario' }));
    questions.push(new PQ.QuestionBlock(2520, 370, { topic: 'Phishing Email',    index: 0, kind: 'minigame' }));

    enemies.push(new PQ.BugWalker(270,  460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(480,  460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(800,  460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(1080, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1400, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1700, 472, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2050, 460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2200, 472, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2560, 432, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2800, 460, { dir: -1 }));

    const pcs = [
      [420, 480],[500, 480],[660, 420],[740, 420],
      [1310, 460],[1380, 460],[1500, 390],[1580, 390],
      [1920, 480],[2100, 430],[2300, 480],[2500, 420],[2720, 460]
    ];
    for (const [x, y] of pcs) packets.push(new PQ.Packet(x, y));

    return {
      id: 1,
      name: 'PHISHING LAKE',
      tagline: 'Spot the bait · Fake senders · Suspicious links',
      layer: 'PHISHING',
      theme: THEMES.PHISHING,
      width: W, height: 720,
      playerStart: { x: 180, y: 500 },
      tiles, hazards, enemies, packets, questions,
      portal: new PQ.Portal(W - 220, GROUND_Y - 90)
    };
  }

  // ==========================================================================
  // LEVEL 2 — PASSWORD CASTLE
  // ==========================================================================
  function buildLevel2() {
    const tiles = [], enemies = [], packets = [], questions = [], hazards = [];
    const GROUND_Y = 620;

    const gaps = [[800, 940], [1900, 2060]];
    let cursor = 0;
    for (const [a, b] of gaps) {
      tiles.push(tile(cursor, GROUND_Y, a - cursor, 120));
      cursor = b;
    }
    tiles.push(tile(cursor, GROUND_Y, W - cursor, 120));

    tiles.push(tile(320, 520, 120, 18));
    tiles.push(tile(520, 470, 120, 18));
    tiles.push(tile(720, 510, 120, 18));

    tiles.push(tile(860, 530, 60, 18));

    tiles.push(tile(1100, 500, 120, 18));
    tiles.push(tile(1320, 450, 140, 18));
    tiles.push(tile(1540, 500, 120, 18));

    tiles.push(tile(1780, 510, 120, 18));
    tiles.push(tile(2100, 510, 120, 18));

    tiles.push(tile(2280, 470, 140, 18));
    tiles.push(tile(2500, 510, 140, 18));
    tiles.push(tile(2740, 460, 160, 18));

    tiles.push(tile(0, -60, W, 20));

    questions.push(new PQ.QuestionBlock(750, 410, { topic: 'Password Quick Quiz', index: 0 }));
    questions.push(new PQ.QuestionBlock(1370, 360, { topic: 'Stop and Think',     index: 1, kind: 'scenario' }));
    questions.push(new PQ.QuestionBlock(2540, 420, { topic: 'Password Builder',   index: 0, kind: 'minigame' }));

    enemies.push(new PQ.BugWalker(180,  460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(380,  460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(680,  460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(1000, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1400, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1750, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2150, 460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2400, 460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2780, 432, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2950, 460, { dir: -1 }));

    const pcs = [
      [340, 480],[550, 430],[750, 470],
      [1120, 460],[1340, 410],[1560, 460],
      [1800, 470],[2120, 470],[2300, 430],[2520, 470],[2760, 420]
    ];
    for (const [x, y] of pcs) packets.push(new PQ.Packet(x, y));

    return {
      id: 2,
      name: 'PASSWORD CASTLE',
      tagline: 'Strong passwords · No reuse · Password managers',
      layer: 'PASSWORD',
      theme: THEMES.PASSWORD,
      width: W, height: 720,
      playerStart: { x: 180, y: 500 },
      tiles, hazards, enemies, packets, questions,
      portal: new PQ.Portal(W - 220, GROUND_Y - 90)
    };
  }

  // ==========================================================================
  // LEVEL 3 — MALWARE FOREST
  // ==========================================================================
  function buildLevel3() {
    const tiles = [], enemies = [], packets = [], questions = [], hazards = [];
    const GROUND_Y = 640;

    tiles.push(tile(0, GROUND_Y, 450, 120));
    tiles.push(tile(W - 450, GROUND_Y, 450, 120));

    tiles.push(tile(500, 560, 120, 18));
    tiles.push(tile(680, 500, 140, 18));
    tiles.push(tile(880, 470, 160, 18));

    tiles.push(tile(1100, 530, 120, 18));
    tiles.push(tile(1280, 470, 120, 18));
    tiles.push(tile(1460, 420, 160, 18));
    tiles.push(tile(1660, 470, 120, 18));

    tiles.push(tile(1860, 530, 120, 18));
    tiles.push(tile(2040, 480, 140, 18));
    tiles.push(tile(2240, 430, 140, 18));
    tiles.push(tile(2440, 480, 140, 18));
    tiles.push(tile(2640, 540, 160, 18));

    tiles.push(tile(0, -100, W, 20));

    questions.push(new PQ.QuestionBlock(920, 390, { topic: 'Malware Quick Quiz', index: 0 }));
    questions.push(new PQ.QuestionBlock(1500, 340, { topic: 'Stop and Think',    index: 2, kind: 'scenario' }));
    questions.push(new PQ.QuestionBlock(2280, 350, { topic: 'Safe vs Malware',   index: 0, kind: 'minigame' }));

    enemies.push(new PQ.BugWalker(300,  610, { dir: 1 }));
    enemies.push(new PQ.BugWalker(700,  472, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1500, 392, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1880, 502, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2660, 510, { dir: -1 }));
    enemies.push(new PQ.DroppedPacket(1300, 390, { amp: 90 }));

    const pcs = [
      [520, 530],[700, 470],[900, 440],
      [1120, 500],[1300, 440],[1480, 390],[1680, 440],
      [1880, 500],[2060, 450],[2260, 400],[2460, 450],[2660, 510]
    ];
    for (const [x, y] of pcs) packets.push(new PQ.Packet(x, y));

    return {
      id: 3,
      name: 'MALWARE FOREST',
      tagline: 'Sketchy downloads · Fake antivirus · USB traps',
      layer: 'MALWARE',
      theme: THEMES.MALWARE,
      width: W, height: 720,
      playerStart: { x: 180, y: 500 },
      tiles, hazards, enemies, packets, questions,
      portal: new PQ.Portal(W - 220, GROUND_Y - 90)
    };
  }

  // ==========================================================================
  // LEVEL 4 — PRIVACY PLAZA
  // ==========================================================================
  function buildLevel4() {
    const tiles = [], enemies = [], packets = [], questions = [], hazards = [];
    const GROUND_Y = 620;

    const gaps = [[700, 820], [1700, 1820], [2500, 2620]];
    let cursor = 0;
    for (const [a, b] of gaps) {
      tiles.push(tile(cursor, GROUND_Y, a - cursor, 120));
      cursor = b;
    }
    tiles.push(tile(cursor, GROUND_Y, W - cursor, 120));

    tiles.push(tile(260, 520, 180, 18));
    tiles.push(tile(480, 460, 180, 18));

    tiles.push(tile(860, 520, 140, 18));
    tiles.push(tile(1040, 450, 180, 18));
    tiles.push(tile(1260, 500, 160, 18));
    tiles.push(tile(1460, 440, 160, 18));
    tiles.push(tile(1660, 500, 60, 18));

    tiles.push(tile(1860, 500, 160, 18));
    tiles.push(tile(2080, 440, 160, 18));
    tiles.push(tile(2300, 500, 160, 18));

    tiles.push(tile(2660, 500, 140, 18));
    tiles.push(tile(2840, 450, 160, 18));

    tiles.push(tile(0, -100, W, 20));

    questions.push(new PQ.QuestionBlock(570, 380, { topic: 'Privacy Quick Quiz',     index: 0 }));
    questions.push(new PQ.QuestionBlock(1500, 360, { topic: 'Stop and Think',        index: 3, kind: 'scenario' }));
    questions.push(new PQ.QuestionBlock(2160, 360, { topic: 'Share or Keep Private', index: 0, kind: 'minigame' }));

    enemies.push(new PQ.BugWalker(150,  460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(300,  492, { dir: 1 }));
    enemies.push(new PQ.BugWalker(550,  460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(900,  460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(1200, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1500, 460, { dir: -1 }));
    enemies.push(new PQ.BugWalker(1900, 472, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2200, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2400, 460, { dir: 1 }));
    enemies.push(new PQ.BugWalker(2680, 472, { dir: -1 }));
    enemies.push(new PQ.DroppedPacket(1250, 380, { amp: 100 }));

    const pcs = [
      [280, 480],[500, 420],
      [880, 480],[1060, 410],[1280, 460],[1480, 400],
      [1880, 460],[2100, 400],[2320, 460],
      [2680, 460],[2860, 410]
    ];
    for (const [x, y] of pcs) packets.push(new PQ.Packet(x, y));

    return {
      id: 4,
      name: 'PRIVACY PLAZA',
      tagline: 'Personal info · Online strangers · Photos and metadata',
      layer: 'PRIVACY',
      theme: THEMES.PRIVACY,
      width: W, height: 720,
      playerStart: { x: 180, y: 500 },
      tiles, hazards, enemies, packets, questions,
      portal: new PQ.Portal(W - 220, GROUND_Y - 90)
    };
  }

  // ==========================================================================
  // LEVEL 5 — RANSOMWARE VAULT
  // ==========================================================================
  function buildLevel5() {
    const tiles = [], enemies = [], packets = [], questions = [], hazards = [];
    const GROUND_Y = 640;

    tiles.push(tile(0, GROUND_Y, 400, 120));
    tiles.push(tile(W - 400, GROUND_Y, 400, 120));

    const rooftops = [
      [440, 550, 160],[620, 490, 160],[800, 440, 160],[980, 400, 180],
      [1200, 450, 160],[1400, 500, 160],[1600, 460, 160],[1800, 410, 180],
      [2020, 470, 160],[2220, 520, 160],[2420, 470, 160],[2620, 420, 160],
      [2800, 480, 180]
    ];
    for (const [x, y, w] of rooftops) tiles.push(tile(x, y, w, 18));

    tiles.push(tile(0, -100, W, 20));

    questions.push(new PQ.QuestionBlock(1050, 320, { topic: 'Ransomware Quick Quiz', index: 0 }));
    questions.push(new PQ.QuestionBlock(1880, 330, { topic: 'Stop and Think',        index: 4, kind: 'scenario' }));
    questions.push(new PQ.QuestionBlock(2690, 340, { topic: 'Pay or Restore',        index: 0, kind: 'minigame' }));

    enemies.push(new PQ.BugWalker(460,  522, { dir: 1 }));
    enemies.push(new PQ.BugWalker(1030, 372, { dir: -1 }));
    enemies.push(new PQ.BugWalker(1640, 432, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2260, 492, { dir: -1 }));
    enemies.push(new PQ.BugWalker(2660, 392, { dir: -1 }));
    enemies.push(new PQ.DroppedPacket(1650, 390, { amp: 110 }));

    const pcs = [
      [460, 520],[640, 460],[820, 410],[1000, 370],
      [1220, 420],[1420, 470],[1620, 430],[1820, 380],
      [2040, 440],[2240, 490],[2440, 440],[2640, 390],[2820, 450]
    ];
    for (const [x, y] of pcs) packets.push(new PQ.Packet(x, y));

    return {
      id: 5,
      name: 'RANSOMWARE VAULT',
      tagline: 'Locked files · Ransom demands · Backups beat blackmail',
      layer: 'RANSOMWARE',
      theme: THEMES.RANSOMWARE,
      width: W, height: 720,
      playerStart: { x: 180, y: 500 },
      tiles, hazards, enemies, packets, questions,
      portal: new PQ.Portal(W - 220, GROUND_Y - 90)
    };
  }

  PQ.THEMES = THEMES;
})();
