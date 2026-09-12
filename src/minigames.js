// ============================================================================
// minigames.js — Data for the four non-phishing interactive mini-games.
// (The phishing email mini-game lives in src/phishing.js.)
//
//   PASSWORD CASTLE   → Password Strength Builder
//   MALWARE FOREST    → Safe vs Malware File Sorter
//   PRIVACY PLAZA     → Share vs Don't Share Sorter
//   RANSOMWARE VAULT  → Pay vs Restore Decision
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // ----- Password rule definitions used by the strength builder ----------
  PQ.PASSWORD_RULES = [
    { id: 'len',  label: '12+ characters',         test: (s) => s.length >= 12 },
    { id: 'up',   label: 'Uppercase letter',       test: (s) => /[A-Z]/.test(s) },
    { id: 'low',  label: 'Lowercase letter',       test: (s) => /[a-z]/.test(s) },
    { id: 'num',  label: 'A number (0-9)',         test: (s) => /[0-9]/.test(s) },
    { id: 'sym',  label: 'A symbol (!@#$ etc.)',   test: (s) => /[^A-Za-z0-9]/.test(s) },
    { id: 'safe', label: 'Not a common password',  test: (s) => {
        const bad = ['password','12345678','qwerty','letmein','iloveyou','admin','welcome'];
        const low = s.toLowerCase();
        return s.length > 0 && !bad.some(b => low.includes(b));
      }
    }
  ];

  // ----- Malware Forest: file cards (mix of safe + dangerous) -----------
  PQ.MALWARE_FILES = [
    { name: 'homework.docx',           safe: true,
      hint: 'A normal Word document — totally fine.' },
    { name: 'free_robux_generator.exe', safe: false,
      hint: '.exe from a "free Robux" source = textbook malware. There is no real Robux generator.' },
    { name: 'vacation_photos.zip',     safe: true,
      hint: 'A zip from someone you know with photos is normal.' },
    { name: 'minecraft_crack.scr',     safe: false,
      hint: '.scr is an executable disguised as a screensaver — common malware trick. Cracks are loaded with malware.' },
    { name: 'school_notes.pdf',        safe: true,
      hint: 'A normal PDF — fine.' },
    { name: 'invoice_unpaid.exe',      safe: false,
      hint: '.exe attached to an unexpected "invoice" = ransomware delivery.' }
  ];

  // ----- Privacy Plaza: information cards (share or private) ------------
  PQ.PRIVACY_INFO = [
    { text: 'My favorite video game',     share: true,
      hint: 'Favorite games are fine to share — they don\'t identify you.' },
    { text: 'My home address',            share: false,
      hint: 'Never. Strangers can find you in real life.' },
    { text: 'My school name',             share: false,
      hint: 'Never to strangers — they can find where you go every weekday.' },
    { text: 'My favorite movie',          share: true,
      hint: 'Favorites are fine — they don\'t lead anyone to you.' },
    { text: 'My phone number',            share: false,
      hint: 'Phone numbers can be used for scam calls and to find more about you.' },
    { text: 'A meme I drew',              share: true,
      hint: 'Sharing original drawings or memes is generally fine.' }
  ];

  // ----- Ransomware Vault: decision text -------------------------------
  PQ.RANSOMWARE_DECISION = {
    lockMessage: 'WARNING: ALL FILES LOCKED. Send $500 in Bitcoin within 24 hours or files will be deleted forever.',
    options: {
      pay:     { label: '💸 PAY $500',              outcome: 'Files still locked. Now they want $1500. Half the people who pay never get their files back.' },
      restore: { label: '💾 RESTORE FROM BACKUP',   outcome: 'Backup restored — clean files in minutes. The attackers got nothing.' }
    },
    correct: 'restore'
  };

  try { console.log('[CQ] minigames data loaded'); } catch (e) {}
})();
