/* Canvas UI Glass (vanilla) — adapted from https://canvasui.dev/docs/components/glass
 * EXPERIMENTAL — delete components/canvasui/ + nav-glass.* and script/link hooks to undo.
 */
(function (global) {
'use strict';

function createRectCache(element) {
  let current = element.getBoundingClientRect();
  const refresh = () => { current = element.getBoundingClientRect(); };
  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', refresh, { capture: true, passive: true });
  return {
    get current() { return current; },
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    },
  };
}


const DEFAULTS = {
  shape: "circle",
  size: 120,
  aspect: 1.7,
  corner: 32,
  ior: 1.5,
  edge: 0.7,
  bevel: 4,
  depth: 250,
  aberration: 1,
  blur: 0,
  reflection: 1,
  shine: 0.01,
  zoom: 1.5,
  targets: "[data-glass-target]",
  follow: 0.2,
  /** When true, lens stays fixed (no cursor follow / hide). */
  pinned: false,
  /** Pin lens to this element’s box (center + optional autoSize). */
  pinElement: null,
  /** Derive size / aspect / corner from pinElement each frame. */
  autoSize: true,
};

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main () {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform float uMaxX;
uniform float uHasContent;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uCorner;
uniform float uEdge;
uniform float uBevel;
uniform float uIor;
uniform float uDepth;
uniform float uAberration;
uniform float uBlur;
uniform float uReflect;
uniform float uShine;
uniform float uZoom;
uniform float uAlpha;
uniform vec3 uPageBg;

const float PI = 3.14159265358979;
const float AIR_IOR = 1.0003;
const vec3 INCIDENT = vec3(0.0, 0.0, 1.0);

float pow2 (float x) { return x * x; }
float pow5 (float x) { float x2 = x * x; return x2 * x2 * x; }
float linearStep (float e0, float e1, float x) {
  return clamp((x - e0) / (e1 - e0), 0.0, 1.0);
}

float sdf (vec2 p) {
  vec2 q = abs(p) - (uHalf - vec2(uCorner));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCorner;
}

float ign (vec2 v) {
  return fract(52.9829189 * fract(0.06711056 * v.x + 0.00583715 * v.y));
}

vec3 page (vec2 px, float lod) {
  vec2 uv = px / uResolution;
  uv.x = clamp(uv.x, 0.0005, uMaxX - 0.0005);
  uv.y = clamp(uv.y, 0.0005, 0.9995);
  vec4 tex = textureLod(uContent, vec2(uv.x, 1.0 - uv.y), lod);
  // Transparent canvas texels are RGB black — composite over page bg.
  vec3 rgb = pow(max(tex.rgb, vec3(0.0)), vec3(2.2));
  vec3 bg = pow(uPageBg, vec3(2.2));
  return mix(bg, rgb, clamp(tex.a, 0.0, 1.0));
}

float iorForWavelength (float wavelength) {
  float ab = uAberration * 0.1;
  return mix(uIor + ab, uIor - ab,
    1.0 - pow(1.0 - linearStep(450.0, 650.0, wavelength), 4.0));
}

vec3 pageAA (vec2 px, float minLod) {
  float footprint = max(length(fwidth(px)), 1.0);
  return page(px, max(minLod, log2(footprint)));
}

vec3 sampleRefraction (vec2 basePx, float rim, vec3 normal, float glassIor) {
  vec3 rv = refract(INCIDENT, normal, AIR_IOR / glassIor);
  rv /= abs(rv.z) / uDepth;

  return pageAA(basePx + rv.xy, uBlur * (1.0 + rim));
}

float fresnelSchlick (float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow5(1.0 - cosTheta);
}

float smithSchlickDenom (float cosTheta, float k) {
  return cosTheta * (1.0 - k) + k;
}

float ggx (float roughness, float NDotL, float NDotV, float NDotH) {
  if (NDotL <= 0.0) return 0.0;
  float a2 = pow2(roughness);
  float d = a2 / (PI * pow2(pow2(NDotH) * (a2 - 1.0) + 1.0));
  float k = roughness * 0.5;
  float v = 1.0 / (smithSchlickDenom(NDotL, k)
    * smithSchlickDenom(clamp(NDotV, 0.0, 1.0), k));
  return NDotL * d * v;
}

void main () {
  vec2 fragPx = gl_FragCoord.xy;
  vec2 p = fragPx - uCenter;
  float sd = sdf(p);

  float aa = 1.5;
  float mask = 1.0 - smoothstep(-aa, 0.0, sd);
  float alpha = mask * uAlpha
    * (1.0 - step(uMaxX, fragPx.x / uResolution.x));

  float minHalf = min(uHalf.x, uHalf.y);
  float edgeW = max(minHalf * (1.0 - clamp(uEdge, 0.0, 0.98)), 1.0);
  float rim = pow(linearStep(-edgeW, 0.0, sd), uBevel);

  float scatter = min(uBlur, 1.0) * 0.02;
  float randAngle = ign(fragPx) * PI * 2.0;
  vec3 flatNormal = normalize(
    vec3(sin(randAngle) * scatter, cos(randAngle) * scatter, -1.0));
  float e = 1.0;
  vec2 grad = vec2(
    sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)),
    sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e)));
  vec3 rimNormal = vec3(normalize(grad + vec2(1e-5)), 0.0);
  vec3 normal = normalize(mix(flatNormal, rimNormal, rim));

  if (uHasContent < 0.5) {
    // Clear-glass fallback (Safari / no html-in-canvas): light rim + faint face,
    // never a dark scrim.
    float ldot = dot(rimNormal.xy, normalize(vec2(-0.6, 0.8)));
    float band = pow(rim, 1.8);
    float arcs = pow(abs(ldot), 3.0) * (ldot > 0.0 ? 0.55 : 0.3);
    float shine = band * (0.08 + arcs) * max(uShine, 0.35);
    float face = mask * (0.045 + 0.07 * rim);
    float a = alpha * clamp(face + shine * 0.65, 0.0, 0.55);
    vec3 col = vec3(0.96, 0.98, 1.0) * (0.55 + shine * 1.35);
    outColor = vec4(col * a, a);
    return;
  }

  vec2 basePx = uCenter + p / uZoom;

  vec3 refracted;
  if (uAberration > 0.001) {
    refracted = sampleRefraction(basePx, rim, normal, iorForWavelength(611.4))
      * vec3(1.0, 0.0, 0.0);
    refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(570.5))
      * vec3(1.0, 1.0, 0.0);
    refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(549.1))
      * vec3(0.0, 1.0, 0.0);
    refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(491.4))
      * vec3(0.0, 1.0, 1.0);
    refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(464.2))
      * vec3(0.0, 0.0, 1.0);
    refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(374.0))
      * vec3(1.0, 0.0, 1.0);
    refracted /= 3.0;
  } else {
    refracted = sampleRefraction(basePx, rim, normal, uIor);
  }

  vec3 glass = refracted;
  if (uReflect > 0.001) {
    const vec3 V = vec3(0.0, 0.0, -1.0);
    float NDotV = clamp(dot(V, normal), 0.0, 1.0);
    float f0 = pow2((uIor - AIR_IOR) / (uIor + AIR_IOR));
    float fresnelV = fresnelSchlick(NDotV, f0) * uReflect;

    vec3 reflectVector = reflect(INCIDENT, normal);
    vec3 L = reflectVector;
    vec3 H = normalize(L + V);
    reflectVector /= abs(reflectVector.z) / uDepth;
    vec3 reflected = page(basePx + reflectVector.xy, 2.5 + uBlur);
    reflected *= ggx(0.5, dot(normal, L), NDotV, dot(normal, H));
    glass = mix(refracted, reflected, clamp(fresnelV, 0.0, 1.0));
  }

  if (uShine > 0.001) {
    float ldot = dot(rimNormal.xy, normalize(vec2(-0.6, 0.8)));
    float band = pow(rim, 1.8);
    float arcs = pow(abs(ldot), 3.0) * (ldot > 0.0 ? 0.5 : 0.28);
    glass += band * (0.04 + arcs) * uShine;
  }

  outColor = vec4(pow(glass, vec3(1.0 / 2.2)) * alpha, alpha);
}`;

function supportsHtmlInCanvas() {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("canvas");
  probe.setAttribute("layoutsubtree", "");
  const ctx = probe.getContext("2d");
  return Boolean(
    ctx &&
    typeof ctx.drawElementImage === "function" &&
    typeof probe.requestPaint === "function",
  );
}

function htmlInCanvasDiagnostics() {
  if (typeof document === "undefined") {
    return { supported: false, drawElementImage: false, requestPaint: false };
  }
  const probe = document.createElement("canvas");
  probe.setAttribute("layoutsubtree", "");
  const ctx = probe.getContext("2d");
  return {
    supported: supportsHtmlInCanvas(),
    drawElementImage: typeof ctx?.drawElementImage === "function",
    requestPaint: typeof probe.requestPaint === "function",
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

function createGlass(elements, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const { source, content, output } = elements;

  const gl = output.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!gl || gl.isContextLost()) return null;

  const sourceCtx = source.getContext("2d");
  const paintable = source;
  const htmlInCanvas = Boolean(
    sourceCtx &&
    typeof sourceCtx.drawElementImage === "function" &&
    typeof paintable.requestPaint === "function",
  );

  let contentDirty = false;
  let wake = () => {};
  let externalContent = false;

  if (htmlInCanvas) {
    paintable.onpaint = () => {
      try {
        sourceCtx.reset();
        // Page bg lives on <html>; canvas children are transparent without this,
        // and transparent texels upload as black → black glass.
        const bg =
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim() || "#fbfaf9";
        sourceCtx.fillStyle = bg;
        sourceCtx.fillRect(0, 0, source.width, source.height);
        sourceCtx.drawElementImage(content, 0, 0);
        contentDirty = true;
        wake();
      } catch {}
    };
  }

  function compile(type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Glass shader error:", gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  const vertexShader = compile(gl.VERTEX_SHADER, VERT);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const contentTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, contentTexture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.generateMipmap(gl.TEXTURE_2D);

  let contentMaxX = 1;

  function syncCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(output.clientWidth * dpr));
    const height = Math.max(1, Math.round(output.clientHeight * dpr));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    // Empty pin content (no live page capture) reports 0×0 — never clip the lens.
    const contentW = Math.max(content.clientWidth, output.clientWidth, 1);
    contentMaxX = Math.min(
      1,
      Math.max(0.05, contentW / Math.max(output.clientWidth, 1)),
    );
    if (htmlInCanvas) {
      const cssWidth = Math.max(1, Math.round(source.clientWidth));
      const cssHeight = Math.max(1, Math.round(source.clientHeight));
      if (source.width !== cssWidth * dpr || source.height !== cssHeight * dpr) {
        source.width = cssWidth * dpr;
        source.height = cssHeight * dpr;
      }
      paintable.requestPaint();
    }
  }

  syncCanvasSize();

  function uploadContent() {
    if (!htmlInCanvas || !contentDirty) return;
    contentDirty = false;
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  let posX = output.clientWidth / 2;
  let posY = output.clientHeight / 2;
  let presence = config.pinned ? 1 : 0;
  let presenceTarget = config.pinned ? 1 : 0;
  let targetX = posX;
  let targetY = posY;
  let zoom = 1;
  let zoomTarget = 1;
  let hasPointer = false;
  /** When pinned+autoSize, extents come straight from the canvas box (CSS px). */
  let pinHalfW = 0;
  let pinHalfH = 0;

  function syncPin() {
    if (!config.pinned || !config.pinElement) return;
    const pin = config.pinElement;
    const pinStyle = getComputedStyle(pin);
    const outRect = rectCache ? rectCache.current : output.getBoundingClientRect();
    const r = pin.getBoundingClientRect();
    // Pin center in output-local CSS pixels (works for fullscreen or in-header output).
    targetX = r.left + r.width / 2 - outRect.left;
    targetY = r.top + r.height / 2 - outRect.top;
    presenceTarget = 1;
    zoomTarget = 1;
    // --nav-progress lives on the header; mirror it onto the fullscreen output.
    const navProgress = parseFloat(pinStyle.getPropertyValue("--nav-progress"));
    output.style.opacity = Number.isFinite(navProgress)
      ? String(Math.min(Math.max(navProgress, 0), 1))
      : "1";
    if (config.autoSize && r.width > 0 && r.height > 0) {
      config.shape = "rectangle";
      pinHalfW = r.width / 2;
      pinHalfH = r.height / 2;
      config.size = pinHalfH;
      config.aspect = pinHalfW / Math.max(pinHalfH, 0.001);
      const radius = parseFloat(pinStyle.borderRadius);
      const pillCorner = Math.min(pinHalfW, pinHalfH);
      config.corner =
        Number.isFinite(radius) && radius >= 1
          ? Math.min(radius, pillCorner)
          : pillCorner;
    } else {
      pinHalfW = 0;
      pinHalfH = 0;
    }
  }

  function halfExtents() {
    if (config.pinned && config.autoSize && pinHalfW > 0 && pinHalfH > 0) {
      return [pinHalfW, pinHalfH];
    }
    const size = Math.max(config.size, 8);
    if (config.shape === "rectangle") {
      return [size * Math.min(Math.max(config.aspect, 1), 16), size];
    }
    return [size, size];
  }

  function parseCssColor(input) {
    const raw = (input || "").trim() || "#fbfaf9";
    if (raw.startsWith("#")) {
      const hex = raw.slice(1);
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((c) => c + c)
              .join("")
          : hex.padEnd(6, "0").slice(0, 6);
      return [
        parseInt(full.slice(0, 2), 16) / 255,
        parseInt(full.slice(2, 4), 16) / 255,
        parseInt(full.slice(4, 6), 16) / 255,
      ];
    }
    const m = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) {
      return [
        Math.min(Number(m[1]) / 255, 1),
        Math.min(Number(m[2]) / 255, 1),
        Math.min(Number(m[3]) / 255, 1),
      ];
    }
    return [251 / 255, 250 / 255, 249 / 255];
  }

  function pageBgRgb() {
    return parseCssColor(
      getComputedStyle(document.documentElement).getPropertyValue("--bg"),
    );
  }

  function render() {
    uploadContent();
    const dpr = output.width / Math.max(output.clientWidth, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (presence <= 0.004) return;

    const [baseHalfW, baseHalfH] = halfExtents();
    const halfW = baseHalfW * presence;
    const halfH = baseHalfH * presence;
    const alpha = Math.min(presence * 5, 1);
    const cx = posX * dpr;
    const cy = output.height - posY * dpr;
    const margin = 4 * dpr;
    const sx = Math.max(0, Math.floor(cx - halfW * dpr - margin));
    const sy = Math.max(0, Math.floor(cy - halfH * dpr - margin));
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      sx,
      sy,
      Math.min(output.width - sx, Math.ceil(halfW * dpr * 2 + margin * 2)),
      Math.min(output.height - sy, Math.ceil(halfH * dpr * 2 + margin * 2)),
    );

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(uniforms.uContent, 0);
    gl.uniform2f(uniforms.uResolution, output.width, output.height);
    gl.uniform1f(uniforms.uMaxX, contentMaxX);
    gl.uniform1f(uniforms.uHasContent, htmlInCanvas || externalContent ? 1 : 0);
    gl.uniform2f(uniforms.uCenter, cx, cy);
    gl.uniform2f(uniforms.uHalf, halfW * dpr, halfH * dpr);
    const corner =
      config.shape === "circle"
        ? Math.min(halfW, halfH)
        : Math.min(Math.max(config.corner, 0), Math.min(halfW, halfH));
    gl.uniform1f(uniforms.uCorner, corner * dpr);
    gl.uniform1f(uniforms.uEdge, Math.min(Math.max(config.edge, 0), 0.98));
    gl.uniform1f(uniforms.uBevel, Math.max(config.bevel, 0.5));
    gl.uniform1f(uniforms.uIor, Math.min(Math.max(config.ior, 1.01), 2.5));
    gl.uniform1f(uniforms.uDepth, Math.max(config.depth, 0) * dpr);
    gl.uniform1f(uniforms.uAberration, Math.max(config.aberration, 0));
    gl.uniform1f(uniforms.uBlur, Math.max(config.blur, 0));
    gl.uniform1f(uniforms.uReflect, Math.max(config.reflection, 0));
    gl.uniform1f(uniforms.uShine, Math.max(config.shine, 0));
    gl.uniform1f(uniforms.uZoom, Math.max(zoom, 1));
    gl.uniform1f(uniforms.uAlpha, alpha);
    const [br, bg, bb] = pageBgRgb();
    gl.uniform3f(uniforms.uPageBg, br, bg, bb);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  }

  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  const rectCache = createRectCache(output);

  function frame(now) {
    if (destroyed) return;
    if (!visible) {
      running = false;
      return;
    }
    const delta = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    syncPin();

    const follow = config.pinned
      ? 1
      : Math.min(Math.max(config.follow, 0.02), 1);
    const kPos =
      reducedMotion || follow >= 1
        ? 1
        : 1 - Math.exp(-delta * (4 + follow * 26));
    const kZoom = reducedMotion ? 1 : 1 - Math.exp(-delta * 7);
    const kScale = reducedMotion ? 1 : 1 - Math.exp(-delta * 11);
    posX += (targetX - posX) * kPos;
    posY += (targetY - posY) * kPos;
    zoom += (zoomTarget - zoom) * kZoom;
    presence += (presenceTarget - presence) * kScale;

    render();

    // Pinned glass keeps running so nav size/position animations stay tracked.
    if (config.pinned) {
      raf = requestAnimationFrame(frame);
      return;
    }

    const settled =
      Math.abs(targetX - posX) < 0.1 &&
      Math.abs(targetY - posY) < 0.1 &&
      Math.abs(zoomTarget - zoom) < 0.002 &&
      Math.abs(presenceTarget - presence) < 0.002;
    if (settled && !contentDirty) {
      posX = targetX;
      posY = targetY;
      zoom = zoomTarget;
      presence = presenceTarget;
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  wake = start;
  if (config.pinned) syncPin();
  start();

  function onPointerMove(event) {
    if (config.pinned) return;
    const rect = rectCache.current;
    targetX = event.clientX - rect.left;
    targetY = event.clientY - rect.top;
    if (!hasPointer) {
      posX = targetX;
      posY = targetY;
      hasPointer = true;
    }
    presenceTarget = 1;
    const target = event.target;
    zoomTarget =
      config.zoom > 1 && target?.closest?.(config.targets)
        ? Math.min(Math.max(config.zoom, 1), 4)
        : 1;
    start();
  }

  function onPointerLeave() {
    if (config.pinned) return;
    presenceTarget = 0;
    zoomTarget = 1;
    hasPointer = false;
    start();
  }

  if (!config.pinned) {
    content.addEventListener("pointermove", onPointerMove, { passive: true });
    content.addEventListener("pointerleave", onPointerLeave, { passive: true });
  }

  function onScroll() {
    start();
  }
  content.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });

  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);

  const observer = new ResizeObserver(() => {
    syncCanvasSize();
    start();
  });
  observer.observe(output);
  observer.observe(content);
  if (config.pinElement) observer.observe(config.pinElement);

  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);

  return {
    setOptions(next) {
      if (
        !Object.entries(next).some(
          ([key, value]) => config[key] !== value,
        )
      )
        return;
      Object.assign(config, next);
      if (config.pinned) {
        presenceTarget = 1;
        syncPin();
      }
      start();
    },
    setContentImage(image) {
      if (!image || destroyed) return;
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      // Optional mips for blur bias — fall back to base level if generate fails.
      gl.generateMipmap(gl.TEXTURE_2D);
      if (gl.getError() === gl.NO_ERROR) {
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      externalContent = true;
      contentMaxX = 1;
      start();
    },
    getDebug() {
      const [hw, hh] = halfExtents();
      return {
        pinned: config.pinned,
        autoSize: config.autoSize,
        shape: config.shape,
        size: config.size,
        aspect: config.aspect,
        corner: config.corner,
        pinHalfW,
        pinHalfH,
        half: [hw, hh],
        pos: [posX, posY],
        target: [targetX, targetY],
        presence,
        presenceTarget,
        running,
        visible,
        externalContent,
        htmlInCanvas,
        client: [output.clientWidth, output.clientHeight],
      };
    },
    resize() {
      syncCanvasSize();
      start();
    },
    destroy() {
      destroyed = true;
      rectCache.destroy();
      cancelAnimationFrame(raf);
      content.removeEventListener("pointermove", onPointerMove);
      content.removeEventListener("pointerleave", onPointerLeave);
      content.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll, true);
      observer.disconnect();
      intersection.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      gl.deleteTexture(contentTexture);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(quad);
      if (htmlInCanvas) paintable.onpaint = null;
    },
  };
}


global.CanvasUIGlass = {
  createGlass,
  supportsHtmlInCanvas,
  htmlInCanvasDiagnostics,
  DEFAULTS,
};
})(typeof window !== 'undefined' ? window : globalThis);
