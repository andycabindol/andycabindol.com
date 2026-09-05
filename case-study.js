(function () {
  if (document.body.dataset.page !== 'case-study') return;

  function boot() {
    window.MediaSkeleton?.initAll?.();

    if (typeof initSmoothScroll === 'function') {
      initSmoothScroll();
    }
    window.bindProjectAutoplayVideos?.(document);
    window.bindAppStoreTickers?.(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
