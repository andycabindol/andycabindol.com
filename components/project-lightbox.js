(function () {
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function motionNum(name, fallback) {
    const value = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(name),
    );
    return Number.isFinite(value) ? value : fallback;
  }

  function motionBezierCss(prefix) {
    const x1 = motionNum(`${prefix}-x1`, 0.65);
    const y1 = motionNum(`${prefix}-y1`, 0);
    const x2 = motionNum(`${prefix}-x2`, 0.35);
    const y2 = motionNum(`${prefix}-y2`, 1);
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  }

  function motionBezierFn(prefix) {
    const x1 = motionNum(`${prefix}-x1`, 0.65);
    const y1 = motionNum(`${prefix}-y1`, 0);
    const x2 = motionNum(`${prefix}-x2`, 0.35);
    const y2 = motionNum(`${prefix}-y2`, 1);
    const ax = 1 - 3 * x2 + 3 * x1;
    const bx = 3 * x2 - 6 * x1;
    const cx = 3 * x1;
    const ay = 1 - 3 * y2 + 3 * y1;
    const by = 3 * y2 - 6 * y1;
    const cy = 3 * y1;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const slopeX = (t) => 3 * ax * t * t + 2 * bx * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i += 1) {
        const slope = slopeX(t);
        if (Math.abs(slope) < 1e-6) break;
        t -= (sampleX(t) - x) / slope;
        t = Math.min(1, Math.max(0, t));
      }
      return sampleY(t);
    };
  }

  let shell = null;
  let flyer = null;
  let gradientObserver = null;
  let openSlug = null;
  let opening = false;
  let closing = false;
  let motionToken = 0;
  let lastCard = null;
  let bound = false;
  let contentWidthObserver = null;
  let hintUsed = false;
  let hintTimer = 0;
  let lightboxLenis = null;
  let lightboxRaf = 0;

  function projectParam() {
    return new URLSearchParams(window.location.search).get('project');
  }

  function workUrl(slug) {
    return slug
      ? `/index.html?project=${encodeURIComponent(slug)}`
      : '/index.html';
  }

  function setHistory(slug, { replace = false } = {}) {
    const url = workUrl(slug);
    const state = { page: 'work', lightbox: slug || null, url };
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function waitAnimation(animation, ms = 1100) {
    if (!animation) return Promise.resolve();
    return Promise.race([
      animation.finished.catch(() => {}),
      wait(ms),
    ]);
  }

  function cardForSlug(slug) {
    return document.querySelector(`.project-item[data-project-slug="${slug}"]`);
  }

  function templateForSlug(slug) {
    return document.querySelector(`template[data-project-template="${slug}"]`);
  }

  function copyCanvasPixels(source) {
    const dest = document.createElement('canvas');
    dest.width = source.width || source.clientWidth || 1;
    dest.height = source.height || source.clientHeight || 1;
    dest.className = source.className;
    dest.style.cssText = source.style.cssText;
    dest.style.width = '100%';
    dest.style.height = '100%';
    dest.style.display = 'block';
    dest.style.objectFit = 'cover';
    try {
      dest.getContext('2d').drawImage(source, 0, 0, dest.width, dest.height);
    } catch {
      return source.cloneNode(true);
    }
    return dest;
  }

  function snapshotMedia(media) {
    const clone = media.cloneNode(true);
    clone.style.visibility = 'visible';
    const sourceCanvases = media.querySelectorAll('canvas');
    if (sourceCanvases.length) {
      clone.querySelectorAll('canvas').forEach((canvas, index) => {
        const source = sourceCanvases[index];
        if (source) canvas.replaceWith(copyCanvasPixels(source));
      });
    }
    clone.querySelectorAll('[data-work-gradient]').forEach((el) => {
      el.dataset.workGradientInit = 'true';
    });
    const sourceVideos = media.querySelectorAll('video');
    if (sourceVideos.length) {
      clone.querySelectorAll('video').forEach((video, index) => {
        const source = sourceVideos[index];
        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.loop = true;
        video.removeAttribute('controls');
        if (source) {
          try {
            video.currentTime = source.currentTime || 0;
          } catch {
            // ignore
          }
        } else {
          try {
            video.load?.();
          } catch {
            // ignore
          }
        }
        video.play?.().catch(() => {});
      });
    }
    return clone;
  }

  function resetGradientHosts(root) {
    root.querySelectorAll('[data-work-gradient]').forEach((el) => {
      delete el.dataset.workGradientInit;
      el.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    });
  }

  function reviveScripts(root) {
    root.querySelectorAll('script').forEach((old) => {
      const next = document.createElement('script');
      [...old.attributes].forEach((attr) => next.setAttribute(attr.name, attr.value));
      next.textContent = old.textContent;
      old.replaceWith(next);
    });
  }

  function ensureShell() {
    if (shell) return shell;

    shell = document.createElement('div');
    shell.className = 'lightbox';
    shell.id = 'project-lightbox';
    shell.dataset.style = 'morph';
    shell.setAttribute('hidden', '');
    shell.innerHTML = `
      <div class="lightbox__wash" aria-hidden="true"></div>
      <div class="lightbox__backdrop"></div>
      <div class="lightbox__letterbox lightbox__letterbox--top" aria-hidden="true"></div>
      <div class="lightbox__letterbox lightbox__letterbox--bottom" aria-hidden="true"></div>
      <div class="lightbox__hud">
        <div class="lightbox__rail lightbox__rail--left">
          <h1 class="lightbox__title"></h1>
          <p class="lightbox__summary"></p>
        </div>
        <div class="lightbox__hud-gap" aria-hidden="true"></div>
        <div class="lightbox__rail lightbox__rail--right">
          <dl class="lightbox__facts"></dl>
        </div>
      </div>
      <div class="lightbox__scroll" data-lenis-prevent data-lenis-prevent-touch>
        <div class="lightbox__scroll-inner">
          <div class="lightbox__cover">
            <div class="lightbox__figure">
              <div class="lightbox__media"></div>
            </div>
          </div>
          <div class="lightbox__case"></div>
        </div>
      </div>
      <div class="lightbox__hint" hidden>
        <button class="lightbox__hint-btn" type="button" aria-label="Scroll down">
          <span class="lightbox__hint-mark" aria-hidden="true"></span>
          <span class="lightbox__hint-copy">Scroll</span>
        </button>
      </div>
      <button class="lightbox__close" type="button" data-lightbox-close aria-label="Close project">
        <svg class="lightbox__close-icon" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M2.2 2.2l11.6 11.6M13.8 2.2L2.2 13.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    document.body.appendChild(shell);

    const scroll = shell.querySelector('.lightbox__scroll');
    scroll.addEventListener('touchmove', (event) => {
      event.stopImmediatePropagation();
    }, { capture: true, passive: true });
    scroll.addEventListener('scroll', onLightboxScroll, { passive: true });
    shell.querySelector('.lightbox__hint-btn')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const cover = shell.querySelector('.lightbox__cover');
      const full = cover?.offsetHeight || window.innerHeight;
      scrollLightboxTo(full * 0.75);
    });

    shell.addEventListener('click', (event) => {
      if (event.target.closest('[data-lightbox-close]')) {
        event.preventDefault();
        event.stopPropagation();
        closeLightbox();
        return;
      }
      const keep = event.target.closest(
        '.lightbox__figure, .lightbox__rail, .lightbox__case, .lightbox__hint, a, button, input, textarea, video, .project-section, .project-figure, .project-grid',
      );
      if (!keep) {
        closeLightbox();
      }
    });

    return shell;
  }

  function getLightboxScrollTop() {
    if (lightboxLenis) return lightboxLenis.scroll;
    return shell?.querySelector('.lightbox__scroll')?.scrollTop || 0;
  }

  function scrollLightboxTo(top, { immediate = false } = {}) {
    if (lightboxLenis) {
      lightboxLenis.scrollTo(top, {
        immediate: immediate || reduceMotion(),
        force: true,
      });
      return;
    }
    const scroll = shell?.querySelector('.lightbox__scroll');
    if (!scroll) return;
    if (immediate || reduceMotion()) scroll.scrollTop = top;
    else scroll.scrollTo({ top, behavior: 'smooth' });
  }

  function onLightboxScroll() {
    if (getLightboxScrollTop() > 28) hintUsed = true;
    syncScrollHint();
  }

  function stopLightboxLenis() {
    if (lightboxRaf) {
      cancelAnimationFrame(lightboxRaf);
      lightboxRaf = 0;
    }
    if (lightboxLenis) {
      lightboxLenis.off?.('scroll', onLightboxScroll);
      lightboxLenis.destroy?.();
      lightboxLenis = null;
    }
  }

  function startLightboxLenis() {
    stopLightboxLenis();
    const wrapper = shell?.querySelector('.lightbox__scroll');
    const content = shell?.querySelector('.lightbox__scroll-inner');
    if (!wrapper || !content) return;
    if (reduceMotion() || typeof window.Lenis !== 'function') return;

    lightboxLenis = new window.Lenis({
      wrapper,
      content,
      eventsTarget: shell,
      lerp: 0.08,
      smoothWheel: true,
    });
    lightboxLenis.on('scroll', onLightboxScroll);

    const tick = (time) => {
      lightboxLenis?.raf(time);
      lightboxRaf = requestAnimationFrame(tick);
    };
    lightboxRaf = requestAnimationFrame(tick);
  }

  function hideScrollHint(immediate = false) {
    window.clearTimeout(hintTimer);
    const hint = shell?.querySelector('.lightbox__hint');
    if (!hint) return;
    hint.classList.remove('is-visible');
    hint.setAttribute('aria-hidden', 'true');
    if (immediate) {
      hint.hidden = true;
      return;
    }
    window.setTimeout(() => {
      if (!hint.classList.contains('is-visible')) hint.hidden = true;
    }, 420);
  }

  function canShowScrollHint() {
    const scroll = shell?.querySelector('.lightbox__scroll');
    const caseEl = shell?.querySelector('.lightbox__case');
    if (!scroll || !shell?.classList.contains('is-settled')) return false;
    if (closing || opening || hintUsed) return false;
    const hasCase = (caseEl?.childElementCount || 0) > 0;
    const canScroll = scroll.scrollHeight > scroll.clientHeight + 48;
    return hasCase && canScroll && getLightboxScrollTop() < 28;
  }

  function syncScrollHint() {
    const hint = shell?.querySelector('.lightbox__hint');
    if (!hint) return;
    if (!canShowScrollHint()) {
      hideScrollHint();
      return;
    }
    if (!hint.hidden && hint.classList.contains('is-visible')) return;
    hint.hidden = false;
    hint.setAttribute('aria-hidden', 'false');
    void hint.offsetWidth;
    hint.classList.add('is-visible');
  }

  function scheduleScrollHint() {
    window.clearTimeout(hintTimer);
    hintUsed = false;
    hideScrollHint(true);
    hintTimer = window.setTimeout(() => {
      if (!canShowScrollHint()) return;
      syncScrollHint();
    }, reduceMotion() ? 80 : 920);
  }

  function fillChrome(slug) {
    const template = templateForSlug(slug);
    const seed = template?.content?.querySelector('.lightbox-seed');
    const title = shell.querySelector('.lightbox__title');
    const summary = shell.querySelector('.lightbox__summary');
    const facts = shell.querySelector('.lightbox__facts');

    title.textContent = seed?.querySelector('[data-seed-title]')?.textContent?.trim() || '';
    setProjectMode(true, title.textContent);
    if (summary) {
      summary.textContent = '';
      summary.hidden = true;
    }

    facts.replaceChildren();
    const seedFacts = seed?.querySelector('[data-seed-facts]');
    const factNodes = seedFacts
      ? [...seedFacts.children]
          .filter((node) => {
            const label = node.querySelector('dt')?.textContent?.trim();
            return label === 'Year' || node.dataset.fact === 'year';
          })
          .map((node) => {
            const clone = node.cloneNode(true);
            clone.querySelector('dt')?.remove();
            return clone;
          })
      : [];
    if (factNodes.length) {
      facts.append(...factNodes);
      facts.hidden = false;
    } else {
      facts.hidden = true;
    }

    shell.querySelector('.lightbox__case')?.replaceChildren();
    shell.querySelector('.lightbox__media')?.replaceChildren();
  }

  function fillCase(slug) {
    const template = templateForSlug(slug);
    const seed = template?.content?.querySelector('.lightbox-seed');
    const body = shell.querySelector('.lightbox__case');
    if (!body) return;
    body.replaceChildren();
    const seedBody = seed?.querySelector('[data-seed-body]');
    if (seedBody) {
      body.append(...[...seedBody.childNodes].map((node) => node.cloneNode(true)));
    }
    resetGradientHosts(body);
    reviveScripts(body);
    window.MediaSkeleton?.initAll?.(body);
    window.bootProjectEmbeds?.();
  }

  function cleanupFlyers() {
    flyer?.getAnimations?.().forEach((animation) => animation.cancel());
    flyer?.remove();
    flyer = null;
    document.querySelectorAll('.lightbox-flyer').forEach((el) => el.remove());
  }

  function settleFlyerIntoFigure() {
    const mediaHost = shell?.querySelector('.lightbox__media');
    if (!mediaHost) return;
    const media = flyer?.querySelector('.project-media') || flyer?.firstElementChild;
    if (media) {
      flyer?.getAnimations?.().forEach((animation) => animation.finish());
      media.style.width = '100%';
      media.style.height = '100%';
      media.style.aspectRatio = 'auto';
      media.style.visibility = 'visible';
      mediaHost.replaceChildren(media);
      mediaHost.querySelectorAll('video').forEach((video) => {
        window.__forceMutedAutoplay?.(video);
      });
    }
    cleanupFlyers();
  }

  function ensureCoverFromCard(card) {
    const mediaHost = shell?.querySelector('.lightbox__media');
    if (!mediaHost || mediaHost.querySelector('.project-media, video, img, canvas')) return;
    const media = card?.querySelector('.project-media');
    if (!media) return;

    const rect = media.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      mediaHost.style.aspectRatio = `${rect.width} / ${rect.height}`;
      shell.style.setProperty('--lightbox-cover-ratio', String(rect.width / rect.height));
    }

    const clone = snapshotMedia(media);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.aspectRatio = 'auto';
    clone.style.visibility = 'visible';
    mediaHost.replaceChildren(clone);
    mediaHost.querySelectorAll('video').forEach((video) => {
      try {
        video.load?.();
      } catch {
        // ignore
      }
      window.__forceMutedAutoplay?.(video);
    });
    syncContentWidth();
  }

  function observeBodyGradients(body) {
    gradientObserver?.disconnect();
    const nodes = [...body.querySelectorAll('[data-work-gradient]')];
    if (!nodes.length) return;
    gradientObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        window.WorkGradients?.init?.(entry.target);
        gradientObserver.unobserve(entry.target);
      });
    }, {
      root: shell.querySelector('.lightbox__scroll'),
      rootMargin: '240px 0px',
    });
    nodes.forEach((node) => gradientObserver.observe(node));
  }

  function disposePortfolioGradients() {
    document.querySelectorAll('.portfolio [data-work-gradient]').forEach((el) => {
      window.WorkGradients?.dispose?.(el);
    });
  }

  function restorePortfolioGradients() {
    window.WorkGradients?.initAll?.();
  }

  function disposeLightboxGradients() {
    if (!shell) return;
    window.WorkGradients?.disposeIn?.(shell);
    gradientObserver?.disconnect();
    gradientObserver = null;
  }

  let marqueeTimer = 0;

  function setProjectPill(title) {
    const text = document.querySelector('[data-project-section-current]');
    const action = document.querySelector('.project-nav-action');
    if (text) text.textContent = title || '';
    action?.setAttribute('aria-label', title ? 'Close project' : 'Open all projects');
    window.clearTimeout(marqueeTimer);
    const syncMarquee = () => window.__updateProjectSectionMarquee?.();
    requestAnimationFrame(() => requestAnimationFrame(syncMarquee));
    if (title) {
      marqueeTimer = window.setTimeout(syncMarquee, 580);
    }
  }

  function setStageOrigin() {
    const stage = document.querySelector('.site-stage');
    if (!stage) return;
    const scrollY = window.__lenis?.scroll ?? window.scrollY ?? 0;
    stage.style.setProperty('--lightbox-stage-origin', `${scrollY + window.innerHeight / 2}px`);
  }

  function setProjectMode(on, title = '') {
    if (on) setStageOrigin();
    document.body.classList.toggle('lightbox-open', on);
    if (!on) document.body.classList.remove('lightbox-closing');
    setProjectPill(on ? title : '');
    window.__navApplyState?.();
  }

  function lockPage(lock) {
    const root = document.documentElement;
    if (lock) {
      const gap = Math.max(0, window.innerWidth - root.clientWidth);
      root.style.setProperty('--lightbox-scrollbar-gap', `${gap}px`);
      document.body.classList.add('lightbox-locked');
      window.__lenis?.stop?.();
      return;
    }
    window.__lenis?.start?.();
    document.body.classList.remove('lightbox-locked');
    root.style.removeProperty('--lightbox-scrollbar-gap');
  }

  function syncContentWidth() {
    if (!shell) return;
    const mediaHost = shell.querySelector('.lightbox__media');
    const figure = shell.querySelector('.lightbox__figure');
    const width = Math.round(
      mediaHost?.getBoundingClientRect().width
      || figure?.getBoundingClientRect().width
      || 0,
    );
    if (width > 0) {
      shell.style.setProperty('--lightbox-content-width', `${width}px`);
      return;
    }
    shell.style.removeProperty('--lightbox-content-width');
  }

  function observeContentWidth() {
    const figure = shell?.querySelector('.lightbox__figure');
    contentWidthObserver?.disconnect();
    if (!figure || typeof ResizeObserver !== 'function') {
      syncContentWidth();
      return;
    }
    contentWidthObserver = new ResizeObserver(() => syncContentWidth());
    contentWidthObserver.observe(figure);
    syncContentWidth();
  }

  function stopObservingContentWidth() {
    contentWidthObserver?.disconnect();
    contentWidthObserver = null;
    shell?.style.removeProperty('--lightbox-content-width');
  }

  function measureFigure(card) {
    const mediaHost = shell.querySelector('.lightbox__media');
    const media = card?.querySelector('.project-media');
    if (mediaHost && media) {
      const rect = media.getBoundingClientRect();
      if (rect.height > 0) {
        const ratio = rect.width / rect.height;
        mediaHost.style.aspectRatio = `${rect.width} / ${rect.height}`;
        shell.style.setProperty('--lightbox-cover-ratio', String(ratio));
      }
    }
    const dest = (mediaHost || shell.querySelector('.lightbox__figure')).getBoundingClientRect();
    if (dest.width > 0) {
      shell.style.setProperty('--lightbox-content-width', `${Math.round(dest.width)}px`);
    }
    return dest;
  }

  function flipTransform(from, to) {
    const sx = to.width ? from.width / to.width : 1;
    const sy = to.height ? from.height / to.height : 1;
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
  }

  function placeFlyer(el, rect) {
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.transformOrigin = 'top left';
  }

  function makeFlyer(media, destRect) {
    flyer?.remove();
    flyer = document.createElement('div');
    flyer.className = 'lightbox-flyer';
    placeFlyer(flyer, destRect);
    const clone = snapshotMedia(media);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.aspectRatio = 'auto';
    flyer.appendChild(clone);
    (shell || document.body).appendChild(flyer);
    return flyer;
  }

  async function playFlip(el, from, to, token) {
    if (!el || !from?.width || !to?.width) return;
    if (reduceMotion()) {
      el.style.transform = 'none';
      return;
    }
    const start = flipTransform(from, to);
    el.style.transform = start;
    el.style.willChange = 'transform';
    void el.offsetWidth;
    const duration = motionNum('--motion-enter-thumb-ms', 870);
    const animation = el.animate(
      [
        { transform: start },
        { transform: 'translate(0px, 0px) scale(1, 1)' },
      ],
      { duration, easing: motionBezierCss('--motion-enter-thumb'), fill: 'forwards' },
    );
    await waitAnimation(animation, duration + 80);
    if (token !== motionToken) return;
    el.style.transform = 'none';
    el.style.willChange = '';
  }

  async function playFlipClose(el, from, targetEl, token) {
    if (!el || !from?.width || !targetEl) return;
    const to0 = targetEl.getBoundingClientRect();
    if (reduceMotion()) {
      placeFlyer(el, {
        left: to0.left,
        top: to0.top,
        width: to0.width,
        height: to0.height,
      });
      el.style.transform = 'none';
      return;
    }
    const duration = motionNum('--motion-exit-thumb-ms', 600);
    const ease = motionBezierFn('--motion-exit-thumb');
    placeFlyer(el, from);
    el.style.transform = 'none';
    el.style.willChange = 'transform';
    const started = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        if (token !== motionToken) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - started) / duration);
        const eased = ease(t);
        const to = targetEl.getBoundingClientRect();
        const sx = 1 + ((to.width / from.width) - 1) * eased;
        const sy = 1 + ((to.height / from.height) - 1) * eased;
        const tx = (to.left - from.left) * eased;
        const ty = (to.top - from.top) * eased;
        el.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    el.style.willChange = '';
  }

  function setOriginFromRect(rect) {
    if (!shell || !rect) return;
    shell.style.setProperty('--lightbox-origin-x', `${rect.left + rect.width / 2}px`);
    shell.style.setProperty('--lightbox-origin-y', `${rect.top + rect.height / 2}px`);
  }

  function exitMs() {
    return motionNum('--motion-exit-thumb-ms', 600);
  }

  function resetShellMotion() {
    if (!shell) return;
    shell.style.transition = '';
    shell.style.transform = '';
    shell.style.opacity = '';
    shell.style.clipPath = '';
    shell.style.transformOrigin = '';
  }

  function coverIsInView(rect) {
    if (!rect?.width || !rect?.height) return false;
    const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    return visible > 48;
  }

  function coverCenterRect(mediaHost) {
    const size = mediaHost?.getBoundingClientRect();
    const width = size?.width || mediaHost?.offsetWidth || 480;
    const height = size?.height || mediaHost?.offsetHeight || 320;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  }

  function interruptFlyer(el) {
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const rect = {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    };
    el.getAnimations?.().forEach((animation) => animation.cancel());
    placeFlyer(el, rect);
    el.style.transform = 'none';
    el.style.willChange = '';
    return rect.width && rect.height ? rect : null;
  }

  async function fadeInFlyer(el, ms) {
    el.style.opacity = '0';
    el.style.transition = `opacity ${ms}ms ${motionBezierCss('--motion-exit-thumb')}`;
    void el.offsetWidth;
    el.style.opacity = '1';
    await wait(ms);
    el.style.transition = '';
  }

  async function playClose({ media, mediaHost, token }) {
    const live = mediaHost?.querySelector('.project-media');
    const inFlight = flyer && document.contains(flyer) && !live;

    if (inFlight && media) {
      const fromRect = interruptFlyer(flyer);
      shell.classList.add('is-closing');
      shell.classList.remove('is-settled', 'is-pre');
      document.body.classList.add('lightbox-closing');
      if (!fromRect || token !== motionToken) return;
      await playFlipClose(flyer, fromRect, media, token);
      return;
    }

    if (!live || !media) {
      shell.classList.add('is-closing');
      shell.classList.remove('is-settled');
      document.body.classList.add('lightbox-closing');
      await wait(exitMs());
      return;
    }

    const currentRect = mediaHost.getBoundingClientRect();
    const inView = coverIsInView(currentRect);
    const fromRect = inView
      ? {
          left: currentRect.left,
          top: currentRect.top,
          width: currentRect.width,
          height: currentRect.height,
        }
      : coverCenterRect(mediaHost);

    makeFlyer(live, fromRect);
    mediaHost.replaceChildren();
    shell.classList.add('is-closing');
    shell.classList.remove('is-settled');
    document.body.classList.add('lightbox-closing');

    if (!inView) {
      await fadeInFlyer(flyer, Math.min(280, Math.round(exitMs() * 0.45)));
      if (token !== motionToken) return;
    }
    if (token !== motionToken) return;
    await playFlipClose(flyer, fromRect, media, token);
  }

  async function openLightbox(slug, { card = null, skipHistory = false, replaceHistory = false } = {}) {
    if (!slug) return;
    if (closing) {
      await closeLightbox({ immediate: true, skipHistory: true });
    }
    const template = templateForSlug(slug);
    if (!template) return;

    ensureShell();
    shell.dataset.style = 'morph';

    if (openSlug === slug && shell.classList.contains('is-open') && !opening) {
      return;
    }

    if (openSlug && openSlug !== slug) {
      await closeLightbox({ immediate: true, skipHistory: true });
    }

    const token = ++motionToken;
    opening = true;
    closing = false;
    const sourceCard = card || cardForSlug(slug);
    lastCard = sourceCard;
    const media = sourceCard?.querySelector('.project-media');
    const fromRect = media?.getBoundingClientRect() || null;

    try {
      hintUsed = false;
      hideScrollHint(true);
      fillChrome(slug);
      shell.removeAttribute('hidden');
      shell.classList.add('is-open', 'is-pre');
      shell.dataset.style = 'morph';
      lockPage(true);
      startLightboxLenis();
      scrollLightboxTo(0, { immediate: true });

      const toRect = measureFigure(sourceCard);
      observeContentWidth();
      setOriginFromRect(fromRect);

      if (media && fromRect?.width && toRect?.width) {
        makeFlyer(media, toRect);
        flyer.style.transform = flipTransform(fromRect, toRect);
        sourceCard.classList.add('is-lightbox-source');
        media.style.visibility = 'hidden';
      } else {
        ensureCoverFromCard(sourceCard);
        syncContentWidth();
      }

      shell.classList.remove('is-pre');
      if (flyer && fromRect && toRect) {
        await playFlip(flyer, fromRect, toRect, token);
      } else {
        await wait(reduceMotion() ? 0 : 160);
      }
      if (token !== motionToken) return;

      settleFlyerIntoFigure();
      ensureCoverFromCard(sourceCard);
      syncContentWidth();
      shell.classList.add('is-settled');
      openSlug = slug;
      opening = false;
      fillCase(slug);
      lightboxLenis?.resize?.();
      scheduleScrollHint();

      if (!skipHistory && projectParam() !== slug) {
        setHistory(slug, { replace: replaceHistory });
      }
    } catch (error) {
      opening = false;
      closing = false;
      cleanupFlyers();
      stopLightboxLenis();
      stopObservingContentWidth();
      if (media) media.style.visibility = '';
      sourceCard?.classList.remove('is-lightbox-source');
      if (shell) {
        shell.classList.remove('is-open', 'is-pre', 'is-settled', 'is-closing');
        shell.setAttribute('hidden', '');
        shell.style.visibility = '';
        shell.style.pointerEvents = '';
      }
      lockPage(false);
      setProjectMode(false);
      throw error;
    }
  }

  async function closeLightbox({ immediate = false, skipHistory = false, teardown = false } = {}) {
    if (!shell || (!openSlug && !shell.classList.contains('is-open'))) {
      opening = false;
      closing = false;
      cleanupFlyers();
      stopLightboxLenis();
      lockPage(false);
      setProjectMode(false);
      return;
    }

    motionToken += 1;
    const token = motionToken;
    closing = true;
    opening = false;
    const slug = openSlug;
    const sourceCard = lastCard || cardForSlug(slug);
    const media = sourceCard?.querySelector('.project-media');
    const mediaHost = shell.querySelector('.lightbox__media');

    shell.style.pointerEvents = 'none';
    hideScrollHint(true);

    try {
      if (!immediate && !reduceMotion()) {
        await playClose({ media, mediaHost, token });
      } else {
        shell.classList.add('is-closing');
        shell.classList.remove('is-settled');
        document.body.classList.add('lightbox-closing');
      }
    } finally {
      if (token !== motionToken && !teardown) return;
      cleanupFlyers();
      stopLightboxLenis();
      stopObservingContentWidth();
      disposeLightboxGradients();
      resetShellMotion();
      mediaHost?.replaceChildren();
      shell.querySelector('.lightbox__case')?.replaceChildren();
      shell.classList.remove('is-open', 'is-pre', 'is-settled', 'is-closing');
      shell.setAttribute('hidden', '');
      shell.style.visibility = '';
      shell.style.pointerEvents = '';
      lockPage(false);

      if (media) media.style.visibility = '';
      sourceCard?.classList.remove('is-lightbox-source');
      setProjectMode(false);

      openSlug = null;
      opening = false;
      closing = false;

      if (!skipHistory && projectParam()) {
        setHistory(null);
      }
    }
  }

  function onDocumentClick(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('[data-lightbox="project"]');
    if (!link) return;
    const item = link.closest('[data-project-slug]');
    const slug = item?.dataset.projectSlug;
    if (!slug) return;
    event.preventDefault();
    event.stopPropagation();
    openLightbox(slug, { card: item }).catch((error) => {
      console.error('Failed to open project lightbox', error);
    });
  }

  function onKeydown(event) {
    if ((event.key === 'Escape' || event.key === 'Esc') && shell?.classList.contains('is-open')) {
      event.preventDefault();
      closeLightbox();
    }
  }

  function onPopState() {
    if (document.body.dataset.page !== 'work') return;
    const slug = projectParam();
    if (slug) openLightbox(slug, { skipHistory: true, replaceHistory: true });
    else if (openSlug) closeLightbox({ skipHistory: true });
  }

  function onNavPrepare() {
    closeLightbox({ immediate: true, skipHistory: true });
  }

  function onWorkNavClick(event) {
    if (!shell?.classList.contains('is-open')) return;
    const workLink = event.target.closest('[data-nav="work"], .site-mark');
    if (!workLink) return;
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  }

  function onProjectPillClick(event) {
    if (!shell?.classList.contains('is-open') && !closing) return;
    const row = event.target.closest('.nav-pill__project-context');
    const action = event.target.closest('.project-nav-action');
    if (!row && !action) return;
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onWorkNavClick, true);
    document.addEventListener('click', onProjectPillClick, true);
    const previous = window.__navPreparePageSwap;
    window.__navPreparePageSwap = (...args) => {
      onNavPrepare();
      return previous?.(...args);
    };
    window.__lightboxPrevPrepare = previous;
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('popstate', onPopState);
    document.removeEventListener('click', onWorkNavClick, true);
    document.removeEventListener('click', onProjectPillClick, true);
    if (window.__lightboxPrevPrepare !== undefined) {
      window.__navPreparePageSwap = window.__lightboxPrevPrepare;
      delete window.__lightboxPrevPrepare;
    }
  }

  function boot() {
    bind();
    if (document.body.dataset.page !== 'work') return;
    const slug = projectParam();
    if (!slug) return;
    // Wait for masonry / card layout so cover media can clone with real sizes.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        openLightbox(slug, { skipHistory: true, replaceHistory: true }).catch((error) => {
          console.error('Failed to open project lightbox', error);
        });
      });
    });
  }

  function stop() {
    closeLightbox({ immediate: true, skipHistory: true, teardown: true });
    unbind();
  }

  window.ProjectLightbox = {
    boot,
    stop,
    open: openLightbox,
    close: closeLightbox,
  };

  if (window.__bootProjectLightboxWhenReady) {
    delete window.__bootProjectLightboxWhenReady;
    boot();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
