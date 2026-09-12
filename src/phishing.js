// ============================================================================
// phishing.js — Phishing Email sorter mini-game.
// ----------------------------------------------------------------------------
// THE mechanic-based learning loop. Replaces multiple choice with a real
// interaction: an envelope appears with sender, subject, body, and a link.
// The player taps each suspicious element they spot, then chooses REPORT or
// OPEN. The lesson IS the interaction.
//
// Scoring:
//   • Correctly flag suspicious elements + correctly REPORT  → CORRECT
//   • Miss any flag, OR press OPEN on a phishing email       → WRONG
//
// PQ.EMAILS is an array of email scenarios. PQ.getEmailForBlock(index) picks
// one. Each email exposes parts as { type, text, suspicious: bool, hint }.
// The UI renders parts; clicking one toggles its flagged state.
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  // The first email in the bank is the "demo flagship" — most polished, most
  // recognizable to kids. Good for the opening Phishing Lake encounter.
  const EMAILS = [
    {
      id: 'E-ROBLOX',
      from: { text: 'support@rob1ox-team.com', suspicious: true,
              hint: 'Sender domain is "rob1ox" with the digit 1 — Roblox would never use this domain.' },
      subject: { text: 'URGENT: Your Roblox account will be deleted in 24 hours!', suspicious: true,
                 hint: 'Urgency + threat of account deletion = classic phishing pressure tactic.' },
      body: [
        { text: 'Dear valued Roblox player,', suspicious: false },
        { text: 'We have detected suspicious activity on your account.', suspicious: false },
        { text: 'Click here immediately to verify your password — you have 24 hours or your account will be DELETED FOREVER.', suspicious: true,
          hint: 'Real companies never demand your password through a link, never on a 24-hour deadline.' },
        { text: 'Click this link to verify: http://r0blox-verify-login.ru/account', suspicious: true,
          hint: 'The URL has digit-zero in "r0blox" and ends in .ru — Roblox would never use that domain.' },
        { text: 'Thank you,\nRoblox Security Team', suspicious: false }
      ],
      verdict: 'phishing'
    },
    {
      id: 'E-AMAZON',
      from: { text: 'amaz0n-billing@gmail.com', suspicious: true,
              hint: 'Amazon would never email from a Gmail address. Plus "amaz0n" has a zero, not an "o".' },
      subject: { text: 'Payment Failed — Confirm Card Now', suspicious: true,
                 hint: 'Pressuring you to "confirm card now" is a standard phishing technique.' },
      body: [
        { text: 'Hello,', suspicious: false },
        { text: 'Your most recent Amazon order could not be charged.', suspicious: false },
        { text: 'Please CLICK BELOW within 6 hours to update your payment, or your order will be cancelled and your account locked.', suspicious: true,
          hint: 'Urgency + locking your account = pressure tactic. Real Amazon emails don\'t threaten lockouts.' },
        { text: 'Update payment: https://amazon-secure-billing.help', suspicious: true,
          hint: 'Real Amazon links go to amazon.com, never to a separate "amazon-secure-billing" domain.' },
        { text: 'Thanks,\nAmazon Billing', suspicious: false }
      ],
      verdict: 'phishing'
    },
    {
      id: 'E-FRIEND-OK',
      from: { text: 'mohammed.k@yourschool.edu', suspicious: false },
      subject: { text: 'Math homework — page 47', suspicious: false },
      body: [
        { text: 'Hey,', suspicious: false },
        { text: 'Did you understand question 3 on page 47? I got stuck on it.', suspicious: false },
        { text: 'Can you send me a photo of how you solved it? Tomorrow morning before class is fine.', suspicious: false },
        { text: 'Thanks!\nMohammed', suspicious: false }
      ],
      verdict: 'safe'
    }
  ];

  PQ.EMAILS = EMAILS;
  PQ.getEmailForBlock = function (index) {
    const i = ((index % EMAILS.length) + EMAILS.length) % EMAILS.length;
    return EMAILS[i];
  };

  try { console.log(`[CQ] ${EMAILS.length} phishing email scenarios loaded`); } catch (e) {}
})();
