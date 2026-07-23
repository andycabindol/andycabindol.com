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

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function sampleIntroTitlePose(radius, rotMax, leftBias = 0) {
  const angle = randomRange(0, Math.PI * 2);
  return {
    dx: Math.cos(angle) * radius + leftBias,
    dy: Math.sin(angle) * radius * 0.55,
    rot: randomRange(-rotMax, rotMax),
  };
}

function setIntroTitlePoseVars(word, poses) {
  poses.forEach((pose, index) => {
    const n = index + 1;
    word.style.setProperty(`--dx${n}`, `${pose.dx.toFixed(3)}em`);
    word.style.setProperty(`--dy${n}`, `${pose.dy.toFixed(3)}em`);
    word.style.setProperty(`--rot${n}`, `${pose.rot.toFixed(2)}deg`);
  });
}

function getIntroTitlePose(word) {
  const style = getComputedStyle(word);
  const fontSize = parseFloat(style.fontSize) || 16;
  const transform = style.transform;

  if (!transform || transform === 'none') {
    return { dx: 0, dy: 0, rot: 0 };
  }

  const matrix = new DOMMatrixReadOnly(transform);
  return {
    dx: matrix.e / fontSize,
    dy: matrix.f / fontSize,
    rot: Math.atan2(matrix.b, matrix.a) * (180 / Math.PI),
  };
}

function buildIntroTitleEntrancePoses() {
  const stepRadii = [0.28, 0.18, 0.1, 0.05];
  const stepRots = [5.5, 3.5, 2.0, 0.8];

  return stepRadii.map((radius, index) =>
    sampleIntroTitlePose(
      radius,
      stepRots[index],
      index === 0 ? -radius * 0.35 : 0,
    ));
}

function getIntroTitleTimingMs() {
  const title = document.querySelector('.intro-title');
  if (!title) {
    return { start: 200, stagger: 50, duration: 900, total: 1200 };
  }

  const styles = getComputedStyle(title);
  const start = (parseFloat(styles.getPropertyValue('--title-start')) || 0.2) * 1000;
  const stagger = (parseFloat(styles.getPropertyValue('--title-stagger')) || 0.05) * 1000;
  const duration = (parseFloat(styles.getPropertyValue('--title-duration')) || 0.9) * 1000;
  return {
    start,
    stagger,
    duration,
    total: start + stagger * 2 + duration + 40,
  };
}

function restartIntroTitleAnimations(words) {
  words.forEach((word) => {
    word.style.animation = 'none';
  });
  void document.body.offsetWidth;
  words.forEach((word) => {
    word.style.animation = '';
  });
}

function settleIntroTitle() {
  const title = document.querySelector('.intro-title');
  const words = title?.querySelectorAll('.intro-title__word');
  if (!title || !words?.length) {
    return;
  }

  const hoverState = window.__introTitleHover;
  const hoveredWords = new Set(
    hoverState?.handlers
      .filter((entry) => entry.hovered || entry.word.matches(':hover'))
      .map((entry) => entry.word) ?? [],
  );

  // Stop jitter only on words that aren't still hovered.
  hoverState?.handlers.forEach((entry) => {
    if (hoveredWords.has(entry.word)) {
      return;
    }
    window.clearInterval(entry.timer);
    entry.timer = 0;
    clearIntroTitleHoverSettle(entry);
    entry.word.classList.remove('intro-title__word--jitter');
  });

  words.forEach((word) => {
    word.style.animation = 'none';
    word.style.opacity = '1';
    word.style.color = '#3f3e3a';

    if (hoveredWords.has(word)) {
      // Keep hover motion — don't snap this word to rest.
      return;
    }

    word.classList.remove('intro-title__word--jitter', 'intro-title__word--hover-settle');
    word.style.transform = 'translate(0, 0) rotate(0deg)';
  });

  title.classList.remove('intro-title--replay');
  title.classList.add('intro-title--settled');

  // Make sure any still-hovered word keeps jittering.
  hoverState?.handlers.forEach((entry) => {
    if (hoveredWords.has(entry.word)) {
      entry.onEnter();
    }
  });
}

function scheduleIntroTitleSettle(delayMs) {
  window.clearTimeout(window.__introTitleSettleTimeout);
  window.__introTitleSettleTimeout = window.setTimeout(settleIntroTitle, delayMs);
}

function randomizeIntroTitleWords() {
  const title = document.querySelector('.intro-title');
  const words = document.querySelectorAll('.intro-title__word');
  if (!title || !words.length) {
    return;
  }

  title.classList.remove('intro-title--settled', 'intro-title--replay');

  words.forEach((word) => {
    word.style.opacity = '';
    word.style.color = '';
    word.style.transform = '';
    setIntroTitlePoseVars(word, buildIntroTitleEntrancePoses());
  });

  restartIntroTitleAnimations(words);
  scheduleIntroTitleSettle(getIntroTitleTimingMs().total);
}

function getHoveredIntroTitleWords() {
  const hoverState = window.__introTitleHover;
  if (!hoverState) {
    return new Set();
  }

  return new Set(
    hoverState.handlers
      .filter((entry) => entry.hovered || entry.word.matches(':hover'))
      .map((entry) => entry.word),
  );
}

function replayIntroTitleReveal() {
  const title = document.querySelector('.intro-title');
  const words = [...(title?.querySelectorAll('.intro-title__word') ?? [])];
  if (!title || !words.length || prefersReducedMotion) {
    return;
  }

  const hoveredWords = getHoveredIntroTitleWords();
  const replayingWords = words.filter((word) => !hoveredWords.has(word));

  // Pause jitter on words that will replay; leave the hovered word alone.
  const hoverState = window.__introTitleHover;
  hoverState?.handlers.forEach((entry) => {
    if (hoveredWords.has(entry.word)) {
      return;
    }
    window.clearInterval(entry.timer);
    entry.timer = 0;
    clearIntroTitleHoverSettle(entry);
    entry.word.classList.remove('intro-title__word--jitter');
  });

  const stepRadii = [0.22, 0.12, 0.05];
  const stepRots = [4.5, 2.4, 0.9];

  replayingWords.forEach((word) => {
    const current = getIntroTitlePose(word);
    const poses = [
      current,
      ...stepRadii.map((radius, index) =>
        sampleIntroTitlePose(radius, stepRots[index])),
    ];
    setIntroTitlePoseVars(word, poses);
    word.classList.remove('intro-title__word--jitter');
    word.style.opacity = '1';
    word.style.transform = '';
  });

  // Hovered word keeps jittering, but joins the blue→black flash.
  hoveredWords.forEach((word) => {
    word.style.opacity = '1';
    word.style.color = '#3f3e3a';
    word.classList.add('intro-title__word--jitter');
  });

  title.classList.remove('intro-title--settled', 'intro-title--replay');
  void title.offsetWidth;
  title.classList.add('intro-title--replay');

  // Restart every word so color delays (via --i * --title-stagger) stay in sync.
  const allWords = [...replayingWords, ...hoveredWords];
  allWords.forEach((word) => {
    word.style.animation = 'none';
  });
  void title.offsetWidth;
  allWords.forEach((word) => {
    word.style.animation = '';
    word.style.color = '';
  });

  // Keep jitter alive on the hovered word during replay (without killing color anim).
  hoverState?.handlers.forEach((entry) => {
    if (!hoveredWords.has(entry.word)) {
      return;
    }
    entry.hovered = true;
    entry.word.classList.add('intro-title__word--jitter');
    window.clearInterval(entry.timer);
    entry.timer = window.setInterval(() => {
      applyIntroTitleHoverPose(entry.word);
    }, getIntroTitleHoverConfig().stepMs);
    applyIntroTitleHoverPose(entry.word);
  });

  const { stagger, duration } = getIntroTitleTimingMs();
  scheduleIntroTitleSettle(stagger * 2 + duration + 40);
}

function joinIntroTitleReplay(word) {
  const title = word.closest('.intro-title');
  if (!title?.classList.contains('intro-title--replay')) {
    return;
  }

  const stepRadii = [0.22, 0.12, 0.05];
  const stepRots = [4.5, 2.4, 0.9];
  const current = getIntroTitlePose(word);
  const poses = [
    current,
    ...stepRadii.map((radius, index) =>
      sampleIntroTitlePose(radius, stepRots[index])),
  ];

  setIntroTitlePoseVars(word, poses);
  word.classList.remove('intro-title__word--jitter');
  word.style.opacity = '1';
  word.style.color = '';
  word.style.transform = '';
  word.style.animation = 'none';
  void word.offsetWidth;

  const { duration } = getIntroTitleTimingMs();
  const durationSec = `${(duration / 1000).toFixed(3)}s`;
  // Join immediately from current pose — same move + blue settle as click replay.
  word.style.animation =
    `introTitleWordColor ${durationSec} ease forwards, ` +
    `introTitleWordMove ${durationSec} forwards`;
  word.style.animationDelay = '0s, 0s';
}

function stopIntroTitleHover() {
  const state = window.__introTitleHover;
  if (!state) {
    return;
  }

  state.handlers.forEach((entry) => {
    window.clearInterval(entry.timer);
    entry.timer = 0;
    clearIntroTitleHoverSettle(entry);
    entry.word.classList.remove('intro-title__word--jitter');
  });
}

function applyIntroTitlePose(word, pose) {
  word.style.transform =
    `translate(${pose.dx.toFixed(3)}em, ${pose.dy.toFixed(3)}em) rotate(${pose.rot.toFixed(2)}deg)`;
}

function getIntroTitleHoverConfig() {
  const title = document.querySelector('.intro-title');
  if (!title) {
    return { radius: 0.1, rotMax: 3, stepMs: 110 };
  }

  const styles = getComputedStyle(title);
  const radiusRaw = styles.getPropertyValue('--title-hover-radius').trim();
  const rotRaw = styles.getPropertyValue('--title-hover-rot').trim();
  const stepRaw = styles.getPropertyValue('--title-hover-step').trim();

  return {
    radius: parseFloat(radiusRaw) || 0.1,
    rotMax: parseFloat(rotRaw) || 3,
    stepMs: parseFloat(stepRaw) || 110,
  };
}

function applyIntroTitleHoverPose(word) {
  const { radius, rotMax } = getIntroTitleHoverConfig();
  applyIntroTitlePose(word, sampleIntroTitlePose(radius, rotMax));
}

function clearIntroTitleHoverSettle(entry) {
  if (entry.settleEnd) {
    entry.word.removeEventListener('animationend', entry.settleEnd);
    entry.settleEnd = null;
  }
  entry.word.classList.remove('intro-title__word--hover-settle');
}

function settleIntroTitleWordFromHover(entry) {
  const { word } = entry;
  clearIntroTitleHoverSettle(entry);

  const current = getIntroTitlePose(word);
  const mag = Math.max(Math.hypot(current.dx, current.dy), 0.035);
  const rotMag = Math.max(Math.abs(current.rot), 1.1);
  const poses = [
    current,
    sampleIntroTitlePose(mag * 0.55, rotMag * 0.55),
    sampleIntroTitlePose(mag * 0.28, rotMag * 0.28),
    sampleIntroTitlePose(mag * 0.12, rotMag * 0.12),
  ];

  setIntroTitlePoseVars(word, poses);
  word.classList.remove('intro-title__word--jitter');
  word.style.transform = '';
  word.style.color = '#3f3e3a';
  word.style.opacity = '1';

  // Restart the CSS settle animation from the current pose.
  word.classList.remove('intro-title__word--hover-settle');
  void word.offsetWidth;
  word.classList.add('intro-title__word--hover-settle');

  entry.settleEnd = (event) => {
    if (event.animationName && event.animationName !== 'introTitleWordMove') {
      return;
    }
    word.removeEventListener('animationend', entry.settleEnd);
    entry.settleEnd = null;
    word.classList.remove('intro-title__word--hover-settle');
    word.style.transform = 'translate(0, 0) rotate(0deg)';
    word.style.color = '#3f3e3a';
    word.style.animation = '';
    word.style.opacity = '1';
  };
  word.addEventListener('animationend', entry.settleEnd);
}

function bindIntroTitleHover() {
  unbindIntroTitleHover();

  const words = document.querySelectorAll('.intro-title__word');
  if (!words.length || prefersReducedMotion) {
    return;
  }

  const handlers = [];

  words.forEach((word) => {
    const entry = {
      word,
      timer: 0,
      hovered: false,
      settleEnd: null,
      onEnter: null,
      onLeave: null,
    };

    entry.onEnter = () => {
      entry.hovered = true;
      clearIntroTitleHoverSettle(entry);
      const title = word.closest('.intro-title');
      const canJitter = title?.classList.contains('intro-title--settled')
        || title?.classList.contains('intro-title--replay');
      if (!canJitter) {
        return;
      }
      word.classList.add('intro-title__word--jitter');
      // During replay, leave color to the shared blue→black animation.
      if (!title.classList.contains('intro-title--replay')) {
        word.style.animation = 'none';
        word.style.color = '#3f3e3a';
      }
      applyIntroTitleHoverPose(word);
      window.clearInterval(entry.timer);
      entry.timer = window.setInterval(() => {
        applyIntroTitleHoverPose(word);
      }, getIntroTitleHoverConfig().stepMs);
    };

    entry.onLeave = () => {
      entry.hovered = false;
      window.clearInterval(entry.timer);
      entry.timer = 0;
      word.classList.remove('intro-title__word--jitter');

      const title = word.closest('.intro-title');
      if (title?.classList.contains('intro-title--replay')) {
        // Leaving mid-click: pick up the settle animation from here.
        joinIntroTitleReplay(word);
        return;
      }

      if (title?.classList.contains('intro-title--settled')) {
        settleIntroTitleWordFromHover(entry);
      }
    };

    word.addEventListener('mouseenter', entry.onEnter);
    word.addEventListener('mouseleave', entry.onLeave);
    handlers.push(entry);
  });

  window.__introTitleHover = { handlers };
}

function unbindIntroTitleHover() {
  const state = window.__introTitleHover;
  if (!state) {
    return;
  }

  state.handlers.forEach((entry) => {
    window.clearInterval(entry.timer);
    clearIntroTitleHoverSettle(entry);
    entry.word.removeEventListener('mouseenter', entry.onEnter);
    entry.word.removeEventListener('mouseleave', entry.onLeave);
    entry.word.classList.remove('intro-title__word--jitter');
  });

  window.__introTitleHover = null;
}

function bindIntroTitleReplay() {
  unbindIntroTitleReplay();

  const title = document.querySelector('.intro-title');
  if (!title || prefersReducedMotion) {
    return;
  }

  function onClick(event) {
    event.preventDefault();
    replayIntroTitleReveal();
  }

  title.addEventListener('click', onClick);
  window.__introTitleReplay = { title, onClick };
}

function unbindIntroTitleReplay() {
  const state = window.__introTitleReplay;
  if (!state) {
    return;
  }

  state.title.removeEventListener('click', state.onClick);
  state.title.classList.remove('intro-title--replay', 'intro-title--settled');
  window.__introTitleReplay = null;
  window.clearTimeout(window.__introTitleSettleTimeout);
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
  return 2;
}

function resetPortfolioMasonry(grid) {
  grid.removeAttribute('data-masonry');
  grid.style.height = '';
  grid.querySelectorAll('.project-item').forEach((item) => {
    item.classList.remove('project-item--masonry-fill');
    item.style.position = '';
    item.style.width = '';
    item.style.left = '';
    item.style.top = '';
    item.style.height = '';
    item.style.visibility = '';
    item.style.pointerEvents = '';
    const media = item.querySelector('.project-media');
    if (media) {
      media.style.height = '';
      media.style.aspectRatio = '';
    }
  });
}

function clearPortfolioMasonryFill(items) {
  items.forEach((item) => {
    item.classList.remove('project-item--masonry-fill');
    item.style.height = '';
    const media = item.querySelector('.project-media');
    if (media) {
      media.style.height = '';
      media.style.aspectRatio = '';
    }
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

  if (columns === 1) {
    resetPortfolioMasonry(grid);
    return;
  }

  const gridWidth = grid.clientWidth;
  if (!gridWidth) {
    return;
  }

  // Measure natural tile heights before packing / bottom-fill stretch.
  clearPortfolioMasonryFill(items);

  const columnWidth = (gridWidth - columnGap * (columns - 1)) / columns;
  grid.style.position = 'relative';
  grid.dataset.masonry = 'true';

  // Keep items in-flow of 2-col absolute packing without a 1-col reset flash.
  items.forEach((item) => {
    item.style.position = 'absolute';
    item.style.width = `${columnWidth}px`;
    item.style.marginBottom = '0';
    item.style.visibility = '';
    item.style.pointerEvents = '';
  });

  const heights = items.map((item) => item.getBoundingClientRect().height);
  const columnHeights = Array(columns).fill(0);
  const columnLastIndex = Array(columns).fill(-1);

  items.forEach((item, index) => {
    // Place into the shortest column so tops stagger instead of forming rows.
    let columnIndex = 0;
    for (let i = 1; i < columns; i += 1) {
      if (columnHeights[i] < columnHeights[columnIndex]) {
        columnIndex = i;
      }
    }

    const top = columnHeights[columnIndex];
    const left = columnIndex * (columnWidth + columnGap);

    item.style.left = `${left}px`;
    item.style.top = `${top}px`;

    columnHeights[columnIndex] += heights[index] + rowGap;
    columnLastIndex[columnIndex] = index;
  });

  const maxColumnHeight = Math.max(...columnHeights);

  // Grow the bottom tile in each shorter column so both columns share one baseline.
  columnLastIndex.forEach((itemIndex, columnIndex) => {
    if (itemIndex < 0) return;

    const deficit = maxColumnHeight - columnHeights[columnIndex];
    if (deficit <= 1) return;

    const item = items[itemIndex];
    const media = item.querySelector('.project-media');
    if (!media) return;

    const mediaHeight = media.getBoundingClientRect().height;
    media.style.aspectRatio = 'auto';
    media.style.height = `${mediaHeight + deficit}px`;
    item.classList.add('project-item--masonry-fill');
  });

  grid.style.height = `${Math.max(0, maxColumnHeight - rowGap)}px`;
}

function schedulePortfolioMasonry() {
  if (portfolioMasonryFrame) {
    cancelAnimationFrame(portfolioMasonryFrame);
  }

  portfolioMasonryFrame = requestAnimationFrame(() => {
    portfolioMasonryFrame = requestAnimationFrame(() => {
      portfolioMasonryFrame = null;
      layoutPortfolioMasonry();
    });
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

function bindBrandMarquee() {
  unbindBrandMarquee();

  const marquee = document.querySelector('.brand-marquee');
  const track = marquee?.querySelector('.brand-marquee__track');
  if (!marquee || !track || prefersReducedMotion) {
    return;
  }

  const NORMAL_RATE = 1;
  const SLOW_RATE = 1 / 3;

  function setPlaybackRate(rate) {
    track.getAnimations().forEach((animation) => {
      animation.playbackRate = rate;
    });
  }

  function onEnter() {
    setPlaybackRate(SLOW_RATE);
  }

  function onLeave() {
    setPlaybackRate(NORMAL_RATE);
  }

  marquee.addEventListener('mouseenter', onEnter);
  marquee.addEventListener('mouseleave', onLeave);

  window.__brandMarquee = { marquee, onEnter, onLeave };
}

function unbindBrandMarquee() {
  const state = window.__brandMarquee;
  if (!state) {
    return;
  }

  state.marquee.removeEventListener('mouseenter', state.onEnter);
  state.marquee.removeEventListener('mouseleave', state.onLeave);
  window.__brandMarquee = null;
}

function bootWorkPage() {
  if (document.body.dataset.page !== 'work') {
    return;
  }

  randomizeIntroTitleWords();
  bindIntroTitleHover();
  bindIntroTitleReplay();
  bindPortfolioMasonry();
  window.MediaSkeleton?.initAll?.();
  initSmoothScroll();
  bindContactButtons();
  bindWorkGradientOrb();
  bindBrandMarquee();

  // Defer WebGL thumbnails so project→work nav morph / fade aren't blocked.
  const startHeavy = () => {
    if (document.body.dataset.page !== 'work') {
      return;
    }
    window.WorkGradients?.initAll?.();
    window.CreamyOrb?.ensureAlive?.();
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(startHeavy, { timeout: 320 });
  } else {
    window.setTimeout(startHeavy, 0);
  }
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
  window.WorkGradients?.disposeAll?.();
  unbindPortfolioMasonry();
  unbindBrandMarquee();
  unbindIntroTitleHover();
  unbindIntroTitleReplay();
  window.clearTimeout(window.__introTitleSettleTimeout);
}

function bootAboutPage() {
  if (document.body.dataset.page !== 'about') {
    return;
  }

  initSmoothScroll();
  bindContactButtons();
  bindWorkGradientOrb();
  window.MediaSkeleton?.initAll?.();
  window.CreamyOrb?.ensureAlive?.();
  bindAboutPage();
}

function stopAboutPage() {
  unbindAboutPage();
  stopWorkPage();
}

let aboutPageCleanup = null;

function easeOutCubic(t) {
  return 1 - ((1 - t) ** 3);
}

function bindAboutHero(cleanups, reduceMotion) {
  const hero = document.querySelector('[data-about-hero]');
  const frame = document.querySelector('[data-about-hero-frame]');
  const images = [...document.querySelectorAll('[data-about-hero-image]')];
  const intro = document.querySelector('[data-about-intro]');
  const scrollHint = document.querySelector('[data-about-hero-scroll]');
  if (!hero || !frame || !images.length) {
    return;
  }

  // Fraction of the scrub runway before auto-complete kicks in
  const TRIGGER = 0.18;
  // How far the frame grows while still scrubbing (0–1 toward full size)
  const SCRUB_MAX = 0.22;
  const EXPAND_MS_MIN = 280;
  const EXPAND_MS_MAX = 1200;

  let activeIndex = -1;
  let scrubP = 0;
  let expanding = false;
  let expanded = false;
  let introShown = false;
  let raf = 0;
  let expandRaf = 0;
  let lastRaw = 0;
  let lastTime = 0;
  // Scroll progress units per ms (positive = scrolling down)
  let scrollVel = 0;
  let currentP = 0;
  // While true, expand may ease scroll toward the title peek; user input clears it
  let scrollAssist = false;

  const peekAmount = () =>
    Math.round(Math.min(150, Math.max(72, window.innerHeight * 0.12)));

  const getScrollY = () => window.__lenis?.scroll ?? window.scrollY ?? 0;

  const setScrollY = (y) => {
    const next = Math.max(0, y);
    if (window.__lenis) {
      window.__lenis.scrollTo(next, { immediate: true });
    } else {
      window.scrollTo(0, next);
    }
  };

  const setActiveImage = (index) => {
    if (index === activeIndex) return;
    activeIndex = index;
    images.forEach((img, i) => {
      const on = i === index;
      img.classList.toggle('is-active', on);
      img.toggleAttribute('aria-hidden', !on);
    });
  };

  const syncImagesToProgress = (p) => {
    if (reduceMotion || images.length < 2) {
      setActiveImage(p >= 0.99 ? images.length - 1 : 0);
      return;
    }
    const last = images.length - 1;
    const eased = easeOutCubic(Math.min(1, Math.max(0, p)));
    setActiveImage(Math.min(last, Math.floor(eased * images.length)));
  };

  const showIntro = () => {
    if (!intro) return;
    intro.hidden = false;
    if (introShown) return;
    introShown = true;
    requestAnimationFrame(() => {
      intro.classList.add('is-in');
    });
  };

  const hideIntro = () => {
    if (!intro) return;
    introShown = false;
    intro.hidden = true;
    intro.classList.remove('is-in');
  };

  const setHeroP = (p) => {
    currentP = Math.min(1, Math.max(0, p));
    frame.style.transition = 'none';
    frame.style.setProperty('--hero-p', currentP.toFixed(4));
    if (scrollHint) {
      scrollHint.style.setProperty(
        '--hero-scroll-fade',
        Math.min(1, currentP / Math.max(SCRUB_MAX, 0.001)).toFixed(4)
      );
    }
    syncImagesToProgress(currentP);
    hero.classList.toggle('is-scrubbing', currentP > 0.001);
  };

  const resetToScrub = () => {
    expanding = false;
    expanded = false;
    scrollAssist = false;
    if (expandRaf) {
      cancelAnimationFrame(expandRaf);
      expandRaf = 0;
    }
    hero.classList.remove('is-expanding', 'is-expanded');
    hideIntro();
    setHeroP(0);
    setActiveImage(0);
    scrubP = 0;
    lastRaw = 0;
    lastTime = 0;
    scrollVel = 0;
    setScrollY(0);
    hero.classList.remove('is-scrubbing');
  };

  const finishExpand = () => {
    expanding = false;
    expanded = true;
    hero.classList.remove('is-expanding');
    hero.classList.add('is-expanded');
    setHeroP(1);
    setActiveImage(images.length - 1);
    // Only settle to the peek if the user didn't take over scrolling
    if (scrollAssist) {
      setScrollY(peekAmount());
    }
    scrollAssist = false;
    showIntro();
    if (expandRaf) {
      cancelAnimationFrame(expandRaf);
      expandRaf = 0;
    }
  };

  const expandDurationMs = (fromP) => {
    const sizeVel = Math.max(scrollVel, 0) * (SCRUB_MAX / TRIGGER);
    const remaining = Math.max(0.001, 1 - fromP);
    if (sizeVel < 1e-6) return EXPAND_MS_MAX;
    const ms = (3 * remaining) / sizeVel;
    return Math.min(EXPAND_MS_MAX, Math.max(EXPAND_MS_MIN, ms));
  };

  // Hand control back to scroll so upward motion can reverse live
  const interruptExpandToScroll = () => {
    if (!expanding) return;
    if (expandRaf) {
      cancelAnimationFrame(expandRaf);
      expandRaf = 0;
    }
    expanding = false;
    scrollAssist = false;
    expanded = true;
    hero.classList.remove('is-expanding');
    hero.classList.add('is-expanded');
    showIntro();
    // Keep p/scroll in sync for a continuous reverse scrub
    const peek = peekAmount();
    setScrollY(currentP * peek);
  };

  const startExpand = (fromP) => {
    if (expanding || expanded) return;
    expanding = true;
    scrollAssist = true;
    hero.classList.add('is-expanding');

    // Drop the scrub runway now so it can't leave dead scroll after the anim.
    // Sticky still fills the viewport, so resetting scroll to 0 is invisible.
    hero.classList.add('is-expanded');
    setScrollY(0);
    setHeroP(fromP);
    showIntro();

    if (reduceMotion) {
      finishExpand();
      return;
    }

    const duration = expandDurationMs(fromP);
    const started = performance.now();
    const startP = fromP;
    const targetY = peekAmount();

    const tick = (now) => {
      if (!expanding) return;
      const t = Math.min(1, (now - started) / duration);
      const eased = easeOutCubic(t);
      setHeroP(startP + (1 - startP) * eased);
      // Ease toward the title peek only while the user hasn't taken over
      if (scrollAssist) {
        setScrollY(targetY * eased);
      }
      if (t < 1) {
        expandRaf = requestAnimationFrame(tick);
      } else {
        expandRaf = 0;
        finishExpand();
      }
    };
    expandRaf = requestAnimationFrame(tick);
  };

  const scrollProgress = () => {
    const range = Math.max(1, hero.offsetHeight - window.innerHeight);
    const scrolled = Math.min(range, Math.max(0, -hero.getBoundingClientRect().top));
    return scrolled / range;
  };

  const sampleVelocity = (raw) => {
    const now = performance.now();
    if (lastTime) {
      const dt = now - lastTime;
      if (dt > 0 && dt < 120) {
        const instant = (raw - lastRaw) / dt;
        scrollVel = scrollVel * 0.55 + instant * 0.45;
      }
    }
    lastRaw = raw;
    lastTime = now;
  };

  // Expanded: scroll position drives size (peek ↔ full reverse)
  const updateExpanded = () => {
    const y = getScrollY();
    const peek = Math.max(1, peekAmount());
    sampleVelocity(y / peek);

    if (y <= 2) {
      resetToScrub();
      return;
    }

    if (y >= peek) {
      setHeroP(1);
      return;
    }

    // Scroll back through the peek range = play the expand backwards
    setHeroP(y / peek);
  };

  const update = () => {
    raf = 0;

    if (expanding) return;

    if (expanded) {
      updateExpanded();
      return;
    }

    const raw = scrollProgress();
    sampleVelocity(raw);

    if (raw >= TRIGGER) {
      scrubP = SCRUB_MAX;
      setHeroP(scrubP);
      startExpand(scrubP);
      return;
    }

    scrubP = (raw / TRIGGER) * SCRUB_MAX;
    setHeroP(scrubP);
  };

  const requestUpdate = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  const onWheel = (event) => {
    if (reduceMotion || !expanding) return;
    if (event.deltaY < 0) {
      // Scroll up — bail out of auto-expand into reverse-scrub mode
      interruptExpandToScroll();
      requestUpdate();
      return;
    }
    if (event.deltaY > 0) {
      // User keeps scrolling down — stop hijacking scroll; size anim continues
      scrollAssist = false;
    }
  };

  const onTouchMove = () => {
    if (!expanding || !scrollAssist) return;
    scrollAssist = false;
  };

  setActiveImage(0);
  setHeroP(0);

  if (reduceMotion) {
    startExpand(0);
  } else {
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    if (window.__lenis) {
      window.__lenis.on('scroll', requestUpdate);
    }
  }

  cleanups.push(() => {
    window.removeEventListener('scroll', requestUpdate);
    window.removeEventListener('resize', requestUpdate);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchmove', onTouchMove);
    window.__lenis?.off?.('scroll', requestUpdate);
    if (raf) cancelAnimationFrame(raf);
    if (expandRaf) cancelAnimationFrame(expandRaf);
  });
}

function bindAboutHeroName(cleanups, reduceMotion) {
  const name = document.querySelector('[data-about-hero-name]');
  const words = [...document.querySelectorAll('[data-about-hero-word]')];
  if (!name || !words.length) {
    return;
  }

  let settleTimer = 0;

  const settle = () => {
    name.classList.add('is-settled');
    words.forEach((word) => {
      word.style.animation = 'none';
      word.style.opacity = '1';
      word.style.color = '';
      word.style.transform = 'translate(0, 0) rotate(0deg)';
    });
  };

  const play = () => {
    name.classList.remove('is-settled');
    words.forEach((word) => {
      word.style.opacity = '';
      word.style.color = '';
      word.style.transform = '';
      word.style.animation = 'none';
      setIntroTitlePoseVars(word, buildIntroTitleEntrancePoses());
    });
    void name.offsetWidth;
    words.forEach((word) => {
      word.style.animation = '';
    });

    const styles = getComputedStyle(name);
    const start = (parseFloat(styles.getPropertyValue('--title-start')) || 0.12) * 1000;
    const stagger = (parseFloat(styles.getPropertyValue('--title-stagger')) || 0.07) * 1000;
    const duration = (parseFloat(styles.getPropertyValue('--title-duration')) || 0.9) * 1000;
    const total = start + stagger * Math.max(0, words.length - 1) + duration + 40;

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, total);
  };

  if (reduceMotion) {
    settle();
  } else {
    play();
  }

  cleanups.push(() => {
    window.clearTimeout(settleTimer);
  });
}

function bindAboutQuoteMarquee(cleanups, reduceMotion) {
  const root = document.querySelector('[data-quote-marquee]');
  const track = root?.querySelector('[data-quote-track]');
  if (!root || !track) return;

  const originals = [...track.children];
  if (!originals.length) return;

  originals.forEach((node) => {
    track.appendChild(node.cloneNode(true));
  });

  const cards = () => [...track.querySelectorAll('.about-quote')];
  let offset = 0;
  let raf = 0;
  let halfWidth = 0;
  let dragging = false;
  let selecting = false;
  let lastPointerX = 0;
  let lastPointerT = 0;
  let velocity = 0;
  let pointerId = null;
  let lastFrameT = performance.now();

  const AUTO_SPEED = reduceMotion ? 0 : 0.22;
  const SCALE_MIN = 0.78;
  const SCALE_MAX = 1.12;
  const ARC_DROP = 64; // base drop at ~half viewport
  const ARC_ROT = 16;
  const FRICTION = 0.955;
  const MIN_VELOCITY = 0.02;
  const FLICK_BOOST = 1.2;

  function measure() {
    halfWidth = track.scrollWidth / 2;
  }

  function wrapOffset() {
    if (halfWidth <= 0) return;
    while (-offset >= halfWidth) offset += halfWidth;
    while (offset > 0) offset -= halfWidth;
  }

  function applyTrack() {
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
  }

  function updateScales() {
    const bounds = root.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    // Reference distance ≈ half the visible stage — arc keeps going past this
    const refDist = Math.max(bounds.width * 0.42, 1);
    let closest = null;
    let closestDist = Infinity;

    cards().forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const delta = cardCenter - centerX;
      const dist = Math.abs(delta);
      const u = dist / refDist; // uncapped — grows past the edges
      const uClamped = Math.min(1, u);
      const scale = SCALE_MAX - (SCALE_MAX - SCALE_MIN) * (uClamped * uClamped);
      // Continue the downward arc past the sides (no plateau)
      const y = ARC_DROP * u * u;
      const rot = Math.sign(delta || 1) * Math.min(22, ARC_ROT * u);
      // Fade as cards leave the stage
      const fade = Math.min(1, Math.max(0, (u - 0.55) / 0.85));
      const opacity = 1 - fade * fade;

      card.style.setProperty('--quote-scale', scale.toFixed(4));
      card.style.setProperty('--quote-y', `${y.toFixed(2)}px`);
      card.style.setProperty('--quote-rot', `${rot.toFixed(3)}deg`);
      card.style.setProperty('--quote-opacity', opacity.toFixed(3));
      card.style.zIndex = String(Math.round((1 - uClamped) * 40));
      card.classList.toggle('is-center', false);
      if (dist < closestDist) {
        closestDist = dist;
        closest = card;
      }
    });

    closest?.classList.add('is-center');
  }

  function hasSelectionInQuotes() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    const node = sel.anchorNode;
    if (!node) return false;
    const el = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(el && root.contains(el));
  }

  function tick(now) {
    const dt = Math.min(32, now - lastFrameT);
    lastFrameT = now;

    const freezeMotion = selecting || hasSelectionInQuotes();

    if (!dragging && !freezeMotion) {
      if (Math.abs(velocity) > MIN_VELOCITY) {
        offset += velocity * dt;
        velocity *= FRICTION;
        if (Math.abs(velocity) <= MIN_VELOCITY) velocity = 0;
        wrapOffset();
        applyTrack();
      } else if (AUTO_SPEED > 0 && halfWidth > 0) {
        offset -= AUTO_SPEED * (dt / 16.67);
        wrapOffset();
        applyTrack();
      }
    }

    updateScales();
    raf = requestAnimationFrame(tick);
  }

  function isSelectableTextTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('[data-quote-selectable]'));
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    // Let native text selection work; scrub only from non-text card chrome.
    if (isSelectableTextTarget(event.target)) {
      selecting = true;
      velocity = 0;
      return;
    }
    selecting = false;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && hasSelectionInQuotes()) {
      sel.removeAllRanges();
    }
    dragging = true;
    velocity = 0;
    lastPointerX = event.clientX;
    lastPointerT = performance.now();
    pointerId = event.pointerId;
    root.classList.add('is-scrubbing');
    try {
      root.setPointerCapture(pointerId);
    } catch (_) {
      /* ignore */
    }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = event.clientX - lastPointerX;
    const dt = Math.max(1, now - lastPointerT);
    lastPointerX = event.clientX;
    lastPointerT = now;
    offset += dx;
    velocity = velocity * 0.55 + (dx / dt) * 0.45;
    wrapOffset();
    applyTrack();
    updateScales();
  }

  function endDrag(event) {
    if (!dragging) {
      selecting = false;
      return;
    }
    if (pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    selecting = false;
    pointerId = null;
    root.classList.remove('is-scrubbing');
    velocity *= FLICK_BOOST;
    try {
      if (event.pointerId != null) root.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* ignore */
    }
  }

  measure();
  applyTrack();
  updateScales();
  lastFrameT = performance.now();
  raf = requestAnimationFrame(tick);

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('lostpointercapture', endDrag);

  const onResize = () => {
    measure();
    wrapOffset();
    applyTrack();
  };
  window.addEventListener('resize', onResize);

  cleanups.push(() => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', endDrag);
    root.removeEventListener('pointercancel', endDrag);
    root.removeEventListener('lostpointercapture', endDrag);
    window.removeEventListener('resize', onResize);
  });
}



function bindAboutAwardBadges(cleanups, reduceMotion) {
  const caseEl = document.querySelector('[data-award-case]');
  if (!caseEl) return;

  const badges = [...caseEl.querySelectorAll('[data-award-badge]')];
  if (!badges.length) return;

  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (isTouch) caseEl.classList.add('is-touch');

  function revealAwards() {
    if (caseEl.classList.contains('is-in')) return;
    caseEl.classList.add('is-in');
    const items = caseEl.querySelectorAll('.about-awards__badges li');
    window.setTimeout(() => {
      items.forEach((item) => item.classList.add('is-settled'));
    }, 48 * 12 + 700);
  }

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealAwards();
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealAwards();
        revealObserver.disconnect();
      });
    }, {
      rootMargin: '20% 0px -5% 0px',
      threshold: 0.02,
    });
    revealObserver.observe(caseEl);
    cleanups.push(() => revealObserver.disconnect());
  }

  const DECAY_PER_MS = 1 / 60000; // ~60s dull from full shine
  const POLISH_NEED = 520;
  const BURST_COUNT = 3;
  const state = new Map();

  badges.forEach((badge) => {
    state.set(badge, {
      shine: 0,
      wipe: 0,
      lastX: 0,
      lastY: 0,
      lastDir: 0,
      lastWipeAt: 0,
      polishing: false,
      wasShiny: false,
      complete: false,
      painted: -1,
    });
    applyShine(badge, 0, true);
  });

  let activeBadge = null;
  let raf = 0;
  let lastTs = performance.now();
  let running = true;
  let loopActive = false;
  let caseVisible = true;

  function ensureBursts(badge) {
    const layer = badge.querySelector('.about-award-seal__bursts');
    if (!layer || layer.childElementCount >= BURST_COUNT) return;

    for (let i = 0; i < BURST_COUNT; i += 1) {
      const star = document.createElement('span');
      star.className = 'about-award-seal__burst';
      star.style.left = `${18 + Math.random() * 64}%`;
      star.style.top = `${18 + Math.random() * 64}%`;
      star.style.animationDelay = `${i * 0.7 + Math.random() * 0.6}s`;
      star.style.animationDuration = `${2.8 + Math.random() * 1.2}s`;
      layer.appendChild(star);
    }
  }

  function applyShine(badge, shine, force = false) {
    const s = Math.max(0, Math.min(1, shine));
    const st = state.get(badge);
    const painted = Math.round(s * 50) / 50;
    if (!force && painted === st.painted) {
      st.shine = s;
      return;
    }
    st.painted = painted;
    st.shine = s;
    badge.style.setProperty('--shine', painted.toFixed(2));
    badge.dataset.shine = painted.toFixed(2);

    const complete = s >= 0.92 ? true : s < 0.55 ? false : st.complete;
    if (complete !== st.complete) {
      st.complete = complete;
      badge.classList.toggle('is-complete', complete);
      if (complete) ensureBursts(badge);
    } else if (complete) {
      ensureBursts(badge);
    }
  }

  function startLoop() {
    if (loopActive || !running) return;
    loopActive = true;
    lastTs = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function polishAt(badge, clientX, clientY) {
    const st = state.get(badge);
    if (!st) return;

    const rect = badge.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    badge.style.setProperty('--wipe-x', `${((clientX - rect.left) / w) * 100}%`);
    badge.style.setProperty('--wipe-y', `${((clientY - rect.top) / h) * 100}%`);

    if (!st.polishing) {
      st.polishing = true;
      st.lastX = clientX;
      st.lastY = clientY;
      st.lastDir = 0;
      st.lastWipeAt = performance.now();
      badge.classList.add('is-polishing');
      startLoop();
      return;
    }

    const dx = clientX - st.lastX;
    const dy = clientY - st.lastY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.2) return;

    const dir = Math.sign(Math.abs(dx) >= Math.abs(dy) ? dx : dy);
    let gain = dist * 0.45;
    if (dir && st.lastDir && dir !== st.lastDir) {
      gain = dist * 2.4;
    }

    st.wipe = Math.min(POLISH_NEED, st.wipe + gain);
    const next = st.wipe / POLISH_NEED;
    const crossed = !st.wasShiny && next >= 0.92;
    st.shine = Math.max(st.shine, next);
    st.lastWipeAt = performance.now();
    applyShine(badge, st.shine);
    startLoop();

    if (crossed) {
      st.wasShiny = true;
      badge.classList.remove('is-just-shined');
      void badge.offsetWidth;
      badge.classList.add('is-just-shined');
      window.setTimeout(() => badge.classList.remove('is-just-shined'), 600);
    }

    if (dir) st.lastDir = dir;
    st.lastX = clientX;
    st.lastY = clientY;
  }

  function endPolish(badge) {
    if (!badge) return;
    const st = state.get(badge);
    if (!st) return;
    st.polishing = false;
    badge.classList.remove('is-polishing');
  }

  function tick(ts) {
    if (!running) {
      loopActive = false;
      return;
    }

    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    let keepGoing = false;

    state.forEach((st, badge) => {
      if (st.polishing && ts - st.lastWipeAt > 220) {
        st.polishing = false;
        badge.classList.remove('is-polishing');
        if (activeBadge === badge && !isTouch) activeBadge = null;
      }

      if (st.polishing) {
        keepGoing = true;
        return;
      }

      if (st.shine > 0) {
        const decay = reduceMotion ? DECAY_PER_MS * 0.65 : DECAY_PER_MS;
        st.shine = Math.max(0, st.shine - dt * decay);
        st.wipe = st.shine * POLISH_NEED;
        if (st.shine < 0.5) st.wasShiny = false;
        applyShine(badge, st.shine);
        if (st.shine > 0) keepGoing = true;
      }
    });

    if (keepGoing) {
      raf = requestAnimationFrame(tick);
    } else {
      loopActive = false;
    }
  }

  const onPointerLeaveCase = () => {
    endPolish(activeBadge);
    activeBadge = null;
  };

  const onPointerMove = (event) => {
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const badge = under?.closest?.('[data-award-badge]');
    if (!badge || !caseEl.contains(badge)) {
      if (activeBadge && event.buttons !== 1) {
        endPolish(activeBadge);
        activeBadge = null;
      }
      return;
    }

    if (event.buttons === 1 || event.pointerType === 'touch' || activeBadge === badge) {
      if (activeBadge && activeBadge !== badge) endPolish(activeBadge);
      activeBadge = badge;
      polishAt(badge, event.clientX, event.clientY);
    } else if (!isTouch) {
      const st = state.get(badge);
      if (!st) return;
      if (!st.polishing) {
        st.polishing = true;
        st.lastX = event.clientX;
        st.lastY = event.clientY;
        st.lastDir = 0;
        st.lastWipeAt = performance.now();
        badge.classList.add('is-polishing');
        activeBadge = badge;
        startLoop();
        return;
      }
      const dx = event.clientX - st.lastX;
      const dy = event.clientY - st.lastY;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) return;
      const dir = Math.sign(Math.abs(dx) >= Math.abs(dy) ? dx : dy);
      let gain = dist * 0.2;
      if (dir && st.lastDir && dir !== st.lastDir) gain = dist * 1.15;
      st.wipe = Math.min(POLISH_NEED, st.wipe + gain);
      st.shine = Math.max(st.shine, st.wipe / POLISH_NEED);
      st.lastWipeAt = performance.now();
      applyShine(badge, st.shine);
      const rect = badge.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      badge.style.setProperty('--wipe-x', `${((event.clientX - rect.left) / w) * 100}%`);
      badge.style.setProperty('--wipe-y', `${((event.clientY - rect.top) / h) * 100}%`);
      if (dir) st.lastDir = dir;
      st.lastX = event.clientX;
      st.lastY = event.clientY;
      activeBadge = badge;
      startLoop();
    }
  };

  const onPointerDown = (event) => {
    const badge = event.target.closest?.('[data-award-badge]');
    if (!badge || !caseEl.contains(badge)) return;
    event.preventDefault();
    activeBadge = badge;
    try {
      badge.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    polishAt(badge, event.clientX, event.clientY);
  };

  const onPointerUp = (event) => {
    if (activeBadge) {
      try {
        activeBadge.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    endPolish(activeBadge);
    activeBadge = null;
  };

  caseEl.addEventListener('pointerleave', onPointerLeaveCase);
  caseEl.addEventListener('pointermove', onPointerMove);
  caseEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  let visibilityObserver = null;
  if ('IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver((entries) => {
      caseVisible = entries.some((entry) => entry.isIntersecting);
      caseEl.classList.toggle('is-offscreen', !caseVisible);
    }, { rootMargin: '40px', threshold: 0 });
    visibilityObserver.observe(caseEl);
  }

  cleanups.push(() => {
    running = false;
    loopActive = false;
    cancelAnimationFrame(raf);
    visibilityObserver?.disconnect();
    caseEl.removeEventListener('pointerleave', onPointerLeaveCase);
    caseEl.removeEventListener('pointermove', onPointerMove);
    caseEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    endPolish(activeBadge);
  });
}

function bindAboutPage() {
  unbindAboutPage();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanups = [];

  bindAboutHero(cleanups, reduceMotion);
  bindAboutHeroName(cleanups, reduceMotion);
  bindAboutQuoteMarquee(cleanups, reduceMotion);
  bindAboutAwardBadges(cleanups, reduceMotion);

  const nodes = [...document.querySelectorAll('.about-reveal:not([data-about-intro])')];
  if (nodes.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-in'));
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      }, {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12,
      });
      nodes.forEach((node) => observer.observe(node));
      cleanups.push(() => observer.disconnect());
    }
  }

  aboutPageCleanup = () => {
    cleanups.forEach((fn) => fn());
    aboutPageCleanup = null;
  };
}

function unbindAboutPage() {
  aboutPageCleanup?.();
  aboutPageCleanup = null;
}

const contactButton = document.querySelector('.contact-button');
const toast = document.getElementById('toast');
const main = document.querySelector('main');
const body = document.body;
let gradientContainer = document.querySelector('.hero-gradient');
let toastTimeout;
let toastHideTimeout;
let contactPopover;
let contactPopoverTimeout;
let contactPopoverHideTimeout;
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
  const isProjectPage = document.body.dataset.page === 'project';

  if (isProjectPage) {
    const header = document.querySelector('.site-header');
    const headerRect = header?.getBoundingClientRect() ?? rect;
    popover.classList.add('contact-popover--side');
    popover.style.left = `${headerRect.right}px`;
    popover.style.top = `${rect.top + rect.height / 2}px`;
    return;
  }

  popover.classList.remove('contact-popover--side');
  popover.style.left = `${rect.left + rect.width / 2}px`;
  popover.style.top = `${rect.bottom}px`;
}

function hideContactPopover() {
  contactPopoverAnchor = null;
  const popover = contactPopover;
  if (!popover) {
    return;
  }

  clearTimeout(contactPopoverHideTimeout);

  if (!popover.classList.contains('contact-popover--visible')) {
    popover.classList.remove('contact-popover--leaving');
    return;
  }

  popover.classList.remove('contact-popover--visible');
  popover.classList.add('contact-popover--leaving');
  contactPopoverHideTimeout = setTimeout(() => {
    popover.classList.remove('contact-popover--leaving');
  }, 240);
}

function showContactPopover(button, message) {
  const popover = getContactPopover();
  const text = popover.querySelector('.contact-popover__text');

  contactPopoverAnchor = button;
  text.textContent = message;
  positionContactPopover(button);

  clearTimeout(contactPopoverHideTimeout);
  popover.classList.remove('contact-popover--visible', 'contact-popover--leaving');
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
  clearTimeout(toastHideTimeout);
  toast.classList.remove('toast--visible', 'toast--leaving');
  toast.textContent = message;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--leaving');
    toastHideTimeout = setTimeout(() => {
      toast.classList.remove('toast--leaving');
    }, 240);
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
    if (element.closest('.work-about__panel')) {
      return 'link';
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
      if (target.closest('[data-award-case]')) {
        return null;
      }
      return target.closest('.about-quote')
        || target.closest('.about-traits__list li')
        || target.closest('.about-press__link')
        || target.closest('.about-bento__cell--brand')
        || target.closest(INTERACTIVE_SELECTOR);
    }

    return target.closest('.work-about__panel')
      || target.closest('.project-item')
      || target.closest(INTERACTIVE_SELECTOR);
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
