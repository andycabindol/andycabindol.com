const NAV_STATE_KEY = 'site-nav-state';
const PAGE_ROUTES = {
  work: { url: '/index.html', styles: '/styles.css' },
  about: { url: '/about.html', styles: '/about.css' },
  project: {
    url: document.body?.dataset.page === 'project'
      ? `${window.location.pathname}${window.location.search}`
      : '/projects/lens-usage/',
    styles: '/project.css',
  },
};

let isPageTransitioning = false;
let isIndicatorPageAnimating = false;
let isNavBootstrapping = true;
let navScrollHandler = null;
let indicatorRaf = 0;
let indicatorTrackRaf = 0;
let lastContentUrl = `${window.location.pathname}${window.location.search}`;

function markIndicatorReady() {
  document.querySelector('.site-nav-indicator')?.classList.add('site-nav-indicator--ready');
}

function readNavIndicatorPose(indicator) {
  const transform = indicator.style.transform || '';
  const match = transform.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
  return {
    x: match ? parseFloat(match[1]) : 0,
    y: match ? parseFloat(match[2]) : 0,
    w: parseFloat(indicator.style.width) || indicator.offsetWidth,
    h: parseFloat(indicator.style.height) || indicator.offsetHeight,
  };
}

function applyNavIndicatorPose(indicator, pose) {
  indicator.style.width = `${pose.w}px`;
  indicator.style.height = `${pose.h}px`;
  indicator.style.transform = `translate(${pose.x}px, ${pose.y}px)`;
}

function scalePoseTowardCenter(pose, scale) {
  const s = Math.max(0, scale);
  return {
    x: pose.x + (pose.w * (1 - s)) / 2,
    y: pose.y + (pose.h * (1 - s)) / 2,
    w: Math.max(0, pose.w * s),
    h: Math.max(0, pose.h * s),
  };
}

// Matches --motion-smooth: cubic-bezier(0.22, 1.28, 0.36, 1)
function easeMotionSmooth(t) {
  const cx = 3 * 0.22;
  const bx = 3 * (0.36 - 0.22) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * 1.28;
  const by = 3 * (1 - 1.28) - cy;
  const ay = 1 - cy - by;

  let x = t;
  for (let i = 0; i < 6; i += 1) {
    const xEst = ((ax * x + bx) * x + cx) * x - t;
    const dx = (3 * ax * x + 2 * bx) * x + cx;
    if (Math.abs(dx) < 1e-6) break;
    x -= xEst / dx;
  }

  return ((ay * x + by) * x + cy) * x;
}

function animateNavIndicatorScaleSmooth(indicator, basePose, fromScale, toScale, { duration = 420 } = {}) {
  cancelAnimationFrame(indicatorTrackRaf);
  indicator.classList.remove('site-nav-indicator--tracking', 'site-nav-indicator--animating');
  isIndicatorPageAnimating = true;

  return new Promise((resolve) => {
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const scale = fromScale + (toScale - fromScale) * easeMotionSmooth(t);
      applyNavIndicatorPose(indicator, scalePoseTowardCenter(basePose, scale));

      if (t < 1) {
        indicatorTrackRaf = requestAnimationFrame(tick);
        return;
      }

      applyNavIndicatorPose(indicator, scalePoseTowardCenter(basePose, toScale));
      isIndicatorPageAnimating = false;
      resolve();
    }

    indicatorTrackRaf = requestAnimationFrame(tick);
  });
}

async function hideNavIndicatorSmooth() {
  const indicator = document.querySelector('.site-nav-indicator');
  if (!indicator?.classList.contains('site-nav-indicator--ready')) {
    return;
  }

  const pose = readNavIndicatorPose(indicator);
  if (pose.w < 1 || pose.h < 1) {
    indicator.classList.remove('site-nav-indicator--ready');
    return;
  }

  await animateNavIndicatorScaleSmooth(indicator, pose, 1, 0);
  indicator.classList.remove('site-nav-indicator--ready');
}

async function showNavIndicatorSmooth(targetLink) {
  const nav = document.querySelector('.site-nav');
  const indicator = nav?.querySelector('.site-nav-indicator');
  if (!indicator || !targetLink) {
    return;
  }

  const toPose = {
    x: targetLink.offsetLeft,
    y: targetLink.offsetTop,
    w: targetLink.offsetWidth,
    h: targetLink.offsetHeight,
  };

  applyNavIndicatorPose(indicator, scalePoseTowardCenter(toPose, 0));
  indicator.classList.add('site-nav-indicator--ready');
  await animateNavIndicatorScaleSmooth(indicator, toPose, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function buildNavIndicatorStepPoses(from, to) {
  // Windup → overshoot → undershoot → settle (square steps).
  const progressSteps = [0, -0.04, 1.06, 0.98, 1];
  return progressSteps.map((p) => ({
    x: lerp(from.x, to.x, p),
    y: lerp(from.y, to.y, p),
    w: Math.max(0, lerp(from.w, to.w, p)),
    h: Math.max(0, lerp(from.h, to.h, p)),
  }));
}

function animateNavIndicatorStepped(indicator, toPose, { stepMs = 85 } = {}) {
  cancelAnimationFrame(indicatorTrackRaf);
  indicator.classList.remove('site-nav-indicator--tracking', 'site-nav-indicator--animating');

  const from = readNavIndicatorPose(indicator);
  const poses = buildNavIndicatorStepPoses(from, toPose);

  return new Promise((resolve) => {
    let index = 0;

    function tick() {
      applyNavIndicatorPose(indicator, poses[index]);
      index += 1;
      if (index >= poses.length) {
        resolve();
        return;
      }
      window.setTimeout(tick, stepMs);
    }

    tick();
  });
}

function positionNavIndicator() {
  const nav = document.querySelector('.site-nav');
  const indicator = nav?.querySelector('.site-nav-indicator');
  const active = nav?.querySelector('.site-nav-item--active');
  if (!nav || !indicator || !active) {
    return;
  }

  applyNavIndicatorPose(indicator, {
    x: active.offsetLeft,
    y: active.offsetTop,
    w: active.offsetWidth,
    h: active.offsetHeight,
  });
  markIndicatorReady();
}

function schedulePositionNavIndicator() {
  if (isPageTransitioning || isIndicatorPageAnimating || isNavBootstrapping) {
    return;
  }

  cancelAnimationFrame(indicatorRaf);
  indicatorRaf = requestAnimationFrame(() => {
    indicatorRaf = 0;
    positionNavIndicator();
  });
}

function trackNavIndicator(duration = 460) {
  if (isPageTransitioning || isIndicatorPageAnimating || isNavBootstrapping) {
    return;
  }
  cancelAnimationFrame(indicatorTrackRaf);
  const indicator = document.querySelector('.site-nav-indicator');
  const end = performance.now() + duration;
  indicator?.classList.add('site-nav-indicator--tracking');

  function tick(now) {
    positionNavIndicator();
    if (now < end) {
      indicatorTrackRaf = requestAnimationFrame(tick);
      return;
    }

    indicator?.classList.remove('site-nav-indicator--tracking');
    positionNavIndicator();
  }

  indicatorTrackRaf = requestAnimationFrame(tick);
}

function initNavIndicatorObserver() {
  const nav = document.querySelector('.site-nav');
  const header = document.querySelector('.site-header');
  if (!nav || typeof ResizeObserver === 'undefined') {
    return;
  }

  const observer = new ResizeObserver(() => {
    if (isNavBootstrapping) {
      return;
    }
    schedulePositionNavIndicator();
  });

  observer.observe(nav);
  nav.querySelectorAll('.site-nav-item').forEach((item) => observer.observe(item));
  if (header) {
    observer.observe(header);
  }

  const pillContent = document.querySelector('.nav-pill__content');
  if (pillContent) {
    observer.observe(pillContent);
  }
}

function debounceNav(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getCurrentPage() {
  const page = document.body.dataset.page;
  if (page === 'about' || page === 'project') {
    return page;
  }
  return 'work';
}

function getPageFromUrl(url) {
  const path = new URL(url, window.location.href).pathname;
  if (path.endsWith('about.html') || path.endsWith('/about')) {
    return 'about';
  }
  if (path.includes('/projects/') || path.endsWith('project.html') || path.endsWith('/project')) {
    return 'project';
  }
  if (path === '/' || path.endsWith('index.html')) {
    return 'work';
  }
  return 'work';
}

function positionNavIndicatorTo(element) {
  const nav = document.querySelector('.site-nav');
  const indicator = nav?.querySelector('.site-nav-indicator');
  if (!nav || !indicator || !element) {
    return Promise.resolve();
  }

  cancelAnimationFrame(indicatorTrackRaf);
  indicator.classList.remove('site-nav-indicator--tracking', 'site-nav-indicator--animating');
  isIndicatorPageAnimating = true;

  return animateNavIndicatorStepped(indicator, {
    x: element.offsetLeft,
    y: element.offsetTop,
    w: element.offsetWidth,
    h: element.offsetHeight,
  }).then(() => {
    isIndicatorPageAnimating = false;
  });
}

function setNavActive(page) {
  const activePage = page;
  document.querySelectorAll('[data-nav]').forEach((item) => {
    const isActive = item.dataset.nav === activePage;
    item.classList.toggle('site-nav-item--active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  if (page === 'project') {
    // Page transitions animate the indicator out; only hide instantly on cold loads.
    if (!isPageTransitioning) {
      document.querySelector('.site-nav-indicator')?.classList.remove('site-nav-indicator--ready');
    }
    return;
  }

  if (isPageTransitioning || isIndicatorPageAnimating) {
    return;
  }

  positionNavIndicator();
}

function getTransitionOverlay() {
  let overlay = document.getElementById('page-transition');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'page-transition';
    overlay.className = 'page-transition';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }
  return overlay;
}

function fadeToWhite() {
  const overlay = getTransitionOverlay();
  overlay.classList.add('page-transition--visible');
  return wait(400);
}

function fadeFromWhite() {
  const overlay = getTransitionOverlay();
  overlay.classList.remove('page-transition--visible');
  return wait(400);
}

function restoreNavState() {
  const raw = sessionStorage.getItem(NAV_STATE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const state = JSON.parse(raw);
    const header = document.querySelector('.site-header');
    if (!header) {
      return false;
    }

    header.classList.add('site-header--instant');
    header.classList.toggle('site-header--compact', Boolean(state.compact));
    header.classList.toggle('site-header--scroll-up', Boolean(state.scrollUp));
    document.getElementById('page-main')?.classList.add('page-main--instant');
    sessionStorage.removeItem(NAV_STATE_KEY);
    return true;
  } catch {
    sessionStorage.removeItem(NAV_STATE_KEY);
    return false;
  }
}

function setNavTransitionLock(locked) {
  document.querySelector('.site-header')?.classList.toggle('site-header--nav-lock', locked);
}

function initNavMorph() {
  const header = document.querySelector('.site-header');
  if (!header) {
    return () => {};
  }

  const SCROLL_THRESHOLD = 10;
  const SCROLL_UP_DELTA = 42;
  const EXPANDED_RATIO = 1.04;
  const shouldLockCompact = () => document.body.dataset.page === 'project';
  let compactWidth = null;
  let isCompact = false;
  let isScrollUp = header.classList.contains('site-header--scroll-up');
  let lastScrollY = NaN;
  let scrollUpFromY = null;
  let preserveNavCompact = false;
  let preserveNavScrollUp = false;
  let pendingScrollReset = false;
  const restored = restoreNavState();
  header.classList.add('site-header--bootstrapping');

  // Project pages stay in the compact pill — never settle to the top-of-page default.
  if (shouldLockCompact()) {
    header.classList.add('site-header--compact');
    isCompact = true;
  }

  function getAvailableNavWidth() {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;visibility:hidden;pointer-events:none;width:var(--nav-padding, var(--page-padding));';
    document.body.appendChild(probe);
    const pad = probe.offsetWidth || 16;
    probe.remove();
    return Math.max(0, document.documentElement.clientWidth - pad * 2);
  }

  function measureCompactWidth() {
    const wasCompact = header.classList.contains('site-header--compact');
    const wasScrollUp = header.classList.contains('site-header--scroll-up');
    const navLinks = [...document.querySelectorAll('[data-nav]')];
    const activeLink = document.querySelector('[data-nav].site-nav-item--active');
    const projectContext = header.querySelector('.nav-pill__project-context');
    const projectContextDisplay = projectContext?.style.display;

    header.classList.add('site-header--nav-lock', 'site-header--compact');
    header.classList.remove('site-header--scroll-up');
    // Measure intrinsic content size without max-width clamp or scroll-up scale.
    // Project titles must not inflate compact width (they're clipped + marquee).
    if (projectContext) {
      projectContext.style.display = 'none';
    }
    header.style.width = 'max-content';
    header.style.maxWidth = 'none';
    header.style.transform = 'none';

    let maxWidth = 0;
    navLinks.forEach((link) => {
      navLinks.forEach((item) => item.classList.remove('site-nav-item--active'));
      link.classList.add('site-nav-item--active');
      void header.offsetWidth;
      maxWidth = Math.max(maxWidth, header.offsetWidth);
    });

    navLinks.forEach((item) => item.classList.remove('site-nav-item--active'));
    activeLink?.classList.add('site-nav-item--active');

    compactWidth = Math.min(maxWidth, getAvailableNavWidth());
    header.style.width = '';
    header.style.maxWidth = '';
    header.style.transform = '';
    if (projectContext) {
      projectContext.style.display = projectContextDisplay || '';
    }

    if (!wasCompact) {
      header.classList.remove('site-header--compact');
    }

    if (wasScrollUp) {
      header.classList.add('site-header--scroll-up');
    }

    syncNavWidthVars();

    if (!isNavBootstrapping) {
      header.classList.remove('site-header--nav-lock');
      schedulePositionNavIndicator();
    } else {
      positionNavIndicator();
    }

    return compactWidth;
  }

  function syncNavWidthVars() {
    const available = getAvailableNavWidth();
    const compact = Math.min(compactWidth || 0, available);
    const expanded = Math.min(compact * EXPANDED_RATIO, available);
    header.style.setProperty('--nav-compact-width', `${compact}px`);
    header.style.setProperty('--nav-expanded-width', `${expanded}px`);
  }

  function setCompactState(shouldCompact) {
    if (shouldCompact === isCompact) {
      return;
    }

    isCompact = shouldCompact;
    header.classList.toggle('site-header--compact', isCompact);

    if (isNavBootstrapping) {
      positionNavIndicator();
      return;
    }

    trackNavIndicator(460);
  }

  function applyNavState(scrollY, force = false) {
    if (compactWidth === null) {
      measureCompactWidth();
    }

    let shouldCompact = shouldLockCompact() || scrollY >= SCROLL_THRESHOLD;
    if (preserveNavCompact && scrollY <= SCROLL_THRESHOLD) {
      shouldCompact = true;
    }

    if (force || shouldCompact !== isCompact) {
      setCompactState(shouldCompact);
    }
  }

  function updateNav() {
    const scrollY = window.__lenis?.scroll ?? window.scrollY;

    if (pendingScrollReset) {
      pendingScrollReset = false;
      lastScrollY = scrollY;

      if (scrollY <= SCROLL_THRESHOLD) {
        if (preserveNavScrollUp) {
          header.classList.add('site-header--scroll-up');
          isScrollUp = true;
        } else {
          header.classList.remove('site-header--scroll-up');
          isScrollUp = false;
          scrollUpFromY = null;
        }
      }

      if (preserveNavCompact) {
        setCompactState(true);
      } else {
        applyNavState(scrollY, true);
      }

      return;
    }

    const wasScrollUp = isScrollUp;

    if (
      preserveNavCompact
      && scrollY <= SCROLL_THRESHOLD
      && lastScrollY > SCROLL_THRESHOLD
    ) {
      preserveNavCompact = false;
      preserveNavScrollUp = false;
    }

    if (scrollY <= SCROLL_THRESHOLD) {
      if (!preserveNavScrollUp) {
        header.classList.remove('site-header--scroll-up');
        scrollUpFromY = null;
      }
    } else if (!Number.isNaN(lastScrollY) && scrollY !== lastScrollY) {
      if (scrollY > lastScrollY) {
        preserveNavScrollUp = false;
        header.classList.remove('site-header--scroll-up');
        scrollUpFromY = null;
      } else if (scrollY < lastScrollY) {
        if (scrollUpFromY === null) {
          scrollUpFromY = lastScrollY;
        }

        if (scrollUpFromY - scrollY >= SCROLL_UP_DELTA) {
          header.classList.add('site-header--scroll-up');
        } else {
          header.classList.remove('site-header--scroll-up');
        }
      }
    }

    isScrollUp = header.classList.contains('site-header--scroll-up');
    if (isScrollUp !== wasScrollUp) {
      trackNavIndicator(300);
    }

    if (Number.isNaN(lastScrollY) || scrollY !== lastScrollY) {
      applyNavState(scrollY);
    }

    lastScrollY = scrollY;
  }

  function remeasureNav(options = {}) {
    if (options.preserveVisualState && compactWidth !== null) {
      lastScrollY = window.__lenis?.scroll ?? window.scrollY;
      if (preserveNavCompact) {
        setCompactState(true);
      } else {
        applyNavState(lastScrollY, true);
      }
      schedulePositionNavIndicator();
      return;
    }

    compactWidth = null;
    measureCompactWidth();

    if (options.preserveVisualState) {
      lastScrollY = window.__lenis?.scroll ?? window.scrollY;
      if (preserveNavCompact) {
        setCompactState(true);
      } else {
        applyNavState(lastScrollY, true);
      }
      schedulePositionNavIndicator();
      return;
    }

    lastScrollY = NaN;
    applyNavState(window.__lenis?.scroll ?? window.scrollY, true);

    if (isNavBootstrapping) {
      positionNavIndicator();
      return;
    }

    if (options.animate) {
      trackNavIndicator(460);
    } else {
      schedulePositionNavIndicator();
    }
  }

  function finishNavBootstrap() {
    if (!isNavBootstrapping) {
      return;
    }

    positionNavIndicator();
    header.classList.remove('site-header--nav-lock', 'site-header--bootstrapping');
    isNavBootstrapping = false;
  }

  function prepareNavForPageSwap() {
    preserveNavCompact = header.classList.contains('site-header--compact');
    preserveNavScrollUp = header.classList.contains('site-header--scroll-up');
  }

  function markNavScrollResetPending() {
    pendingScrollReset = true;
  }

  function syncNavAfterScrollReset() {
    updateNav();
  }

  remeasureNav();
  initNavIndicatorObserver();

  window.addEventListener('resize', debounceNav(() => remeasureNav({ animate: true }), 150), { passive: true });

  if (navScrollHandler) {
    window.removeEventListener('scroll', navScrollHandler);
  }
  navScrollHandler = updateNav;
  window.addEventListener('scroll', navScrollHandler, { passive: true });

  if (restored) {
    requestAnimationFrame(() => schedulePositionNavIndicator());
  }

  window.__navRemeasure = remeasureNav;
  window.__navUpdate = updateNav;
  window.__navPreparePageSwap = prepareNavForPageSwap;
  window.__navMarkScrollReset = markNavScrollResetPending;
  window.__navSyncScroll = syncNavAfterScrollReset;
  window.__navFinishBootstrap = finishNavBootstrap;
  return updateNav;
}

async function loadPageStylesheet(href) {
  const link = document.getElementById('page-stylesheet');
  if (!link) {
    return;
  }

  const current = link.getAttribute('href');
  if (current === href || current?.endsWith(`/${href}`)) {
    return;
  }

  await new Promise((resolve) => {
    const finish = () => resolve();
    link.addEventListener('load', finish, { once: true });
    link.addEventListener('error', finish, { once: true });
    link.href = href;
    setTimeout(finish, 600);
  });
}

let projectContextRemoveTimer = 0;

function syncProjectNavContext(doc, page) {
  const pill = document.querySelector('.nav-pill');
  const currentContext = pill?.querySelector('.nav-pill__project-context');

  if (!pill) {
    return;
  }

  window.clearTimeout(projectContextRemoveTimer);

  if (page !== 'project') {
    // Keep the persistent element mounted while its shared CSS collapses it.
    if (currentContext) {
      projectContextRemoveTimer = window.setTimeout(() => {
        if (document.body.dataset.page !== 'project') {
          currentContext.remove();
        }
      }, 600);
    }
    return;
  }

  const nextContext = doc.querySelector('.nav-pill__project-context');
  if (!currentContext && nextContext) {
    const clone = nextContext.cloneNode(true);
    pill.appendChild(clone);
    // Establish the collapsed pose before data-page expands it.
    void clone.offsetHeight;
  }
}

async function swapPageContent(page, targetUrl = PAGE_ROUTES[page].url) {
  const route = PAGE_ROUTES[page];
  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${targetUrl}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nextMain = doc.getElementById('page-main');
  const nextFooter = doc.querySelector('.footer');
  const currentMain = document.getElementById('page-main');
  const currentFooter = document.querySelector('.footer');

  if (!nextMain || !currentMain) {
    throw new Error('Missing page content');
  }

  document.body.querySelector(':scope > .hero-gradient')?.remove();

  currentMain.className = nextMain.className;
  currentMain.innerHTML = nextMain.innerHTML;
  if (nextFooter && currentFooter) {
    currentFooter.replaceWith(nextFooter);
  }

  syncProjectNavContext(doc, page);
  document.body.dataset.page = page;
  if (doc.body.dataset.projectSlug) {
    document.body.dataset.projectSlug = doc.body.dataset.projectSlug;
  } else {
    delete document.body.dataset.projectSlug;
  }
  if (doc.body.getAttribute('style')) {
    document.body.setAttribute('style', doc.body.getAttribute('style'));
  } else {
    document.body.removeAttribute('style');
  }
    await loadPageStylesheet(route.styles);

  document.title = doc.title;
  setNavActive(page);

  window.__navMarkScrollReset?.();

  window.scrollTo(0, 0);
  if (window.__lenis) {
    window.__lenis.scrollTo(0, { immediate: true });
  }

  window.__asciiRemeasure?.();
  window.__navRemeasure?.({ preserveVisualState: true });
  window.__navSyncScroll?.();
  window.bootFooterPhysics?.();

  const resolved = new URL(targetUrl, window.location.href);
  lastContentUrl = `${resolved.pathname}${resolved.search}`;
}

async function navigateToPage(page, targetLink, targetUrl = PAGE_ROUTES[page].url) {
  const resolvedTarget = new URL(targetUrl, window.location.href);
  const nextContentUrl = `${resolvedTarget.pathname}${resolvedTarget.search}`;
  const sameDestination = nextContentUrl === lastContentUrl;

  if (isPageTransitioning || sameDestination) {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.href = targetUrl;
    return;
  }

  isPageTransitioning = true;
  const fromPage = getCurrentPage();
  window.__navPreparePageSwap?.();

  try {
    // Flip link colors immediately so they're correct as the pill arrives.
    setNavActive(page);

    let indicatorMove;
    if (page === 'project') {
      indicatorMove = hideNavIndicatorSmooth();
    } else if (fromPage === 'project') {
      indicatorMove = showNavIndicatorSmooth(targetLink);
    } else {
      indicatorMove = positionNavIndicatorTo(targetLink);
    }

    const fadeIn = fadeToWhite();
    await Promise.all([indicatorMove, fadeIn]);

    setNavTransitionLock(true);
    // Stop before swap so WebGL contexts (work gradients) can dispose while
    // their DOM nodes still exist — otherwise project gradients fail to mount.
    window.sitePages?.[fromPage]?.stop?.();
    await swapPageContent(page, targetUrl);
    history.pushState({ page, url: targetUrl }, '', targetUrl);
    // Keep boot light here — heavy WebGL on work is deferred inside bootWorkPage
    // so the nav pill can finish morphing during fadeFromWhite.
    window.sitePages?.[page]?.boot?.();

    await fadeFromWhite();
    window.__navRemeasure?.({ preserveVisualState: true });
    window.__navSyncScroll?.();
  } catch {
    window.location.href = targetUrl;
  } finally {
    isPageTransitioning = false;
    setNavTransitionLock(false);
    schedulePositionNavIndicator();
  }
}

function initPageTransitions() {
  document.querySelectorAll('[data-nav][href]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const page = link.dataset.nav;
      if (!page) {
        return;
      }

      event.preventDefault();
      if (page === getCurrentPage()) {
        if (window.__lenis) {
          window.__lenis.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      navigateToPage(page, link);
    });
  });

  const logo = document.querySelector('.site-mark');
  const workLink = document.querySelector('[data-nav="work"]');
  if (logo && workLink) {
    logo.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      if (getCurrentPage() === 'work') {
        if (window.__lenis) {
          window.__lenis.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      navigateToPage('work', workLink);
    });
  }

  // Project cards and in-page nav links are part of swapped content — use delegation.
  document.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const aboutTeaser = event.target.closest('.work-about__panel[data-nav][href]');
    if (aboutTeaser) {
      const page = aboutTeaser.dataset.nav;
      if (!page) return;
      event.preventDefault();
      if (page === getCurrentPage()) {
        if (window.__lenis) {
          window.__lenis.scrollTo(0);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      const navLink = document.querySelector(`[data-nav="${page}"].site-nav-item`) || aboutTeaser;
      navigateToPage(page, navLink);
      return;
    }

    const link = event.target.closest('.project-link[href]');
    if (!link || link.target === '_blank') {
      return;
    }

    const targetUrl = link.getAttribute('href');
    if (!targetUrl) {
      return;
    }

    event.preventDefault();
    navigateToPage('project', workLink, targetUrl);
  });

  window.addEventListener('popstate', async (event) => {
    const page = event.state?.page ?? getPageFromUrl(window.location.href);
    const targetUrl = event.state?.url
      ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const resolvedTarget = new URL(targetUrl, window.location.href);
    const nextContentUrl = `${resolvedTarget.pathname}${resolvedTarget.search}`;

    if (nextContentUrl === lastContentUrl) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.location.reload();
      return;
    }

    isPageTransitioning = true;
    setNavTransitionLock(true);
    const fromPage = getCurrentPage();
    window.__navPreparePageSwap?.();

    try {
      const indicatorMove = page === 'project' && fromPage !== 'project'
        ? hideNavIndicatorSmooth()
        : page !== 'project' && fromPage === 'project'
          ? showNavIndicatorSmooth(document.querySelector(`[data-nav="${page}"]`))
          : Promise.resolve();

      await Promise.all([fadeToWhite(), indicatorMove]);
      window.sitePages?.[fromPage]?.stop?.();
      await swapPageContent(page, targetUrl);
      window.sitePages?.[page]?.boot?.();
      await fadeFromWhite();
      window.__navRemeasure?.({ preserveVisualState: true });
      window.__navSyncScroll?.();
      schedulePositionNavIndicator();
    } catch {
      window.location.reload();
    } finally {
      isPageTransitioning = false;
      setNavTransitionLock(false);
      schedulePositionNavIndicator();
    }
  });
}

let navPillJiggleTimer = 0;

function markNavHeaderReady() {
  document.querySelector('.site-header')?.classList.add('site-header--ready');
}

function stopNavPillJiggle() {
  window.clearTimeout(navPillJiggleTimer);
  navPillJiggleTimer = 0;

  const header = document.querySelector('.site-header');
  if (!header) return;

  header.classList.remove('site-header--jiggle', 'site-header--pressed');
}

function playNavPillJiggle() {
  const header = document.querySelector('.site-header');
  if (!header || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Lock out headerReveal first, then play the original CSS jiggle.
  markNavHeaderReady();
  window.clearTimeout(navPillJiggleTimer);
  header.classList.remove('site-header--pressed', 'site-header--jiggle');
  void header.offsetWidth;
  header.classList.add('site-header--jiggle');
  navPillJiggleTimer = window.setTimeout(() => {
    header.classList.remove('site-header--jiggle');
  }, 500);
}

function initNavPillPress() {
  const pill = document.querySelector('.nav-pill');
  const header = document.querySelector('.site-header');
  if (!pill || !header || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const interactiveSelector = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'label',
    'summary',
    '[role="button"]',
    '.nav-pill__project-context',
  ].join(', ');
  let pressed = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;

  const release = ({ jiggle = true } = {}) => {
    if (!pressed) return;
    pressed = false;
    pointerId = null;
    header.classList.remove('site-header--pressed');

    if (!jiggle) {
      stopNavPillJiggle();
      return;
    }

    playNavPillJiggle();
  };

  // Lock out headerReveal so later jiggles can't restart it.
  if (header.classList.contains('site-header--instant')
    || header.classList.contains('site-header--bootstrapping')) {
    markNavHeaderReady();
  } else {
    const onRevealEnd = (event) => {
      if (event.animationName !== 'headerReveal') return;
      markNavHeaderReady();
      header.removeEventListener('animationend', onRevealEnd);
    };
    header.addEventListener('animationend', onRevealEnd);
    window.setTimeout(markNavHeaderReady, 1000);
  }

  pill.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (!header.classList.contains('site-header--compact')) return;
    if (event.target.closest(interactiveSelector)) return;

    pressed = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    stopNavPillJiggle();
    markNavHeaderReady();
    header.classList.add('site-header--pressed');

    try {
      pill.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on unsupported targets.
    }
  });

  pill.addEventListener('pointermove', (event) => {
    if (!pressed || event.pointerId !== pointerId) return;
    const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
    if (moved > 10) {
      release({ jiggle: false });
    }
  });

  pill.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId && pointerId !== null) return;
    release({ jiggle: true });
  });

  pill.addEventListener('pointercancel', () => {
    release({ jiggle: false });
  });

  pill.addEventListener('lostpointercapture', () => {
    if (pressed) release({ jiggle: true });
  });
}

function initSiteNav() {
  initNavMorph();
  initPageTransitions();
  initNavPillPress();
  setNavActive(getCurrentPage());
  history.replaceState({
    page: getCurrentPage(),
    url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }, '', window.location.href);

  const finishBootstrap = () => {
    window.__navRemeasure?.();
    requestAnimationFrame(() => {
      window.__navFinishBootstrap?.();
    });
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(finishBootstrap);
  } else {
    finishBootstrap();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSiteNav);
} else {
  initSiteNav();
}
