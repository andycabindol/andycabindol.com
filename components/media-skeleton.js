/**
 * MediaSkeleton — diagonal shine until img/video is ready, then fade in.
 */
(function () {
  function markLoaded(skeleton) {
    if (!skeleton) return;
    skeleton.classList.add('is-loaded');
  }

  function bindMedia(media, skeleton) {
    const done = () => markLoaded(skeleton);
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      done();
    };

    if (media.tagName === 'VIDEO') {
      if (media.readyState >= 2) {
        finish();
        return;
      }
      media.addEventListener('loadeddata', finish, { once: true });
      media.addEventListener('error', finish, { once: true });
      return;
    }

    // SVGs often report complete with naturalWidth 0 — still treat as ready.
    // Avoid decode() for SVG — it can hang/reject and leave opacity at 0.
    if (media.complete) {
      requestAnimationFrame(finish);
      return;
    }

    media.addEventListener('load', finish, { once: true });
    media.addEventListener('error', finish, { once: true });
  }

  function enhanceAboutHeroFrame(frame) {
    if (!(frame instanceof HTMLElement)) return;
    if (frame.dataset.skeletonBound === 'true') return;

    frame.dataset.skeletonBound = 'true';
    frame.classList.add('media-skeleton', 'media-skeleton--fill');

    const images = [...frame.querySelectorAll('[data-about-hero-image]')];
    const primary = images[0];
    if (!primary) {
      markLoaded(frame);
      return;
    }

    // Don't wrap hero imgs — the frame is the shine host; opacity stays on .is-active.
    bindMedia(primary, frame);
  }

  function enhanceImageOrVideo(media) {
    if (!(media instanceof HTMLElement)) return;
    if (media.dataset.skeletonBound === 'true') return;
    if (media.closest('[data-skeleton-skip]')) return;
    // About hero uses the frame as skeleton host (see enhanceAboutHeroFrame).
    if (media.closest('[data-about-hero]')) return;
    if (media.classList.contains('intro-logo')) return;
    // Decorative marquee logos — skeleton broke visibility/scale; skip entirely.
    if (media.closest('.brand-marquee')) return;
    // Testimonial avatars — inline skeleton wraps push credentials out of place.
    if (media.classList.contains('about-quote__avatar') || media.closest('.about-quote__meta')) return;

    media.dataset.skeletonBound = 'true';
    media.classList.add('media-skeleton__media');

    const host = media.closest(
      '.project-figure, .project-cover, .project-media-cell, .project-section__media, figure',
    );

    let skeleton;
    if (host) {
      skeleton = host;
      host.classList.add('media-skeleton', 'media-skeleton--fill');
    } else if (media.parentElement?.classList.contains('media-skeleton')) {
      skeleton = media.parentElement;
    } else {
      skeleton = document.createElement('span');
      const isInline =
        media.classList.contains('company-logo')
        || media.closest('.company-name');

      skeleton.className = isInline
        ? 'media-skeleton media-skeleton--inline'
        : 'media-skeleton media-skeleton--fill';

      media.parentNode.insertBefore(skeleton, media);
      skeleton.appendChild(media);
    }

    bindMedia(media, skeleton);
  }

function enhanceWorkGradient(el) {
  if (!(el instanceof HTMLElement)) return;
  // Project gradients paint via WebGL — skip skeleton shine (it gets stuck grey when
  // contexts are delayed/exhausted). Work-grid cards can still use a soft base fill.
  if (el.closest('.project-page')) return;
  el.classList.add('media-skeleton', 'media-skeleton--fill');
}

  function initAll(root = document) {
    root.querySelectorAll('[data-about-hero-frame]').forEach(enhanceAboutHeroFrame);
    root.querySelectorAll('main img, main video').forEach(enhanceImageOrVideo);
    root.querySelectorAll('[data-work-gradient]').forEach(enhanceWorkGradient);
  }

  window.MediaSkeleton = {
    initAll,
    enhanceImageOrVideo,
    enhanceAboutHeroFrame,
    enhanceWorkGradient,
    markLoaded,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }
})();
