// ============================================================================
// scenarios.js — Stop & Think cards.
// ----------------------------------------------------------------------------
// Real-world cyber-awareness scenarios. Mid-level a special block opens one
// of these — gameplay pauses, the kid reads the situation, picks one of four
// options. Correct answer behaves like a regular question correct (power-up,
// score, breakdown). Wrong answer behaves like a regular wrong (penalty +
// explanation).
//
// 5 scenarios — one per threat domain. Indexed via opts.index on the
// QuestionBlock with kind: 'scenario'. Each scenario has a `layer` field so
// the parent topic-breakdown updates correctly.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  const SCENARIOS = [
    {
      id: 'S-1', layer: 'PHISHING',
      title: 'Stop and Think — The Suspicious DM',
      situation: 'You\'re playing a game. A stranger DMs you: "I\'m a developer, I can give you the rare item if you log into this site with your account." There\'s a link.',
      q: 'What do you do?',
      a: [
        'Log in — getting a rare item is worth it',
        'Send your password instead, then they can do it for you',
        'Ignore the message and report the user. No real developer ever asks for your login',
        'Click the link first to see if it looks real'
      ],
      correct: 2,
      why: 'No real game developer ever asks for your account login through a DM. Even just visiting the link can be dangerous. Block, report, and move on.'
    },
    {
      id: 'S-2', layer: 'PASSWORD',
      title: 'Stop and Think — The Friend\'s Favor',
      situation: 'Your best friend asks: "Hey, can I use your Roblox account this weekend? My account got banned and I want to play. I promise I won\'t change anything."',
      q: 'What\'s the right move?',
      a: [
        'Give them the password — they\'re your best friend',
        'Say no — sharing your password (even with friends) is how accounts get hijacked, and you\'d be responsible if their ban-worthy behavior happens on your account',
        'Give them only the password but not the username',
        'Change your password to something easy first, then share it'
      ],
      correct: 1,
      why: 'Even with friends you trust, password sharing is a bad idea. If they do something against the rules on your account, your account gets banned. Real friends understand a "no" here.'
    },
    {
      id: 'S-3', layer: 'MALWARE',
      title: 'Stop and Think — The "Free" Game Crack',
      situation: 'You really want a game that costs $40, but a YouTube video shows a "free crack" — just download an .exe from a site you\'ve never heard of. The video has 10,000 likes.',
      q: 'What do you do?',
      a: [
        'Download it — 10,000 likes means it\'s safe',
        'Download it but turn off your antivirus first (so it doesn\'t complain)',
        'Don\'t download it. Free "cracks" of paid games are one of the most reliable ways to get malware — likes can be fake or paid',
        'Try it on your parents\' computer first'
      ],
      correct: 2,
      why: 'Free game cracks are textbook malware delivery. Likes and comments can be bots. If you really want the game, save up — the $40 is much cheaper than the damage from malware.'
    },
    {
      id: 'S-4', layer: 'PRIVACY',
      title: 'Stop and Think — The Online Friend',
      situation: 'You\'ve been chatting with someone online for two months. They seem really cool. Today they ask: "Hey, what\'s your school name? And can you send me a picture of you in your uniform? I want to imagine where you go."',
      q: 'What\'s your move?',
      a: [
        'Send the photo and tell them — they\'ve been a friend for 2 months',
        'Send the school name but not the photo',
        'Stop and tell a parent or trusted adult. Asking for school + uniform photo is a serious red flag, no matter how long you\'ve chatted',
        'Send just the photo, but blur your face'
      ],
      correct: 2,
      why: 'Two months of chatting doesn\'t make someone safe. Asking for the school name + a uniform photo is a known grooming tactic — they want to find you in real life. Tell a trusted adult right away.'
    },
    {
      id: 'S-5', layer: 'RANSOMWARE',
      title: 'Stop and Think — The School Computer',
      situation: 'You log in to a school computer to do homework. The screen suddenly turns red and says: "ALL SCHOOL FILES ARE LOCKED. Pay $1000 in 24 hours or everything is deleted."',
      q: 'What\'s the right response?',
      a: [
        'Try to find $1000 to pay, fast',
        'Tell the teacher and IT immediately, do not pay, and do not touch anything else on that computer',
        'Restart the computer until the message goes away',
        'Email the attackers to negotiate a lower price'
      ],
      correct: 1,
      why: 'Schools have backups. Telling adults fast helps stop the ransomware from spreading to other school computers. Never pay — paying funds the criminals to attack the next school.'
    }
  ];

  PQ.SCENARIOS = SCENARIOS;

  // Index lookup — opts.index on a QuestionBlock with kind:'scenario' selects
  // which scenario fires. Defaults wrap around so out-of-range stays safe.
  PQ.getScenarioForBlock = function (index) {
    const i = ((index % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length;
    return SCENARIOS[i];
  };

  try { console.log(`[CQ] ${SCENARIOS.length} Stop and Think scenarios loaded`); } catch (e) {}
})();
