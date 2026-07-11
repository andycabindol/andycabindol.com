/**
 * CreamyOrb — animated noise overlay (transform-only).
 */
(function initCreamyOrbModule() {
  const activeOrbs = new Set();

  function initCreamyOrb(root) {
    if (!root || root.dataset.creamyOrbInit === 'true') {
      return;
    }

    root.dataset.creamyOrbInit = 'true';

    const noise = root.querySelector('.creamy-orb__noise');
    if (!noise || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let offsetX = Math.random() * 40;
    let offsetY = Math.random() * 40;
    let frame = 0;
    let rafId = 0;
    let running = true;

    function tick() {
      if (!running || !root.isConnected) {
        activeOrbs.delete(stop);
        return;
      }

      frame += 1;
      offsetX = (offsetX + 0.85) % 120;
      offsetY = (offsetY + 0.7) % 120;
      const wobble = Math.sin(frame * 0.05) * 2.2;
      noise.style.transform = `translate3d(${offsetX + wobble}px, ${offsetY - wobble}px, 0)`;
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
      activeOrbs.delete(stop);
    }

    activeOrbs.add(stop);
    rafId = requestAnimationFrame(tick);
  }

  function initAll() {
    document.querySelectorAll('.creamy-orb:not([data-creamy-orb-init])').forEach(initCreamyOrb);
  }

  window.CreamyOrb = {
    init: initCreamyOrb,
    initAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
