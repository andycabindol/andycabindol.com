if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

const frameLoop = (() => {
  const tasks = new Set();
  let rafId = 0;

  function tick(time) {
    rafId = 0;
    for (const task of tasks) {
      task(time);
    }
    if (tasks.size > 0) {
      rafId = requestAnimationFrame(tick);
    }
  }

  return {
    add(task) {
      tasks.add(task);
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    },
    remove(task) {
      tasks.delete(task);
      if (tasks.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
  };
})();

function initSmoothScroll() {
  if (prefersReducedMotion) {
    return null;
  }
  if (typeof Lenis !== 'function') {
    return null;
  }
  if (window.__lenis) {
    return window.__lenis;
  }

  document.documentElement.classList.add('lenis');

  const lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
  });

  window.__lenis = lenis;

  function workFrameTask(time) {
    lenis.raf(time);
    window.__navUpdate?.();
  }

  window.__workFrameTask = workFrameTask;
  frameLoop.add(workFrameTask);

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') {
        return;
      }
      const target = document.querySelector(href);
      if (!target) {
        return;
      }
      event.preventDefault();
      lenis.scrollTo(target, { offset: -72 });
    });
  });

  return lenis;
}

const PLACEHOLDER_PALETTES = [
  ['#dce8fc', '#6ba8e8'],
  ['#eef4fc', '#4a8fd4'],
  ['#f5f5f5', '#cccccc'],
  ['#ebebeb', '#b3b3b3'],
  ['#e8e8e8', '#999999'],
  ['#f0f0f0', '#d4d4d4'],
  ['#dde8f5', '#5b8fc9'],
  ['#fafafa', '#e0e0e0'],
  ['#e5e5e5', '#a8a8a8'],
  ['#edf2f8', '#7aa3cc'],
];

function shuffleArray(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomizeProjectPlaceholders() {
  const placeholders = document.querySelectorAll('#work .project-placeholder');
  if (!placeholders.length) {
    return;
  }

  const palettes = shuffleArray(PLACEHOLDER_PALETTES);
  placeholders.forEach((placeholder, index) => {
    const [colorA, colorB] = palettes[index % palettes.length];
    placeholder.style.setProperty('--ph-a', colorA);
    placeholder.style.setProperty('--ph-b', colorB);
  });
}

let portfolioMasonryFrame = null;
let portfolioMasonryResizeObserver = null;

function measureCssLength(customProperty) {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;height:var(${customProperty});pointer-events:none;`;
  document.body.appendChild(probe);
  const length = probe.offsetHeight || 16;
  probe.remove();
  return length;
}

function getPortfolioGaps() {
  return {
    column: measureCssLength('--grid-gap'),
    row: measureCssLength('--grid-row-gap'),
  };
}

function getPortfolioColumnCount() {
  if (window.matchMedia('(max-width: 600px)').matches) {
    return 1;
  }
  if (window.matchMedia('(max-width: 900px)').matches) {
    return 2;
  }
  return 3;
}

function resetPortfolioMasonry(grid) {
  grid.removeAttribute('data-masonry');
  grid.style.height = '';
  grid.querySelectorAll('.project-item').forEach((item) => {
    item.style.position = '';
    item.style.width = '';
    item.style.left = '';
    item.style.top = '';
    item.style.visibility = '';
    item.style.pointerEvents = '';
  });
}

function layoutPortfolioMasonry() {
  const grid = document.querySelector('#work .portfolio-grid');
  if (!grid) {
    return;
  }

  const items = [...grid.querySelectorAll('.project-item')];
  if (!items.length) {
    return;
  }

  const { column: columnGap, row: rowGap } = getPortfolioGaps();
  const columns = getPortfolioColumnCount();
  resetPortfolioMasonry(grid);

  if (columns === 1) {
    return;
  }

  const gridWidth = grid.clientWidth;
  if (!gridWidth) {
    return;
  }

  const columnWidth = (gridWidth - columnGap * (columns - 1)) / columns;
  grid.style.position = 'relative';
  grid.dataset.masonry = 'true';

  const heights = items.map((item) => {
    item.style.width = `${columnWidth}px`;
    item.style.position = 'absolute';
    item.style.visibility = 'hidden';
    item.style.pointerEvents = 'none';
    item.style.left = '0';
    item.style.top = '0';
    return item.offsetHeight;
  });

  const columnHeights = Array(columns).fill(0);

  items.forEach((item, index) => {
    const columnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    const top = columnHeights[columnIndex];
    const left = columnIndex * (columnWidth + columnGap);

    item.style.visibility = '';
    item.style.pointerEvents = '';
    item.style.left = `${left}px`;
    item.style.top = `${top}px`;

    columnHeights[columnIndex] += heights[index] + rowGap;
  });

  grid.style.height = `${Math.max(0, Math.max(...columnHeights) - rowGap)}px`;
}

function schedulePortfolioMasonry() {
  if (portfolioMasonryFrame) {
    cancelAnimationFrame(portfolioMasonryFrame);
  }

  portfolioMasonryFrame = requestAnimationFrame(() => {
    portfolioMasonryFrame = null;
    layoutPortfolioMasonry();
  });
}

function bindPortfolioMasonry() {
  unbindPortfolioMasonry();

  const grid = document.querySelector('#work .portfolio-grid');
  if (!grid) {
    return;
  }

  window.__portfolioMasonryResize = schedulePortfolioMasonry;
  window.addEventListener('resize', window.__portfolioMasonryResize);

  if ('ResizeObserver' in window) {
    portfolioMasonryResizeObserver = new ResizeObserver(schedulePortfolioMasonry);
    portfolioMasonryResizeObserver.observe(grid);
    grid.querySelectorAll('.project-item').forEach((item) => {
      portfolioMasonryResizeObserver.observe(item);
    });
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(schedulePortfolioMasonry);
  }

  schedulePortfolioMasonry();
}

function unbindPortfolioMasonry() {
  if (portfolioMasonryFrame) {
    cancelAnimationFrame(portfolioMasonryFrame);
    portfolioMasonryFrame = null;
  }

  if (window.__portfolioMasonryResize) {
    window.removeEventListener('resize', window.__portfolioMasonryResize);
    window.__portfolioMasonryResize = null;
  }

  if (portfolioMasonryResizeObserver) {
    portfolioMasonryResizeObserver.disconnect();
    portfolioMasonryResizeObserver = null;
  }

  const grid = document.querySelector('#work .portfolio-grid');
  if (grid) {
    resetPortfolioMasonry(grid);
  }
}

function bootWorkPage() {
  if (document.body.dataset.page !== 'work') {
    return;
  }

  randomizeProjectPlaceholders();
  bindPortfolioMasonry();
  initSmoothScroll();
  bindContactButtons();
  bindWorkGradientOrb();
}

function bootAboutPage() {
  if (document.body.dataset.page !== 'about') {
    return;
  }

  initSmoothScroll();
  bindContactButtons();
  bindWorkGradientOrb();
}

function stopWorkPage() {
  if (window.__workFrameTask) {
    frameLoop.remove(window.__workFrameTask);
    window.__workFrameTask = null;
  }

  if (window.__lenis) {
    window.__lenis.destroy();
    window.__lenis = null;
  }

  document.documentElement.classList.remove('lenis');
  unbindWorkGradientOrb();
  unbindPortfolioMasonry();
}

function stopAboutPage() {
  stopWorkPage();
}

const contactButton = document.querySelector('.contact-button');
const toast = document.getElementById('toast');
const main = document.querySelector('main');
const body = document.body;
let gradientContainer = document.querySelector('.hero-gradient');
let toastTimeout;
let contactPopover;
let contactPopoverTimeout;
let contactPopoverAnchor = null;

function getContactPopover() {
  if (!contactPopover) {
    contactPopover = document.createElement('div');
    contactPopover.id = 'contact-popover';
    contactPopover.className = 'contact-popover';
    contactPopover.setAttribute('role', 'status');
    contactPopover.setAttribute('aria-live', 'polite');
    contactPopover.setAttribute('data-liquid-ignore', '');
    contactPopover.innerHTML = '<span class="contact-popover__text"></span>';
    document.body.appendChild(contactPopover);

    contactPopover._reposition = () => {
      if (contactPopoverAnchor) {
        positionContactPopover(contactPopoverAnchor);
      }
    };

    window.addEventListener('scroll', contactPopover._reposition, { passive: true });
    window.addEventListener('resize', contactPopover._reposition, { passive: true });
  }

  return contactPopover;
}

function positionContactPopover(button) {
  const popover = getContactPopover();
  const rect = button.getBoundingClientRect();

  popover.style.left = `${rect.left + rect.width / 2}px`;
  popover.style.top = `${rect.bottom}px`;
}

function hideContactPopover() {
  contactPopoverAnchor = null;
  contactPopover?.classList.remove('contact-popover--visible');
}

function showContactPopover(button, message) {
  const popover = getContactPopover();
  const text = popover.querySelector('.contact-popover__text');

  contactPopoverAnchor = button;
  text.textContent = message;
  positionContactPopover(button);

  popover.classList.remove('contact-popover--visible');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popover.classList.add('contact-popover--visible');
    });
  });

  clearTimeout(contactPopoverTimeout);
  contactPopoverTimeout = setTimeout(hideContactPopover, 3000);
}

let orbTargetX = 0;
let orbTargetY = 0;
let orbTargetScale = 1;
let orbTargetRotate = 0;
let orbCurrentX = 0;
let orbCurrentY = 0;
let orbCurrentScale = 1;
let orbCurrentRotate = 0;
let orbLoopActive = false;

function tickGradientOrb() {
  gradientContainer = document.querySelector('.hero-gradient');
  orbCurrentX += (orbTargetX - orbCurrentX) * 0.16;
  orbCurrentY += (orbTargetY - orbCurrentY) * 0.16;
  orbCurrentScale += (orbTargetScale - orbCurrentScale) * 0.12;
  orbCurrentRotate += (orbTargetRotate - orbCurrentRotate) * 0.14;

  const settled =
    Math.abs(orbTargetX - orbCurrentX) < 0.2
    && Math.abs(orbTargetY - orbCurrentY) < 0.2
    && Math.abs(orbTargetScale - orbCurrentScale) < 0.002
    && Math.abs(orbTargetRotate - orbCurrentRotate) < 0.2;

  if (gradientContainer) {
    gradientContainer.style.setProperty('--orb-x', `${orbCurrentX.toFixed(1)}px`);
    gradientContainer.style.setProperty('--orb-y', `${orbCurrentY.toFixed(1)}px`);
    gradientContainer.style.setProperty('--orb-scale', orbCurrentScale.toFixed(3));
    gradientContainer.style.setProperty('--orb-rotate', `${orbCurrentRotate.toFixed(1)}deg`);
  }

  if (settled) {
    frameLoop.remove(tickGradientOrb);
    orbLoopActive = false;
  }
}

function startOrbLoop() {
  if (!orbLoopActive) {
    orbLoopActive = true;
    frameLoop.add(tickGradientOrb);
  }
}

function showToast(message) {
  if (!toast) return;

  clearTimeout(toastTimeout);
  toast.classList.remove('toast--visible');
  toast.textContent = message;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

function bindContactButtons() {
  document.querySelectorAll('.contact-button').forEach((button) => {
    if (button.dataset.bound === 'true') {
      return;
    }
    button.dataset.bound = 'true';

    const isNavContact = Boolean(button.closest('.site-nav'));

    button.addEventListener('click', async () => {
      const email = button.dataset.email;

      try {
        await navigator.clipboard.writeText(email);
        if (isNavContact) {
          showContactPopover(button, "Email copied!");
        } else {
          showToast('Email copied!');
        }
      } catch {
        if (isNavContact) {
          showContactPopover(button, email);
        } else {
          showToast(email);
        }
      }
    });
  });
}

let workGradientTarget = null;

function bindWorkGradientOrb() {
  unbindWorkGradientOrb();

  const trackTarget = document.querySelector('main') || document.body;
  const container = document.querySelector('.hero-gradient');
  if (!trackTarget || !container || prefersReducedMotion) {
    return;
  }

  function onMove(event) {
    const rect = trackTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const intensity = Math.min(Math.hypot(x, y) * 1.4, 1);

    orbTargetX = x * 90;
    orbTargetY = y * 70;
    orbTargetScale = 1 + intensity * 0.1;
    orbTargetRotate = x * 14;
    startOrbLoop();
  }

  function onLeave() {
    orbTargetX = 0;
    orbTargetY = 0;
    orbTargetScale = 1;
    orbTargetRotate = 0;
    startOrbLoop();
  }

  trackTarget.addEventListener('mousemove', onMove, { passive: true });
  trackTarget.addEventListener('mouseleave', onLeave);
  workGradientTarget = { trackTarget, onMove, onLeave };
}

function unbindWorkGradientOrb() {
  if (!workGradientTarget) {
    return;
  }

  workGradientTarget.trackTarget.removeEventListener('mousemove', workGradientTarget.onMove);
  workGradientTarget.trackTarget.removeEventListener('mouseleave', workGradientTarget.onLeave);
  workGradientTarget = null;
}

if (contactButton) {
  bindContactButtons();
}

function initAsciiField() {
  if (prefersReducedMotion) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'ascii-field';
  canvas.setAttribute('aria-hidden', 'true');

  const wrap = document.createElement('div');
  wrap.className = 'ascii-field-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.setAttribute('data-liquid-ignore', '');
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);

  const ctx = canvas.getContext('2d', { alpha: true });
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>?/\\|~.:';
  const CELL = 14;
  const GLITCH_INTERVAL = 90;
  const CHAR_RGB = '120, 120, 120';
  const RIPPLE_MAX_RADIUS = 420;
  const RIPPLE_DURATION = 650;
  const RIPPLE_RING = 64;
  const RIPPLE_PEAK = 0.42;

  let cols = 0;
  let rows = 0;
  let grid = [];
  let ripples = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastGlitch = 0;
  let drawActive = false;

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nextCols = Math.ceil(width / CELL) + 1;
    const nextRows = Math.ceil(height / CELL) + 1;

    if (nextCols !== cols || nextRows !== rows) {
      cols = nextCols;
      rows = nextRows;
      grid = Array.from({ length: cols * rows }, () => randomChar());
    }
  }

  function glitchChars(now) {
    if (now - lastGlitch < GLITCH_INTERVAL) {
      return;
    }

    lastGlitch = now;

    const swapCount = Math.floor(grid.length * 0.02);
    for (let i = 0; i < swapCount; i += 1) {
      grid[Math.floor(Math.random() * grid.length)] = randomChar();
    }
  }

  function getRippleBoost(viewX, viewY, now, scrollX, scrollY) {
    let boost = 0;

    for (const ripple of ripples) {
      const elapsed = now - ripple.start;
      if (elapsed > RIPPLE_DURATION) {
        continue;
      }

      const rippleX = ripple.pageX - scrollX;
      const rippleY = ripple.pageY - scrollY;
      const progress = elapsed / RIPPLE_DURATION;
      const fade = Math.max(0, 1 - progress ** 1.35);
      const wave = progress * RIPPLE_MAX_RADIUS;
      const dist = Math.hypot(viewX - rippleX, viewY - rippleY);
      const ringDelta = Math.abs(dist - wave);

      if (ringDelta < RIPPLE_RING) {
        boost = Math.max(
          boost,
          (1 - ringDelta / RIPPLE_RING) * RIPPLE_PEAK * fade
        );
      }

      if (dist < wave) {
        boost = Math.max(
          boost,
          (1 - dist / Math.max(wave, 1)) * 0.07 * fade
        );
      }
    }

    return boost;
  }

  function draw(now) {
    ripples = ripples.filter((ripple) => now - ripple.start <= RIPPLE_DURATION);

    if (ripples.length === 0) {
      drawActive = false;
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    glitchChars(now);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const x = col * CELL;
        const y = row * CELL;
        const reveal = getRippleBoost(x + CELL * 0.5, y + CELL * 0.5, now, scrollX, scrollY);

        if (reveal < 0.01) {
          continue;
        }

        ctx.fillStyle = `rgba(${CHAR_RGB}, ${Math.min(reveal, 0.6)})`;
        ctx.fillText(grid[index], x, y);
      }
    }

    requestAnimationFrame(draw);
  }

  function startDraw() {
    if (!drawActive) {
      drawActive = true;
      requestAnimationFrame(draw);
    }
  }

  document.addEventListener('click', (event) => {
    ripples.push({
      pageX: event.pageX,
      pageY: event.pageY,
      start: performance.now(),
    });
    startDraw();
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (ripples.length > 0) {
      startDraw();
    }
  }, { passive: true });

  window.addEventListener('resize', debounce(resize, 150), { passive: true });
  resize();
  window.__asciiRemeasure = resize;
}

function initCursorBubble() {
  const bubble = document.getElementById('cursor-bubble');
  const ring = bubble?.querySelector('.cursor-bubble__ring');
  const canUseBubble = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !prefersReducedMotion;

  if (!bubble || !ring || !canUseBubble) {
    return;
  }

  const DEFAULT_SIZE = 28;
  const HOVER_SCALE = 1.5;
  const INTERACTIVE_SELECTOR = 'button, a, .project-item';

  bubble.hidden = false;

  let cursorX = 0;
  let cursorY = 0;
  let posX = 0;
  let posY = 0;
  let hover = 0;
  let targetHover = 0;
  let hoverType = '';
  let velocityX = 0;
  let velocityY = 0;
  let smoothVx = 0;
  let smoothVy = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTime = performance.now();
  let visible = false;
  let targetPress = 0;
  let press = 0;
  let jiggle = 0;
  let jiggleV = 0;
  let isMouseDown = false;
  let bubbleLoopActive = false;

  function isContactButton(element) {
    return Boolean(element?.closest('.contact-button'));
  }

  function canUsePressEffect() {
    return hoverType !== 'button';
  }

  function triggerJiggle() {
    jiggleV = 0.32;
    startBubbleLoop();
  }

  function getHoverType(element) {
    if (!element) {
      return '';
    }
    if (element.closest('.experience-group')) {
      return 'experience';
    }
    if (element.closest('.project-item')) {
      return 'project';
    }
    if (element.matches('button')) {
      return 'button';
    }
    if (element.matches('a')) {
      return 'link';
    }
    return '';
  }

  function getInteractiveElement(target) {
    if (target.closest('.site-nav')) {
      return null;
    }

    if (document.body.dataset.page === 'about') {
      return target.closest('.experience-group') || target.closest(INTERACTIVE_SELECTOR);
    }

    return target.closest('.project-item') || target.closest(INTERACTIVE_SELECTOR);
  }

  function setHoverTarget(element) {
    if (!element) {
      targetHover = 0;
      hoverType = '';
      return;
    }

    targetHover = 1;
    hoverType = getHoverType(element);
  }

  function startBubbleLoop() {
    if (!bubbleLoopActive) {
      bubbleLoopActive = true;
      frameLoop.add(tickBubble);
    }
  }

  function tickBubble() {
    if (!visible) {
      bubbleLoopActive = false;
      frameLoop.remove(tickBubble);
      return;
    }

    hover += (targetHover - hover) * 0.17;

    posX += (cursorX - posX) * 0.2;
    posY += (cursorY - posY) * 0.2;

    smoothVx += (velocityX - smoothVx) * 0.18;
    smoothVy += (velocityY - smoothVy) * 0.18;
    velocityX *= 0.82;
    velocityY *= 0.82;

    const effectiveTargetPress = canUsePressEffect() ? targetPress : 0;
    press += (effectiveTargetPress - press) * 0.1;
    jiggleV += -jiggle * 0.48;
    jiggleV *= 0.8;
    jiggle += jiggleV;

    const hoverScale = 1 + hover * (HOVER_SCALE - 1);
    const pressScale = 1 + press * 0.09;
    const jiggleScale = canUsePressEffect() ? 1 + jiggle * 0.1 : 1;
    const totalScale = hoverScale * pressScale * jiggleScale;

    bubble.style.transform = `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%) scale(${totalScale.toFixed(3)})`;
    bubble.classList.toggle('cursor-bubble--pressed', press > 0.04 && canUsePressEffect());

    bubble.classList.toggle('cursor-bubble--project', hoverType === 'project' && hover > 0.2);
    bubble.classList.toggle('cursor-bubble--experience', hoverType === 'experience' && hover > 0.2);
    bubble.classList.toggle('cursor-bubble--button', hoverType === 'button' && hover > 0.2);
    bubble.classList.toggle('cursor-bubble--link', hoverType === 'link' && hover > 0.2);

    const speed = Math.hypot(smoothVx, smoothVy);
    const angle = Math.atan2(smoothVy, smoothVx) * (180 / Math.PI);
    const stretch = Math.min(speed * 0.028, 0.5);

    if (stretch > 0.04) {
      const scaleX = 1 + stretch;
      const scaleY = Math.max(1 - stretch * 0.6, 0.55);
      const radiusShift = Math.min(speed * 0.35, 14);
      const rx = 50 + (smoothVx / (speed || 1)) * radiusShift;
      const ry = 50 + (smoothVy / (speed || 1)) * radiusShift;

      ring.style.transform = `rotate(${angle.toFixed(1)}deg) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
      ring.style.borderRadius = `${rx.toFixed(1)}% ${(100 - rx).toFixed(1)}% ${rx.toFixed(1)}% ${(100 - rx).toFixed(1)}% / ${ry.toFixed(1)}% ${(100 - ry).toFixed(1)}% ${ry.toFixed(1)}% ${(100 - ry).toFixed(1)}%`;
    } else if (Math.abs(jiggle) > 0.002 && canUsePressEffect()) {
      const jiggleWobble = jiggle * 7;
      const rx = 50 + jiggleWobble;
      const ry = 50 - jiggleWobble * 0.6;

      ring.style.transform = 'none';
      ring.style.borderRadius = `${rx.toFixed(1)}% ${(100 - rx).toFixed(1)}% ${rx.toFixed(1)}% ${(100 - rx).toFixed(1)}% / ${ry.toFixed(1)}% ${(100 - ry).toFixed(1)}% ${ry.toFixed(1)}% ${(100 - ry).toFixed(1)}%`;
    } else {
      ring.style.transform = 'none';
      ring.style.borderRadius = '50%';
    }

    const settled =
      !isMouseDown
      && Math.abs(cursorX - posX) < 0.35
      && Math.abs(cursorY - posY) < 0.35
      && Math.abs(targetHover - hover) < 0.01
      && Math.abs(targetPress - press) < 0.01
      && Math.abs(jiggle) < 0.002
      && Math.hypot(velocityX, velocityY) < 0.05;

    if (settled) {
      bubbleLoopActive = false;
      frameLoop.remove(tickBubble);
    }
  }

  document.addEventListener('mousemove', (event) => {
    const now = performance.now();
    const delta = Math.max(now - lastTime, 1);
    const nextVx = ((event.clientX - lastX) / delta) * 16;
    const nextVy = ((event.clientY - lastY) / delta) * 16;

    velocityX = nextVx;
    velocityY = nextVy;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = now;
    cursorX = event.clientX;
    cursorY = event.clientY;

    setHoverTarget(getInteractiveElement(event.target));

    if (!visible) {
      visible = true;
      bubble.classList.add('cursor-bubble--visible');
      posX = cursorX;
      posY = cursorY;
    }

    startBubbleLoop();
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => {
    visible = false;
    targetPress = 0;
    press = 0;
    isMouseDown = false;
    jiggle = 0;
    jiggleV = 0;
    setHoverTarget(null);
    bubble.classList.remove('cursor-bubble--visible', 'cursor-bubble--pressed');
    bubbleLoopActive = false;
    frameLoop.remove(tickBubble);
  });

  document.addEventListener('mousedown', (event) => {
    if (isContactButton(event.target)) {
      return;
    }
    isMouseDown = true;
    targetPress = 1;
    bubble.classList.add('cursor-bubble--pressed');
    startBubbleLoop();
  });

  document.addEventListener('mouseup', () => {
    if (isMouseDown && canUsePressEffect()) {
      triggerJiggle();
    }
    isMouseDown = false;
    targetPress = 0;
    bubble.classList.remove('cursor-bubble--pressed');
    startBubbleLoop();
  });
}

initAsciiField();
initCursorBubble();

window.sitePages = window.sitePages || {};
window.sitePages.work = { boot: bootWorkPage, stop: stopWorkPage };
window.sitePages.about = { boot: bootAboutPage, stop: stopAboutPage };

if (document.body.dataset.page === 'work') {
  bootWorkPage();
} else if (document.body.dataset.page === 'about') {
  bootAboutPage();
}
