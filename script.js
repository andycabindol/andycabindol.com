if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);

const contactButton = document.querySelector('.contact-button');
const toast = document.getElementById('toast');
const main = document.querySelector('main');
const gradientContainer = document.querySelector('.hero-gradient');
let toastTimeout;
let buttonTimeout;

let orbTargetX = 0;
let orbTargetY = 0;
let orbTargetScale = 1;
let orbTargetRotate = 0;
let orbCurrentX = 0;
let orbCurrentY = 0;
let orbCurrentScale = 1;
let orbCurrentRotate = 0;

function animateGradientOrb() {
  orbCurrentX += (orbTargetX - orbCurrentX) * 0.16;
  orbCurrentY += (orbTargetY - orbCurrentY) * 0.16;
  orbCurrentScale += (orbTargetScale - orbCurrentScale) * 0.12;
  orbCurrentRotate += (orbTargetRotate - orbCurrentRotate) * 0.14;

  if (gradientContainer) {
    gradientContainer.style.setProperty('--orb-x', `${orbCurrentX}px`);
    gradientContainer.style.setProperty('--orb-y', `${orbCurrentY}px`);
    gradientContainer.style.setProperty('--orb-scale', orbCurrentScale.toFixed(3));
    gradientContainer.style.setProperty('--orb-rotate', `${orbCurrentRotate.toFixed(2)}deg`);
  }

  requestAnimationFrame(animateGradientOrb);
}

if (main && gradientContainer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  main.addEventListener('mousemove', (event) => {
    const rect = main.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const intensity = Math.min(Math.hypot(x, y) * 1.4, 1);

    orbTargetX = x * 90;
    orbTargetY = y * 70;
    orbTargetScale = 1 + intensity * 0.1;
    orbTargetRotate = x * 14;
  });

  main.addEventListener('mouseleave', () => {
    orbTargetX = 0;
    orbTargetY = 0;
    orbTargetScale = 1;
    orbTargetRotate = 0;
  });

  animateGradientOrb();
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

function resetContactButton(button, defaultLabel) {
  button.textContent = defaultLabel;
  button.classList.remove('contact-button--copied');
}

if (contactButton) {
  contactButton.addEventListener('click', async () => {
    const email = contactButton.dataset.email;
    const defaultLabel = 'Contact';

    try {
      await navigator.clipboard.writeText(email);
      contactButton.textContent = 'Copied!';
      contactButton.classList.add('contact-button--copied');
      showToast("Andy's email was copied to your clipboard");

      clearTimeout(buttonTimeout);
      buttonTimeout = setTimeout(() => {
        resetContactButton(contactButton, defaultLabel);
      }, 5000);
    } catch {
      contactButton.textContent = email;
      contactButton.classList.add('contact-button--copied');

      clearTimeout(buttonTimeout);
      buttonTimeout = setTimeout(() => {
        resetContactButton(contactButton, defaultLabel);
      }, 3000);
    }
  });
}

function initAsciiField() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'ascii-field';
  canvas.setAttribute('aria-hidden', 'true');

  const wrap = document.createElement('div');
  wrap.className = 'ascii-field-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+=<>?/\\|~.:';
  const CELL = 13;
  const GLITCH_INTERVAL = 70;
  const CHAR_RGB = '122, 110, 92';
  const RIPPLE_MAX_RADIUS = 480;
  const RIPPLE_DURATION = 700;
  const RIPPLE_RING = 72;
  const RIPPLE_PEAK = 0.42;

  let cols = 0;
  let rows = 0;
  let grid = [];
  let ripples = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastGlitch = 0;

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  function getDocumentHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = getDocumentHeight();
    wrap.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
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

    const swapCount = Math.floor(grid.length * 0.03);
    for (let i = 0; i < swapCount; i += 1) {
      grid[Math.floor(Math.random() * grid.length)] = randomChar();
    }
  }

  function getRippleBoost(x, y, now) {
    let boost = 0;

    for (const ripple of ripples) {
      const elapsed = now - ripple.start;
      if (elapsed > RIPPLE_DURATION) {
        continue;
      }

      const progress = elapsed / RIPPLE_DURATION;
      const fade = Math.max(0, 1 - progress ** 1.35);
      const wave = progress * RIPPLE_MAX_RADIUS;
      const dist = Math.hypot(x - ripple.x, y - ripple.y);
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
    glitchChars(now);
    ripples = ripples.filter((ripple) => now - ripple.start <= RIPPLE_DURATION);

    ctx.clearRect(0, 0, width, height);

    if (ripples.length === 0) {
      requestAnimationFrame(draw);
      return;
    }

    ctx.font = '11px ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';

    const scrollY = window.scrollY;
    const viewHeight = window.innerHeight;
    const startRow = Math.max(0, Math.floor(scrollY / CELL) - 2);
    const endRow = Math.min(rows, Math.ceil((scrollY + viewHeight) / CELL) + 2);

    for (let row = startRow; row < endRow; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const x = col * CELL;
        const y = row * CELL;
        const centerX = x + CELL * 0.5;
        const centerY = y + CELL * 0.5;
        const reveal = getRippleBoost(centerX, centerY, now);

        if (reveal < 0.008) {
          continue;
        }

        ctx.fillStyle = `rgba(${CHAR_RGB}, ${Math.min(reveal, 0.6)})`;
        ctx.fillText(grid[index], x, y);
      }
    }

    requestAnimationFrame(draw);
  }

  document.addEventListener('click', (event) => {
    ripples.push({
      x: event.pageX,
      y: event.pageY,
      start: performance.now(),
    });
  });

  window.addEventListener('resize', resize);
  window.addEventListener('load', resize);
  resize();
  requestAnimationFrame(draw);
}

initAsciiField();

function initCursorBubble() {
  const bubble = document.getElementById('cursor-bubble');
  const ring = bubble?.querySelector('.cursor-bubble__ring');
  const canUseBubble = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!bubble || !ring || !canUseBubble) {
    return;
  }

  const DEFAULT_SIZE = 28;
  const INTERACTIVE_SELECTOR = 'button, a, .experience-group';

  bubble.hidden = false;

  let cursorX = 0;
  let cursorY = 0;
  let posX = 0;
  let posY = 0;
  let sizeW = DEFAULT_SIZE;
  let sizeH = DEFAULT_SIZE;
  let morph = 0;
  let targetMorph = 0;
  let morphX = 0;
  let morphY = 0;
  let targetW = DEFAULT_SIZE;
  let targetH = DEFAULT_SIZE;
  let targetRadius = '50%';
  let hoverType = '';
  let hoverEl = null;
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

  function isContactButton(element) {
    return Boolean(element?.closest('.contact-button'));
  }

  function canUsePressEffect() {
    return hoverType !== 'button';
  }

  function triggerJiggle() {
    jiggleV = 0.32;
  }

  function getHoverType(element) {
    if (!element) {
      return '';
    }
    if (element.matches('.experience-group')) {
      return 'experience';
    }
    if (element.matches('button')) {
      return 'button';
    }
    if (element.matches('a')) {
      return 'link';
    }
    return '';
  }

  function setMorphTarget(element) {
    hoverEl = element;

    if (!element) {
      targetMorph = 0;
      hoverType = '';
      targetW = DEFAULT_SIZE;
      targetH = DEFAULT_SIZE;
      targetRadius = '50%';
      return;
    }

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    morphX = rect.left + rect.width / 2;
    morphY = rect.top + rect.height / 2;
    targetW = rect.width;
    targetH = rect.height;
    targetRadius = style.borderRadius && style.borderRadius !== '0px'
      ? style.borderRadius
      : '50%';
    targetMorph = 1;
    hoverType = getHoverType(element);
  }

  function refreshMorphTarget() {
    if (hoverEl && document.body.contains(hoverEl)) {
      setMorphTarget(hoverEl);
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

    const interactive = event.target.closest(INTERACTIVE_SELECTOR);
    if (interactive !== hoverEl) {
      setMorphTarget(interactive);
    } else if (interactive) {
      refreshMorphTarget();
    }

    if (!visible) {
      visible = true;
      bubble.classList.add('cursor-bubble--visible');
      posX = cursorX;
      posY = cursorY;
    }
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => {
    visible = false;
    targetPress = 0;
    press = 0;
    isMouseDown = false;
    jiggle = 0;
    jiggleV = 0;
    setMorphTarget(null);
    bubble.classList.remove('cursor-bubble--visible', 'cursor-bubble--pressed');
  });

  document.addEventListener('mousedown', (event) => {
    if (isContactButton(event.target)) {
      return;
    }
    isMouseDown = true;
    targetPress = 1;
    bubble.classList.add('cursor-bubble--pressed');
  });

  document.addEventListener('mouseup', () => {
    if (isMouseDown && canUsePressEffect()) {
      triggerJiggle();
    }
    isMouseDown = false;
    targetPress = 0;
    bubble.classList.remove('cursor-bubble--pressed');
  });

  window.addEventListener('scroll', refreshMorphTarget, { passive: true });
  window.addEventListener('resize', refreshMorphTarget);

  function animateBubble() {
    morph += (targetMorph - morph) * 0.17;

    const destX = cursorX + (morphX - cursorX) * morph;
    const destY = cursorY + (morphY - cursorY) * morph;
    const destW = DEFAULT_SIZE + (targetW - DEFAULT_SIZE) * morph;
    const destH = DEFAULT_SIZE + (targetH - DEFAULT_SIZE) * morph;

    posX += (destX - posX) * 0.2;
    posY += (destY - posY) * 0.2;
    sizeW += (destW - sizeW) * 0.18;
    sizeH += (destH - sizeH) * 0.18;

    smoothVx += (velocityX - smoothVx) * 0.18;
    smoothVy += (velocityY - smoothVy) * 0.18;
    velocityX *= 0.82;
    velocityY *= 0.82;

    const effectiveTargetPress = canUsePressEffect() ? targetPress : 0;
    press += (effectiveTargetPress - press) * 0.1;
    jiggleV += -jiggle * 0.48;
    jiggleV *= 0.8;
    jiggle += jiggleV;

    const pressScale = 1 + press * 0.09;
    const jiggleScale = canUsePressEffect() ? 1 + jiggle * 0.1 : 1;
    const interactionScale = pressScale * jiggleScale;

    bubble.style.width = `${sizeW}px`;
    bubble.style.height = `${sizeH}px`;
    bubble.style.transform = `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%) scale(${interactionScale})`;
    bubble.classList.toggle('cursor-bubble--pressed', press > 0.04 && canUsePressEffect());

    bubble.classList.toggle('cursor-bubble--experience', hoverType === 'experience' && morph > 0.2);
    bubble.classList.toggle('cursor-bubble--button', hoverType === 'button' && morph > 0.2);
    bubble.classList.toggle('cursor-bubble--link', hoverType === 'link' && morph > 0.2);

    if (morph > 0.2) {
      ring.style.transform = 'none';
      ring.style.borderRadius = targetRadius;
    } else {
      const speed = Math.hypot(smoothVx, smoothVy);
      const angle = Math.atan2(smoothVy, smoothVx) * (180 / Math.PI);
      const stretch = Math.min(speed * 0.028, 0.5);
      const scaleX = 1 + stretch;
      const scaleY = Math.max(1 - stretch * 0.6, 0.55);
      const radiusShift = Math.min(speed * 0.35, 14);
      const jiggleWobble = jiggle * 7;
      const rx = 50 + (smoothVx / (speed || 1)) * radiusShift + jiggleWobble;
      const ry = 50 + (smoothVy / (speed || 1)) * radiusShift - jiggleWobble * 0.6;

      ring.style.transform = `rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
      ring.style.borderRadius = `${rx}% ${100 - rx}% ${rx}% ${100 - rx}% / ${ry}% ${100 - ry}% ${ry}% ${100 - ry}%`;
    }

    requestAnimationFrame(animateBubble);
  }

  animateBubble();
}

initCursorBubble();
