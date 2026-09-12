// ============================================================================
// input.js — keyboard input with edge detection (pressed this frame vs held)
// ============================================================================
(function () {
  const PQ = window.PQ = window.PQ || {};

  const held = new Set();
  const pressedThisFrame = new Set();
  const releasedThisFrame = new Set();

  function keyName(e) {
    // Cyber Quest controls: arrow keys + space only. WASD and numeric answer
    // shortcuts removed — clearer for kids and forces interaction with the
    // on-screen UI.
    switch (e.code) {
      case 'ArrowLeft':  return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp':    return 'up';
      case 'ArrowDown':  return 'down';
      case 'Space':      return 'jump';
      case 'Escape':     return 'pause';
      case 'Enter':      return 'confirm';
      case 'KeyM':       return 'mute';
      default: return null;
    }
  }

  // If the user is currently typing into a text input, ignore game-key
  // bindings entirely — otherwise the player input field on the grade
  // report can't receive characters like W/A/S/D/M.
  function isTypingInInput(e) {
    const t = e.target;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingInInput(e)) return;
    const k = keyName(e);
    if (k) {
      if (!held.has(k)) pressedThisFrame.add(k);
      held.add(k);
      if (['jump', 'up', 'down', 'pause', 'confirm', 'ans1','ans2','ans3','ans4'].includes(k)) {
        e.preventDefault();
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (isTypingInInput(e)) return;
    const k = keyName(e);
    if (k) {
      if (held.has(k)) releasedThisFrame.add(k);
      held.delete(k);
    }
  });

  // When the window loses focus, forget any stuck keys (avoids "stuck moving" bug)
  window.addEventListener('blur', () => { held.clear(); });

  PQ.input = {
    isDown(k)    { return held.has(k); },
    wasPressed(k){ return pressedThisFrame.has(k); },
    wasReleased(k){ return releasedThisFrame.has(k); },
    // Call once per frame AFTER all consumers have read the edge state
    endFrame() { pressedThisFrame.clear(); releasedThisFrame.clear(); }
  };
})();
