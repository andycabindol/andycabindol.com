/**
 * CreamyOrb — Paper Warp (blue remapping of):
 * https://shaders.paper.design/warp#colors=14120f,d2a76a,f0edea&proportion=0.35&softness=1&distortion=0.21&swirl=0.31&swirlIterations=11.6&shape=edge&shapeScale=0.75&speed=4.2&scale=2
 */
import {
  ShaderMount,
  warpFragmentShader,
  WarpPatterns,
  ShaderFitOptions,
  getShaderColorFromString,
  getShaderNoiseTexture,
} from '@paper-design/shaders';

/* Dark → mid → light (5 stops) */
const ORB_COLORS = ['#143a9e', '#2f6fe0', '#3d98ff', '#6bb0ff', '#a8d2ff'];

let noiseTexturePromise = null;

function loadNoiseTexture() {
  if (noiseTexturePromise) {
    return noiseTexturePromise;
  }

  noiseTexturePromise = Promise.resolve().then(() => {
    const img = getShaderNoiseTexture();
    if (!img) {
      throw new Error('Paper Shaders: noise texture unavailable');
    }
    if (img.complete && img.naturalWidth > 0) {
      return img;
    }
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Paper Shaders: failed to load noise texture'));
    });
  });

  return noiseTexturePromise;
}

function createOrbUniforms(noiseTexture) {
  return {
    u_colors: ORB_COLORS.map(getShaderColorFromString),
    u_colorsCount: ORB_COLORS.length,
    u_proportion: 0.35,
    u_softness: 1,
    u_distortion: 0.21,
    u_swirl: 0.31,
    u_swirlIterations: 15.6,
    u_shape: WarpPatterns.edge,
    u_shapeScale: 0.75,
    u_noiseTexture: noiseTexture,
    u_fit: ShaderFitOptions.cover,
    u_scale: 0.4,
    u_rotation: 0,
    u_offsetX: 0,
    u_offsetY: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0,
  };
}

function isOrbAlive(root) {
  const shader = root?._creamyOrbShader;
  const canvas = root?.querySelector('.creamy-orb__shader canvas');
  if (!shader || !canvas) {
    return false;
  }
  const gl = shader.gl || canvas.getContext('webgl2');
  if (!gl || gl.isContextLost?.()) {
    return false;
  }
  return true;
}

function dispose(root) {
  const shader = root?._creamyOrbShader;
  if (shader) {
    try {
      shader.dispose?.();
    } catch {
      // Context may already be lost.
    }
    delete root._creamyOrbShader;
  }

  const mount = root?.querySelector('.creamy-orb__shader');
  if (mount) {
    mount.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    delete mount.paperShaderMount;
  }

  if (root) {
    delete root.dataset.creamyOrbInit;
  }
}

async function initCreamyOrb(root) {
  if (!root) {
    return null;
  }

  if (root.dataset.creamyOrbInit === 'true') {
    if (isOrbAlive(root)) {
      return root._creamyOrbShader;
    }
    dispose(root);
  }

  const mount = root.querySelector('.creamy-orb__shader');
  if (!mount) {
    return null;
  }

  root.dataset.creamyOrbInit = 'true';

  try {
    const noiseTexture = await loadNoiseTexture();
    if (root.dataset.creamyOrbInit !== 'true') {
      return null;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shader = new ShaderMount(
      mount,
      warpFragmentShader,
      createOrbUniforms(noiseTexture),
      { antialias: true, alpha: true, premultipliedAlpha: true },
      reduceMotion ? 0 : 4.2,
      0,
      2,
    );

    root._creamyOrbShader = shader;

    const canvas = shader.canvasElement || mount.querySelector('canvas');
    canvas?.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        dispose(root);
      },
      { once: true },
    );

    canvas?.addEventListener(
      'webglcontextrestored',
      () => {
        ensureAlive();
      },
      { once: true },
    );

    return shader;
  } catch (error) {
    dispose(root);
    console.warn(error);
    return null;
  }
}

function initAll() {
  document.querySelectorAll('.creamy-orb').forEach((root) => {
    if (!isOrbAlive(root)) {
      initCreamyOrb(root);
    }
  });
}

/** Remount after other WebGL (work thumbnails) may have stolen the context. */
function ensureAlive() {
  document.querySelectorAll('.creamy-orb').forEach((root) => {
    if (isOrbAlive(root)) {
      return;
    }
    dispose(root);
    initCreamyOrb(root);
  });
}

window.CreamyOrb = {
  init: initCreamyOrb,
  initAll,
  dispose,
  ensureAlive,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
