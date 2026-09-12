/**
 * Nav pill Canvas UI Glass.
 * Live refraction when html-in-canvas is available; classic white nav pill otherwise.
 */
(function () {
  const Glass = window.CanvasUIGlass;
  if (!Glass || typeof Glass.createGlass !== 'function') {
    console.warn('[nav-glass] CanvasUIGlass missing');
    return;
  }

  const OPTIONS = {
    shape: 'rectangle',
    ior: 1.28,
    edge: 0.31,
    bevel: 6.25,
    depth: 390,
    aberration: 1.4,
    blur: 0.6,
    reflection: 2,
    shine: 0,
    size: 16,
    aspect: 6,
    corner: 22,
    zoom: 1,
    follow: 1,
    autoSize: true,
    pinned: true,
  };

  function rebindLenis(wrapper, contentEl) {
    // Glass locks html/body overflow. Reduced motion → native scroll on the host.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        window.__lenis?.destroy?.();
      } catch {
        /* ignore */
      }
      window.__lenis = null;
      wrapper.style.overflow = 'auto';
      return null;
    }

    if (typeof Lenis !== 'function') {
      wrapper.style.overflow = 'auto';
      return null;
    }

    const prev = window.__lenis;
    const scroll = prev?.scroll ?? window.scrollY ?? 0;
    try {
      prev?.destroy?.();
    } catch {
      /* ignore */
    }

    // eventsTarget: window — Windows/Chrome trackpads often don't deliver wheel
    // to descendants of <canvas layoutsubtree>; listening on the wrapper alone freezes scroll.
    const create = window.__createSiteLenis;
    const lenis = create
      ? create({
          wrapper,
          content: contentEl,
          eventsTarget: window,
        })
      : new Lenis({
          wrapper,
          content: contentEl,
          eventsTarget: window,
          lerp: 0.12,
          smoothWheel: true,
          autoRaf: true,
        });
    window.__lenis = lenis;
    lenis.scrollTo(scroll, { immediate: true });
    requestAnimationFrame(() => lenis.resize?.());
    window.__ensureLenisRaf?.();
    return lenis;
  }

  function restoreDocumentLenis() {
    if (typeof Lenis !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        window.__lenis?.destroy?.();
      } catch {
        /* ignore */
      }
      window.__lenis = null;
      return;
    }
    try {
      window.__lenis?.destroy?.();
    } catch {
      /* ignore */
    }
    const create = window.__createSiteLenis;
    window.__lenis = create
      ? create()
      : new Lenis({
          lerp: 0.12,
          smoothWheel: true,
          autoRaf: true,
        });
    window.__ensureLenisRaf?.();
  }

  function boot() {
    if (document.body.dataset.page === 'case-study') return;

    const header = document.querySelector('.site-header');
    const stage = document.querySelector('.site-stage');
    if (!header || !stage) return;

    const live = Glass.supportsHtmlInCanvas();
    document.body.classList.toggle('nav-glass-live', live);
    document.body.classList.toggle('nav-glass-fallback', !live);
    document.documentElement.classList.toggle('nav-glass-live', live);

    // No html-in-canvas: keep the classic white nav pill from nav.css.
    if (!live) return;

    document.body.classList.add('nav-glass-on');

    const root = document.createElement('div');
    root.className = 'nav-glass-root';

    const source = document.createElement('canvas');
    source.className = 'nav-glass__source';
    source.setAttribute('layoutsubtree', 'true');

    const content = document.createElement('div');
    content.className = 'nav-glass__content';

    const output = document.createElement('canvas');
    output.className = 'nav-glass__output';
    output.setAttribute('aria-hidden', 'true');

    source.appendChild(content);
    content.appendChild(stage);
    root.appendChild(source);
    root.appendChild(output);
    header.after(root);
    rebindLenis(content, stage);

    const instance = Glass.createGlass(
      { source, content, output },
      {
        ...OPTIONS,
        pinElement: header,
      },
    );

    if (!instance) {
      console.warn('[nav-glass] WebGL2 unavailable — classic nav pill');
      header.after(stage);
      document.body.classList.remove('nav-glass-live', 'nav-glass-on');
      document.documentElement.classList.remove('nav-glass-live');
      document.body.classList.add('nav-glass-fallback');
      restoreDocumentLenis();
      root.remove();
      return;
    }

    window.__navGlass = instance;
  }

  function startWhenReady() {
    if (document.querySelector('.site-stage') && document.querySelector('.site-header')) {
      boot();
      return;
    }
    requestAnimationFrame(startWhenReady);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(startWhenReady), {
      once: true,
    });
  } else {
    requestAnimationFrame(startWhenReady);
  }
})();
