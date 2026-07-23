let projectsCache = null;
let projectsPromise = null;

async function loadProjects() {
  if (projectsCache) return projectsCache;
  if (!projectsPromise) {
    projectsPromise = fetch('/projects.json')
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
  }
  projectsCache = await projectsPromise;
  return projectsCache;
}

function getProjectsList() {
  return projectsCache || [];
}

function getProjectSlug() {
  const fromBody = document.body.dataset.projectSlug;
  if (fromBody) return fromBody;

  const pathMatch = window.location.pathname.match(/\/projects\/([^/]+)\/?/);
  if (pathMatch) return pathMatch[1];

  const legacy = new URLSearchParams(window.location.search).get('project');
  if (legacy) return legacy;

  return getProjectsList()[0]?.slug || '';
}

function getAdjacentProjects(slug) {
  const keys = getProjectsList().map((project) => project.slug);
  const index = keys.indexOf(slug);
  const current = index >= 0 ? index : 0;
  const prev = keys[(current - 1 + keys.length) % keys.length];
  const next = keys[(current + 1) % keys.length];
  return { prev, next };
}

async function fillProjectPage() {
  await loadProjects();
  const slug = getProjectSlug();
  const { prev, next } = getAdjacentProjects(slug);
  const projects = getProjectsList();
  const project = projects.find((item) => item.slug === slug);
  const prevProject = projects.find((item) => item.slug === prev);
  const nextProject = projects.find((item) => item.slug === next);

  document.body.dataset.projectSlug = slug;

  if (project?.title) {
    document.title = `${project.title} — Andy Cabindol`;
  }

  const prevLink = document.querySelector('[data-project-prev]');
  const nextLink = document.querySelector('[data-project-next]');
  if (prevLink && prevProject) {
    prevLink.href = prevProject.url || `/projects/${prev}/`;
    prevLink.setAttribute('aria-label', `Previous project: ${prevProject.title}`);
  }
  if (nextLink && nextProject) {
    nextLink.href = nextProject.url || `/projects/${next}/`;
    nextLink.setAttribute('aria-label', `Next project: ${nextProject.title}`);
  }
}

let sectionLabelWipeToken = 0;

function cancelSectionLabelWipe() {
  sectionLabelWipeToken += 1;
}

function getSectionLabelCurrent(label) {
  return label.querySelector('[data-project-section-current]');
}

function getSectionLabelValue(label) {
  return (getSectionLabelCurrent(label)?.textContent || label.textContent || '').trim();
}

function updateSectionLabelMarquee(label) {
  if (!label) return;

  const text = getSectionLabelCurrent(label);
  if (!text || label.dataset.wiping === 'true') {
    label.classList.remove('nav-pill__project-section--overflow');
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    label.classList.remove('nav-pill__project-section--overflow');
    label.style.removeProperty('--marquee-distance');
    label.style.removeProperty('--marquee-duration');
    return;
  }

  // Measure natural text width against the clipped viewport.
  text.style.animation = 'none';
  text.style.transform = 'translateX(0)';
  void text.offsetWidth;

  const overflow = Math.ceil(text.scrollWidth - label.clientWidth);
  if (overflow > 2) {
    label.classList.remove('nav-pill__project-section--overflow');
    void label.offsetWidth;
    label.classList.add('nav-pill__project-section--overflow');
    label.style.setProperty('--marquee-distance', `${overflow}px`);
    // Longer overall so start/end holds stay readable.
    label.style.setProperty(
      '--marquee-duration',
      `${Math.max(12, Math.min(24, 10 + overflow / 12))}s`,
    );
  } else {
    label.classList.remove('nav-pill__project-section--overflow');
    label.style.removeProperty('--marquee-distance');
    label.style.removeProperty('--marquee-duration');
  }

  text.style.animation = '';
  text.style.transform = '';
}

function setSectionLabelText(label, nextText, { wipe = false } = {}) {
  if (!label) return;

  const target = nextText;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = getSectionLabelCurrent(label);

  if (!current) {
    label.textContent = '';
    current = document.createElement('span');
    current.className = 'nav-pill__project-section-text';
    current.dataset.projectSectionCurrent = '';
    current.textContent = target;
    label.appendChild(current);
    updateSectionLabelMarquee(label);
    return;
  }

  if (!wipe || reduceMotion) {
    // Same label → don't remount text / restart marquee (IO fires often while scrolling).
    if (!label.dataset.wiping && getSectionLabelValue(label) === target) {
      return;
    }
    cancelSectionLabelWipe();
    label.querySelectorAll('.nav-pill__project-section-text').forEach((node) => {
      if (node !== current) node.remove();
    });
    current.className = 'nav-pill__project-section-text';
    current.dataset.projectSectionCurrent = '';
    current.textContent = target;
    label.style.minWidth = '';
    delete label.dataset.wiping;
    updateSectionLabelMarquee(label);
    return;
  }

  if (
    (label.dataset.targetText || getSectionLabelValue(label)) === target
    && !label.dataset.wiping
  ) {
    return;
  }

  const token = ++sectionLabelWipeToken;
  const context = label.closest('[aria-live]');
  const prevLive = context?.getAttribute('aria-live');
  const fromWidth = Math.ceil(label.getBoundingClientRect().width);

  label.dataset.targetText = target;
  label.dataset.wiping = 'true';
  label.classList.remove('nav-pill__project-section--overflow');
  context?.setAttribute('aria-live', 'off');

  current.classList.remove('nav-pill__project-section-text--in');
  current.classList.add('nav-pill__project-section-text--out');
  current.removeAttribute('data-project-section-current');

  const incoming = document.createElement('span');
  incoming.className = 'nav-pill__project-section-text nav-pill__project-section-text--in';
  incoming.dataset.projectSectionCurrent = '';
  incoming.textContent = target;
  label.appendChild(incoming);

  // Never let wipe min-width beat the section max-width (long titles would grow the pill).
  const maxSection = label.clientWidth || fromWidth;
  const toWidth = Math.min(Math.ceil(incoming.scrollWidth), maxSection);
  label.style.minWidth = `${Math.min(Math.max(fromWidth, toWidth), maxSection)}px`;

  const finish = () => {
    if (token !== sectionLabelWipeToken) return;

    label.querySelectorAll('.nav-pill__project-section-text').forEach((node) => {
      if (node !== incoming) node.remove();
    });
    incoming.className = 'nav-pill__project-section-text';
    incoming.dataset.projectSectionCurrent = '';
    label.style.minWidth = '';
    delete label.dataset.wiping;
    delete label.dataset.targetText;
    updateSectionLabelMarquee(label);

    if (context) {
      if (prevLive == null) context.removeAttribute('aria-live');
      else context.setAttribute('aria-live', prevLive);
    }
  };

  window.setTimeout(finish, 300);
}

function initProjectSectionTracker() {
  const label = document.querySelector('[data-project-section-label]');
  const action = document.querySelector('.project-nav-action');
  const context = document.querySelector('.nav-pill__project-context');
  const sections = [...document.querySelectorAll('[data-section-label]')];
  if (!label || !sections.length) return () => {};

  let completeTimer = 0;
  let activeSectionName = '';

  const projectTitle = () =>
    document.querySelector('#overview')?.dataset.sectionLabel
    || document.querySelector('.project-lede')?.textContent?.trim()
    || getSectionLabelValue(label)
    || 'Overview';

  const isLockedComplete = () =>
    context?.classList.contains('nav-pill__project-context--complete')
    || context?.classList.contains('nav-pill__project-context--checking')
    || context?.classList.contains('nav-pill__project-context--completing');

  const markProjectComplete = () => {
    if (!context || !action || isLockedComplete()) return;

    action.style.setProperty('--project-progress', '1');
    context.classList.remove('nav-pill__project-context--overview');
    context.classList.add('nav-pill__project-context--completing');
    // Keep the project title through the check animation.
    action.dataset.section = 'Outcome';
    action.dataset.sectionId = 'outcome';
    action.setAttribute('aria-label', 'Project complete');

    window.clearTimeout(completeTimer);
    completeTimer = window.setTimeout(() => {
      context.classList.add('nav-pill__project-context--checking');

      completeTimer = window.setTimeout(() => {
        context.classList.remove(
          'nav-pill__project-context--completing',
          'nav-pill__project-context--checking',
        );
        context.classList.add('nav-pill__project-context--complete');
        setSectionLabelText(label, 'Select a project', { wipe: true });
        action.setAttribute('aria-label', 'Open all projects');
      }, 720);
    }, 320);
  };

  const setSection = (section) => {
    const sectionName = section.dataset.sectionLabel;
    const isOverview = section.id === 'overview';
    const hovering = context?.matches(':hover');
    const sectionChanged = sectionName !== activeSectionName;

    // IntersectionObserver re-fires as ratios change; only react to real section changes
    // so we don't restart the title marquee on every scroll tick.
    if (!sectionChanged) return;
    activeSectionName = sectionName;

    if (sectionName === 'Outcome') {
      markProjectComplete();
    }

    if (isLockedComplete()) {
      if (context.classList.contains('nav-pill__project-context--complete')) {
        setSectionLabelText(label, 'Select a project', { wipe: true });
      }
      action?.setAttribute('aria-label', 'Open all projects');
      return;
    }

    context?.classList.toggle('nav-pill__project-context--overview', isOverview);
    if (action) {
      action.dataset.section = sectionName;
      action.dataset.sectionId = section.id;
      action.setAttribute(
        'aria-label',
        isOverview ? 'Open all projects' : 'Scroll back to top',
      );
    }

    if (!isOverview) {
      document.querySelector('.project-work-panel')?.classList.remove('project-work-panel--visible');
    }

    // Label stays on the project title until Outcome → "Select a project".
    // Hover still shows action affordances.
    if (hovering && !isOverview) {
      setSectionLabelText(label, 'Scroll back to top');
    } else if (hovering && isOverview) {
      setSectionLabelText(label, 'Select a project');
    } else {
      setSectionLabelText(label, projectTitle());
    }
  };

  setSection(sections[0]);
  requestAnimationFrame(() => updateSectionLabelMarquee(label));

  const onResize = () => updateSectionLabelMarquee(label);
  window.addEventListener('resize', onResize, { passive: true });

  if (!('IntersectionObserver' in window)) {
    return () => {
      window.clearTimeout(completeTimer);
      cancelSectionLabelWipe();
      window.removeEventListener('resize', onResize);
    };
  }

  const visible = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visible.set(entry.target, entry.intersectionRatio);
      } else {
        visible.delete(entry.target);
      }
    });

    const current = [...visible.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (current) setSection(current);
  }, {
    rootMargin: '-28% 0px -48% 0px',
    threshold: [0, 0.25, 0.5, 0.75, 1],
  });

  sections.forEach((section) => observer.observe(section));
  return () => {
    window.clearTimeout(completeTimer);
    cancelSectionLabelWipe();
    window.removeEventListener('resize', onResize);
    observer.disconnect();
  };
}

function initProjectNavAction() {
  const action = document.querySelector('.project-nav-action');
  const context = document.querySelector('.nav-pill__project-context');
  const label = document.querySelector('[data-project-section-label]');
  const header = document.querySelector('.site-header');
  if (!action || !context || !header) return () => {};

  const projects = getProjectsList();
  const currentSlug = getProjectSlug();

  const panel = document.createElement('aside');
  panel.className = 'project-work-panel';
  panel.setAttribute('aria-label', 'All projects');
  panel.innerHTML = `
    <div class="project-work-panel__fade project-work-panel__fade--top" aria-hidden="true"></div>
    <div class="project-work-panel__fade project-work-panel__fade--bottom" aria-hidden="true"></div>
    <div class="project-work-panel__active-edge project-work-panel__active-edge--top" aria-hidden="true"></div>
    <div class="project-work-panel__active-edge project-work-panel__active-edge--bottom" aria-hidden="true"></div>
    <div class="project-work-panel__scroll" data-lenis-prevent>
      <p class="project-work-panel__label">Select a project</p>
      <ul class="project-work-panel__list">
        ${projects.map((project) => `
          <li>
            <a
              class="project-link project-work-panel__link${project.slug === currentSlug ? ' project-work-panel__link--active' : ''}"
              href="${project.url || `/projects/${project.slug}/`}"
            >
              <span class="project-work-panel__lead" aria-hidden="true">
                <span class="project-work-panel__dot"></span>
                <span class="project-work-panel__arrow">→</span>
              </span>
              <span class="project-work-panel__title">${project.title}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
  document.body.appendChild(panel);
  const panelScroll = panel.querySelector('.project-work-panel__scroll');

  let closeTimer = 0;
  let frame = 0;
  let pointerOnPanel = false;
  let ignorePageScrollClose = false;

  const isOverview = () => action.dataset.sectionId === 'overview';
  const isComplete = () =>
    context.classList.contains('nav-pill__project-context--complete')
    || context.classList.contains('nav-pill__project-context--checking')
    || context.classList.contains('nav-pill__project-context--completing');
  const projectTitle = () =>
    document.querySelector('#overview')?.dataset.sectionLabel
    || document.querySelector('.project-lede')?.textContent?.trim()
    || 'Overview';
  const isPanelOpen = () => panel.classList.contains('project-work-panel--visible');
  const canOpenWorkPanel = () =>
    context.classList.contains('nav-pill__project-context--complete')
    || isOverview();

  const positionPanel = () => {
    const headerRect = header.getBoundingClientRect();
    const panelWidth = Math.min(320, window.innerWidth - 32);
    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${headerRect.right + 1}px`;
    panel.style.top = `${headerRect.top}px`;
  };

  const openPanel = () => {
    if (!canOpenWorkPanel()) return;
    window.clearTimeout(closeTimer);
    positionPanel();
    panel.classList.add('project-work-panel--visible');
    context.classList.add('nav-pill__project-context--panel-open');
    setSectionLabelText(label, 'Select a project');
    // Ignore leftover Lenis inertia after opening.
    ignorePageScrollClose = true;
    window.clearTimeout(openPanel.ignoreTimer);
    openPanel.ignoreTimer = window.setTimeout(() => {
      ignorePageScrollClose = false;
    }, 450);
    updatePanelFade();
  };

  const closePanel = () => {
    window.clearTimeout(closeTimer);
    panel.classList.remove(
      'project-work-panel--visible',
      'project-work-panel--active-above',
      'project-work-panel--active-below',
    );
    context.classList.remove('nav-pill__project-context--panel-open');
    if (!isComplete() && !context.matches(':hover')) {
      setSectionLabelText(label, projectTitle());
    }
  };

  const updatePanelFade = () => {
    const { scrollTop, scrollHeight, clientHeight } = panelScroll;
    const canScroll = scrollHeight > clientHeight + 1;
    const atTop = scrollTop <= 1;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
    panel.classList.toggle('project-work-panel--fade-top', canScroll && !atTop);
    panel.classList.toggle('project-work-panel--fade-bottom', canScroll && !atBottom);

    const activeLink = panel.querySelector('.project-work-panel__link--active');
    let activeAbove = false;
    let activeBelow = false;
    if (activeLink) {
      const scrollRect = panelScroll.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      activeAbove = linkRect.bottom < scrollRect.top + 2;
      activeBelow = linkRect.top > scrollRect.bottom - 2;
    }
    panel.classList.toggle('project-work-panel--active-above', activeAbove);
    panel.classList.toggle('project-work-panel--active-below', activeBelow);
  };

  const scheduleClose = () => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closePanel, 120);
  };

  const scrollToTop = () => {
    closePanel();
    if (window.__lenis) {
      window.__lenis.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const updateProgress = () => {
    frame = 0;
    if (isComplete()) {
      action.style.setProperty('--project-progress', '1');
      return;
    }
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const scroll = window.__lenis?.scroll ?? window.scrollY;
    action.style.setProperty(
      '--project-progress',
      Math.min(1, Math.max(0, scroll / maxScroll)).toFixed(4),
    );
  };

  const requestProgressUpdate = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };

  const onContextEnter = () => {
    if (isComplete()) {
      setSectionLabelText(label, 'Select a project');
      return;
    }
    if (isOverview()) {
      setSectionLabelText(label, 'Select a project');
      return;
    }
    setSectionLabelText(label, 'Scroll back to top');
  };

  const onContextLeave = () => {
    if (isComplete() || isPanelOpen()) {
      setSectionLabelText(label, 'Select a project');
      return;
    }
    setSectionLabelText(label, projectTitle());
  };

  const onContextClick = (event) => {
    if (event.target.closest('.project-work-panel')) return;

    if (canOpenWorkPanel()) {
      if (isPanelOpen()) {
        closePanel();
      } else {
        openPanel();
      }
      return;
    }

    scrollToTop();
  };

  const onDocumentPointerDown = (event) => {
    if (!isPanelOpen()) return;
    if (event.target.closest('.project-work-panel')) return;
    if (event.target.closest('.nav-pill__project-context')) return;
    closePanel();
  };

  const onPanelWheel = (event) => {
    event.stopPropagation();
  };

  const onWindowResize = () => {
    positionPanel();
    updatePanelFade();
  };

  const onPageScroll = () => {
    // Progress only — Lenis inertia fires scroll without new input,
    // so don't close the panel here.
    requestProgressUpdate();
  };

  const onIntentionalPageScrollInput = (event) => {
    if (!isPanelOpen() || ignorePageScrollClose || pointerOnPanel) return;
    if (event.target.closest('.project-work-panel')) return;
    closePanel();
  };

  context.addEventListener('mouseenter', onContextEnter);
  context.addEventListener('mouseleave', onContextLeave);
  context.addEventListener('click', onContextClick);
  action.addEventListener('focus', onContextEnter);
  action.addEventListener('blur', onContextLeave);

  panel.addEventListener('mouseenter', () => {
    pointerOnPanel = true;
    window.clearTimeout(closeTimer);
  });
  panel.addEventListener('mouseleave', () => {
    pointerOnPanel = false;
    scheduleClose();
  });
  panelScroll.addEventListener('wheel', onPanelWheel, { passive: true });
  panelScroll.addEventListener('scroll', updatePanelFade, { passive: true });
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('wheel', onIntentionalPageScrollInput, { passive: true, capture: true });
  document.addEventListener('touchmove', onIntentionalPageScrollInput, { passive: true, capture: true });
  window.addEventListener('scroll', onPageScroll, { passive: true });
  window.addEventListener('resize', onWindowResize, { passive: true });
  updateProgress();

  return () => {
    window.clearTimeout(closeTimer);
    window.clearTimeout(openPanel.ignoreTimer);
    cancelAnimationFrame(frame);
    context.removeEventListener('mouseenter', onContextEnter);
    context.removeEventListener('mouseleave', onContextLeave);
    context.removeEventListener('click', onContextClick);
    action.removeEventListener('focus', onContextEnter);
    action.removeEventListener('blur', onContextLeave);
    panelScroll.removeEventListener('wheel', onPanelWheel);
    panelScroll.removeEventListener('scroll', updatePanelFade);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    document.removeEventListener('wheel', onIntentionalPageScrollInput, { capture: true });
    document.removeEventListener('touchmove', onIntentionalPageScrollInput, { capture: true });
    window.removeEventListener('scroll', onPageScroll);
    window.removeEventListener('resize', onWindowResize);
    panel.remove();
  };
}

function initProjectContact() {
  const button = document.querySelector('.contact-button');
  if (!button) return;

  let popover;
  let hideTimer;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.email);
    } catch {
      return;
    }

    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'contact-popover contact-popover--side';
      popover.textContent = 'Email copied!';
      document.body.appendChild(popover);
    }

    const rect = button.getBoundingClientRect();
    const header = document.querySelector('.site-header');
    const headerRect = header?.getBoundingClientRect() ?? rect;
    popover.style.left = `${headerRect.right}px`;
    popover.style.top = `${rect.top + rect.height / 2}px`;
    popover.classList.remove('contact-popover--leaving');
    void popover.offsetWidth;
    popover.classList.add('contact-popover--visible');

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      popover.classList.remove('contact-popover--visible');
      popover.classList.add('contact-popover--leaving');
      setTimeout(() => popover.classList.remove('contact-popover--leaving'), 240);
    }, 2200);
  });
}

let stopProjectSectionTracker = () => {};
let stopProjectNavAction = () => {};

function resetProjectNavCompleteState() {
  const context = document.querySelector('.nav-pill__project-context');
  const action = document.querySelector('.project-nav-action');
  const label = document.querySelector('[data-project-section-label]');
  cancelSectionLabelWipe();
  context?.classList.remove(
    'nav-pill__project-context--completing',
    'nav-pill__project-context--checking',
    'nav-pill__project-context--complete',
    'nav-pill__project-context--panel-open',
  );
  action?.style.removeProperty('--project-progress');
  if (label) {
    label.style.minWidth = '';
    delete label.dataset.wiping;
    delete label.dataset.targetText;
    if (!getSectionLabelValue(label)) {
      setSectionLabelText(
        label,
        document.querySelector('#overview')?.dataset.sectionLabel
          || document.querySelector('.project-lede')?.textContent?.trim()
          || 'Overview',
      );
    }
  }
}

async function bootProjectPage() {
  stopProjectSectionTracker();
  stopProjectNavAction();
  resetProjectNavCompleteState();
  await loadProjects();
  await fillProjectPage();
  stopProjectSectionTracker = initProjectSectionTracker();
  stopProjectNavAction = initProjectNavAction();
  if (typeof initSmoothScroll === 'function') {
    initSmoothScroll();
  }
  window.bootProjectEmbeds?.();
  window.MediaSkeleton?.initAll?.();

  const startHeavy = () => {
    if (document.body.dataset.page !== 'project') {
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

function stopProjectPage() {
  stopProjectSectionTracker();
  stopProjectNavAction();
  resetProjectNavCompleteState();
  window.WorkGradients?.disposeAll?.();
  if (typeof stopWorkPage === 'function') {
    stopWorkPage();
  }
}

window.sitePages = window.sitePages || {};
window.sitePages.project = {
  boot: bootProjectPage,
  stop: stopProjectPage,
};

if (document.body.dataset.page === 'project') {
  bootProjectPage();
  if (typeof bindContactButtons === 'function') {
    bindContactButtons();
  } else {
    initProjectContact();
  }
}
