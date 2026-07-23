/**
 * Work thumbnails — Paper Static Mesh Gradient
 * Base: https://shaders.paper.design/static-mesh-gradient
 * Duplicate stops = multiple blobs of the same color (waves push them apart).
 */
import {
  ShaderMount,
  staticMeshGradientFragmentShader,
  ShaderFitOptions,
  getShaderColorFromString,
} from '@paper-design/shaders';

const GRAIN_MIXER = 0.35;
const GRAIN_OVERLAY = 0.45;
const MIXING = 0.85;
const SCALE = 0.45;

const SLUG_COMPANY = {
  'google-branding': 'Google',
  'ai-mode': 'Google',
  'voice-search': 'Google',
  'youtube-ai-brand': 'YouTube',
  'chirper': 'Chirper',
  'peer-payment': 'Baton',
  'music-remix': 'Baton',
  'baton-branding': 'Baton',
};

/**
 * Each repeated hex becomes another mesh blob (Paper places one node per color).
 * Pattern: cream×2, light×2, mid, deep, flare, bright×2
 */
const COMPANY_COLORS = {
  Google: [
    '#f0edea', '#f0edea',
    '#7eb6ff', '#7eb6ff',
    '#3d98ff', '#1a73e8',
    '#4ec4ff',
    '#c5b8ff', '#c5b8ff',
  ],
  YouTube: [
    '#f0edea', '#f0edea',
    '#ff8a8a', '#ff8a8a',
    '#ff4d4d', '#e60023',
    '#ff7a45',
    '#ffc08a', '#ffc08a',
  ],
  Chirper: [
    '#f0edea', '#f0edea',
    '#a8b4ff', '#a8b4ff',
    '#6b7cff', '#4350e0',
    '#9a7dff',
    '#b8e0ff', '#b8e0ff',
  ],
  Baton: [
    '#f0edea', '#f0edea',
    '#7ee0d6', '#7ee0d6',
    '#2ec4b6', '#0d9488',
    '#5ad4a8', '#5ad4a8',
    '#b8ecc0', '#b8ecc0',
  ],
};

const FALLBACK_COLORS = COMPANY_COLORS.Google;

function hashSlug(slug) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unit(hash, salt) {
  return ((hash >>> salt) & 0xff) / 255;
}

function waveVariation(slug, variant = '') {
  const h = hashSlug(variant ? `${slug}:${variant}` : slug || 'work');
  return {
    // Same ranges as work-grid thumbnails — small differences only
    positions: 42 + unit(h, 0) * 50,
    waveX: 0.22 + unit(h, 8) * 0.55,
    waveXShift: unit(h, 16),
    waveY: 0.72 + unit(h, 24) * 0.28,
    waveYShift: unit(h, 4),
  };
}

function colorsForSlug(slug) {
  const company = SLUG_COMPANY[slug] || 'Google';
  return COMPANY_COLORS[company] || FALLBACK_COLORS;
}

function createUniforms(slug, variant = '') {
  const colors = colorsForSlug(slug);
  const waves = waveVariation(slug, variant);
  return {
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length,
    u_positions: waves.positions,
    u_waveX: waves.waveX,
    u_waveXShift: waves.waveXShift,
    u_waveY: waves.waveY,
    u_waveYShift: waves.waveYShift,
    u_mixing: MIXING,
    u_grainMixer: GRAIN_MIXER,
    u_grainOverlay: GRAIN_OVERLAY,
    u_fit: ShaderFitOptions.cover,
    u_scale: SCALE,
    u_rotation: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  };
}

const liveGradients = new Set();

function markGradientLoaded(el) {
  const hosts = new Set([el]);
  const wrap = el.closest('.project-figure, .project-cover, .project-media');
  if (wrap) hosts.add(wrap);
  if (el.parentElement?.classList.contains('media-skeleton')) {
    hosts.add(el.parentElement);
  }

  hosts.forEach((host) => {
    host.classList.add('is-loaded');
    window.MediaSkeleton?.markLoaded?.(host);
  });
}

function disposeGradient(el) {
  if (!el) return;
  el._workGradientShader?.dispose?.();
  delete el._workGradientShader;
  delete el.dataset.workGradientInit;
  el.querySelectorAll?.('canvas')?.forEach((canvas) => canvas.remove());
  liveGradients.delete(el);
}

function initGradient(el) {
  if (!el || el.dataset.workGradientInit === 'true') {
    return null;
  }

  el.dataset.workGradientInit = 'true';
  const slug = el.dataset.slug || '';
  const variant = el.dataset.variant || '';

  try {
    const shader = new ShaderMount(
      el,
      staticMeshGradientFragmentShader,
      createUniforms(slug, variant),
      { antialias: true, alpha: false, premultipliedAlpha: true },
      0,
      0,
      2,
    );
    el._workGradientShader = shader;
    liveGradients.add(el);
    requestAnimationFrame(() => {
      markGradientLoaded(el);
    });
    return shader;
  } catch (error) {
    delete el.dataset.workGradientInit;
    console.warn(error);
    markGradientLoaded(el);
    return null;
  }
}

function initAll() {
  document.querySelectorAll('[data-work-gradient]:not([data-work-gradient-init])').forEach(initGradient);
  // Work cards each take a WebGL context; remount the nav orb if it was stolen.
  queueMicrotask(() => window.CreamyOrb?.ensureAlive?.());
}

function disposeAll() {
  [...liveGradients].forEach(disposeGradient);
  liveGradients.clear();
  // Fallback for any mounts not tracked (e.g. after hot reload).
  document.querySelectorAll('[data-work-gradient]').forEach((el) => {
    el._workGradientShader?.dispose?.();
    delete el._workGradientShader;
    delete el.dataset.workGradientInit;
  });
}

window.WorkGradients = {
  init: initGradient,
  initAll,
  disposeAll,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
