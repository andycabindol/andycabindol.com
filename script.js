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
  wrap.appendChild(canvas);
  document.body.insertBefore(wrap, document.body.firstChild);

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
