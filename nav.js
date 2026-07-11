const NAV_STATE_KEY = 'site-nav-state';
const PAGE_ROUTES = {
  work: { url: './index.html', styles: 'styles.css' },
  about: { url: './about.html', styles: 'about.css' },
};

let isPageTransitioning = false;
let isIndicatorPageAnimating = false;
let isNavBootstrapping = true;
let navScrollHandler = null;
let indicatorRaf = 0;
let indicatorTrackRaf = 0;

function markIndicatorReady() {
  document.querySelector('.site-nav-indicator')?.classList.add('site-nav-indicator--ready');
}

function positionNavIndicator() {
  const nav = document.querySelector('.site-nav');
  const indicator = nav?.querySelector('.site-nav-indicator');
  const active = nav?.querySelector('.site-nav-item--active');
  if (!nav || !indicator || !active) {
    return;
  }

  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.height = `${active.offsetHeight}px`;
  indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
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
  return document.body.dataset.page === 'about' ? 'about' : 'work';
}

function getPageFromUrl(url) {
  const path = new URL(url, window.location.href).pathname;
  if (path.endsWith('about.html') || path.endsWith('/about')) {
    return 'about';
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
  indicator.classList.remove('site-nav-indicator--tracking');
  isIndicatorPageAnimating = true;

  indicator.classList.add('site-nav-indicator--animating');
  void indicator.offsetWidth;

  requestAnimationFrame(() => {
    indicator.style.width = `${element.offsetWidth}px`;
    indicator.style.height = `${element.offsetHeight}px`;
    indicator.style.transform = `translate(${element.offsetLeft}px, ${element.offsetTop}px)`;
  });

  return wait(460).then(() => {
    indicator.classList.remove('site-nav-indicator--animating');
    isIndicatorPageAnimating = false;
  });
}

function setNavActive(page) {
  document.querySelectorAll('[data-nav]').forEach((item) => {
    const isActive = item.dataset.nav === page;
    item.classList.toggle('site-nav-item--active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

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

  function measureCompactWidth() {
    const wasCompact = header.classList.contains('site-header--compact');
    const navLinks = [...document.querySelectorAll('[data-nav]')];
    const activeLink = document.querySelector('[data-nav].site-nav-item--active');

    header.classList.add('site-header--nav-lock', 'site-header--compact');
    header.style.width = 'max-content';

    let maxWidth = 0;
    navLinks.forEach((link) => {
      navLinks.forEach((item) => item.classList.remove('site-nav-item--active'));
      link.classList.add('site-nav-item--active');
      void header.offsetWidth;
      maxWidth = Math.max(maxWidth, header.getBoundingClientRect().width);
    });

    navLinks.forEach((item) => item.classList.remove('site-nav-item--active'));
    activeLink?.classList.add('site-nav-item--active');

    compactWidth = maxWidth;
    header.style.width = '';

    if (!wasCompact) {
      header.classList.remove('site-header--compact');
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
    header.style.setProperty('--nav-compact-width', `${compactWidth}px`);
    header.style.setProperty('--nav-expanded-width', `${compactWidth * EXPANDED_RATIO}px`);
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

    let shouldCompact = scrollY >= SCROLL_THRESHOLD;
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

async function swapPageContent(page) {
  const route = PAGE_ROUTES[page];
  const response = await fetch(route.url);
  if (!response.ok) {
    throw new Error(`Failed to load ${route.url}`);
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

  currentMain.innerHTML = nextMain.innerHTML;
  if (nextFooter && currentFooter) {
    currentFooter.replaceWith(nextFooter);
  }

  await loadPageStylesheet(route.styles);

  document.title = doc.title;
  document.body.dataset.page = page;
  setNavActive(page);

  window.__navMarkScrollReset?.();

  window.scrollTo(0, 0);
  if (window.__lenis) {
    window.__lenis.scrollTo(0, { immediate: true });
  }

  window.__asciiRemeasure?.();
  window.__navRemeasure?.({ preserveVisualState: true });
  window.__navSyncScroll?.();
}

async function navigateToPage(page, targetLink) {
  if (isPageTransitioning || page === getCurrentPage()) {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.href = PAGE_ROUTES[page].url;
    return;
  }

  isPageTransitioning = true;
  const fromPage = getCurrentPage();
  window.__navPreparePageSwap?.();

  try {
    const indicatorMove = positionNavIndicatorTo(targetLink);
    const fadeIn = fadeToWhite();
    await Promise.all([indicatorMove, fadeIn]);

    setNavActive(page);
    setNavTransitionLock(true);
    await swapPageContent(page);

    window.sitePages?.[fromPage]?.stop?.();
    window.sitePages?.[page]?.boot?.();

    history.pushState({ page }, '', PAGE_ROUTES[page].url);
    await fadeFromWhite();
    window.__navRemeasure?.({ preserveVisualState: true });
    window.__navSyncScroll?.();
  } catch {
    window.location.href = PAGE_ROUTES[page].url;
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
      if (!page || page === getCurrentPage()) {
        return;
      }

      event.preventDefault();
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
      navigateToPage('work', workLink);
    });
  }

  window.addEventListener('popstate', async (event) => {
    const page = event.state?.page ?? getPageFromUrl(window.location.href);
    if (page === getCurrentPage()) {
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
      await fadeToWhite();
      await swapPageContent(page);
      window.sitePages?.[fromPage]?.stop?.();
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

function initSiteNav() {
  initNavMorph();
  initPageTransitions();
  setNavActive(getCurrentPage());
  history.replaceState({ page: getCurrentPage() }, '', window.location.href);

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
