// ============================================================================
// whitelabel.js — Single-file white-label config for Cyber Quest.
// ----------------------------------------------------------------------------
// To rebrand the entire app for a new partner / school / customer:
//   1. Edit the values inside the WHITELABEL block below.
//   2. Refresh the app (Cmd+R).
// That's it — no build step, no rebuild. Demo flip in <10 seconds.
//
// Visible touchpoints:
//   • Title screen logo, badge line, tagline, footer
//   • Credits panel app-name
//   • End-of-run report header subtitle
//   • Accent color CSS variable (--whitelabel-accent)
// ============================================================================
(function () {

  // ============================ EDIT BELOW ===============================
  const WHITELABEL = {
    appName:        'Cyber Quest',
    badge:          'CYBER AWARENESS · FOR EVERY KID',
    tagline:        'The internet doesn\'t protect itself. A journey through the 5 cyber threats every kid should beat.',
    presentedBy:    'A Cyber Awareness Tool for Children',
    endReportSub:   'CYBER QUEST · CYBER AWARENESS REPORT',
    primaryColor:   '#6bf0ff'
  };
  // ============================ STOP EDITING =============================


  window.CQ_WHITELABEL = WHITELABEL;

  function applyText(id, val) {
    const el = document.getElementById(id);
    if (!el || val == null) return;
    el.textContent = val;
    if (id === 'title-logo') el.setAttribute('data-text', val);
  }

  function apply() {
    applyText('title-logo',          WHITELABEL.appName);
    applyText('title-badge',         WHITELABEL.badge);
    applyText('title-sub',           WHITELABEL.tagline);
    applyText('title-presented-by',  WHITELABEL.presentedBy);
    applyText('end-sub',             WHITELABEL.endReportSub);
    applyText('credits-title',       WHITELABEL.appName);
    if (WHITELABEL.primaryColor) {
      document.documentElement.style.setProperty('--whitelabel-accent', WHITELABEL.primaryColor);
    }
    // Window title (Electron)
    try { document.title = WHITELABEL.appName; } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  // ---------------------------------------------------------------------------
  // HOSN splash — waits for the user to click anywhere or press Enter, then
  // fades out. No auto-advance, so the booth presenter controls timing.
  // ---------------------------------------------------------------------------
  function runSplash() {
    const splash = document.getElementById('hosn-splash');
    if (!splash) return;

    // Partner splash is opt-in via the URL, e.g. ?partner=hosn
    // The public page stays unbranded so no logo implies an endorsement.
    const partner = new URLSearchParams(location.search).get('partner');
    if (partner !== 'hosn') {
      splash.classList.add('removed');
      return;
    }
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      console.log('[CQ] HOSN splash dismissed — entering title screen.');
      splash.classList.add('fade-out');
      setTimeout(() => splash.classList.add('removed'), 700);
      document.removeEventListener('keydown', onKey, true);
      splash.removeEventListener('click', dismiss);
    }
    function onKey(e) {
      if (dismissed) return;
      // Any key works, but Enter / Space / Escape are the obvious ones.
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismiss();
      }
    }
    splash.addEventListener('click', dismiss);
    // Use capture so we get the keydown before any game-input handlers grab it.
    document.addEventListener('keydown', onKey, true);
    console.log('[CQ] HOSN splash ready — click or press Enter to continue.');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSplash);
  } else {
    runSplash();
  }
})();
