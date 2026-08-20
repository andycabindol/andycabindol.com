/**
 * SelectionBloom — procedural blue ink-dots grow from text selection on About.
 * Timed grow → hold → wilt while selected; clears immediately on deselect.
 * Expanding a drag only spawns stems for newly covered slots — existing ones never restart.
 * Multiline: plants only on the top line (up) and bottom line (down).
 * Text-node selections only — ignores element/div selections.
 */
(function () {
  const BLUE = '#3b95ff';
  const BLUE_DEEP = '#1f6fd6';
  const BLUE_SOFT = '#7bb6ff';
  const BLUE_INK = '#1a4f9c';
  const STEM = '#2a5f9e';
  const GROW_MS = 480;
  const HOLD_MS = 720;
  const WILT_MS = 520;
  const STEM_MIN = 16;
  const STEM_MAX = 26;
  const MAX_PLANTS = 72;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function easeOutBack(t) {
    const c1 = 1.55;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function getScrollY() {
    return window.lenis?.scroll ?? window.scrollY ?? 0;
  }

  function getScrollX() {
    return window.lenis?.scrollX ?? window.scrollX ?? 0;
  }

  /** Only real text drags — not element/div selections. */
  function isTextSelection(sel) {
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    const anchor = sel.anchorNode;
    const focus = sel.focusNode;
    if (!anchor || !focus) return false;
    if (anchor.nodeType !== Node.TEXT_NODE || focus.nodeType !== Node.TEXT_NODE) {
      return false;
    }
    const text = sel.toString();
    return Boolean(text && text.trim());
  }

  function createPlant(key, x, y, seed, side) {
    const rand = mulberry32(seed);
    const family = Math.floor(rand() * 3);
    return {
      key,
      x,
      y,
      scrollX: getScrollX(),
      scrollY: getScrollY(),
      side,
      family,
      stemLen: lerp(STEM_MIN, STEM_MAX, rand()),
      bend: lerp(0.12, 0.42, rand()) * (rand() > 0.5 ? 1 : -1),
      lean: lerp(-0.28, 0.28, rand()),
      leafSide: rand() > 0.5 ? 1 : -1,
      leafAt: lerp(0.35, 0.7, rand()),
      leafSwing: lerp(6, 11, rand()),
      radius: lerp(2.8, 5.4, rand()),
      accent: rand(),
      phase: 'grow',
      phaseStart: performance.now(),
    };
  }

  function plantProgress(plant, now) {
    const age = now - plant.phaseStart;
    if (age < 0) return 0; // spawn delay — not started yet

    if (plant.phase === 'grow') {
      const raw = clamp(age / GROW_MS, 0, 1);
      if (raw >= 1) {
        plant.phase = 'hold';
        plant.phaseStart = now;
        return 1;
      }
      return easeOutBack(raw);
    }

    if (plant.phase === 'hold') {
      if (age >= HOLD_MS) {
        plant.phase = 'wilt';
        plant.phaseStart = now;
      }
      return 1;
    }

    const raw = clamp(age / WILT_MS, 0, 1);
    return 1 - easeInCubic(raw);
  }

  function drawPlant(ctx, plant, now) {
    const t = plantProgress(plant, now);
    if (t <= 0.001) return false;

    const x0 = plant.x - (getScrollX() - plant.scrollX);
    const y0 = plant.y - (getScrollY() - plant.scrollY);
    const len = plant.stemLen * clamp(t, 0, 1.15);
    const x1 = x0 + plant.lean * len;
    const y1 = y0 + plant.side * len;
    const cx = x0 + plant.bend * len * 0.85;
    const cy = y0 + plant.side * len * 0.45;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.strokeStyle = STEM;
    ctx.globalAlpha = 0.85 * clamp(t, 0, 1);
    ctx.lineWidth = lerp(1.1, 1.55, plant.accent);
    ctx.stroke();

    if (t > 0.28) {
      const leafT = clamp((t - 0.28) / 0.45, 0, 1);
      const lx = lerp(x0, x1, plant.leafAt);
      const ly = lerp(y0, y1, plant.leafAt);
      const angle = Math.atan2(y1 - y0, x1 - x0) + plant.leafSide * 0.9;
      const leafW = plant.leafSwing * leafT;
      const leafH = leafW * 0.45;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(leafW * 0.55, 0, leafW, leafH, 0, 0, Math.PI * 2);
      ctx.fillStyle = BLUE_SOFT;
      ctx.globalAlpha = 0.75 * leafT;
      ctx.fill();
      ctx.strokeStyle = BLUE_INK;
      ctx.globalAlpha = 0.55 * leafT;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    }

    const headT = clamp((t - 0.38) / 0.55, 0, 1);
    if (headT > 0) {
      const pop = easeOutBack(headT);
      const r = plant.radius * pop;
      drawDot(ctx, x1, y1, r, plant.accent > 0.55 ? BLUE_DEEP : BLUE, 0.95);

      if (plant.family === 1) {
        drawDot(
          ctx,
          x1 + plant.leafSide * r * 1.35,
          y1 - plant.side * r * 0.35,
          r * 0.62,
          BLUE_SOFT,
          0.9 * headT,
        );
      } else if (plant.family === 2) {
        drawDot(ctx, x1 - r * 1.1, y1 + plant.side * r * 0.2, r * 0.45, BLUE_SOFT, 0.85 * headT);
        drawDot(ctx, x1 + r * 0.95, y1 - plant.side * r * 0.15, r * 0.38, BLUE_DEEP, 0.8 * headT);
      }

      ctx.beginPath();
      ctx.arc(x1 - r * 0.28, y1 - plant.side * r * 0.28, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.55 * headT;
      ctx.fill();
    }

    ctx.restore();
    return true;
  }

  function drawDot(ctx, x, y, r, fill, alpha) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.strokeStyle = BLUE_INK;
    ctx.globalAlpha = alpha * 0.7;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** Group client rects into visual lines by similar top. */
  function groupLines(rects) {
    const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const rect of sorted) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - rect.top) < 5) {
        last.rects.push(rect);
        last.bottom = Math.max(last.bottom, rect.bottom);
        continue;
      }
      lines.push({
        top: rect.top,
        bottom: rect.bottom,
        rects: [rect],
      });
    }
    return lines;
  }

  function slotsForLine(line, side) {
    const slots = [];
    const spacing = 18;

    for (const rect of line.rects) {
      const start = Math.floor(rect.left / spacing) * spacing + spacing * 0.5;
      const end = rect.right;
      const inset = Math.min(6, (rect.bottom - rect.top) * 0.35);

      for (let x = start; x < end; x += spacing) {
        if (x < rect.left || x > rect.right) continue;

        const row = Math.round((line.top + getScrollY()) / 8);
        const col = Math.round(x / spacing);
        const key = `r${row}:x${col}:s${side}`;
        slots.push({
          key,
          seed: hashString(key),
          side,
          col,
          x,
          y: side < 0 ? rect.top + inset : rect.bottom - inset,
        });
      }
    }

    return slots;
  }

  function collectAnchors(range) {
    const rects = [...range.getClientRects()].filter(
      (rect) => rect.width >= 2 && rect.height >= 2,
    );
    if (!rects.length) return [];

    const lines = groupLines(rects);
    if (!lines.length) return [];

    const topLine = lines[0];
    const bottomLine = lines[lines.length - 1];
    const topSlots = slotsForLine(topLine, -1);
    const bottomSlots = slotsForLine(bottomLine, 1);

    // Merge by column so we can pick top / bottom / both per x-slot
    const byCol = new Map();
    for (const slot of topSlots) {
      if (!byCol.has(slot.col)) byCol.set(slot.col, {});
      byCol.get(slot.col).top = slot;
    }
    for (const slot of bottomSlots) {
      if (!byCol.has(slot.col)) byCol.set(slot.col, {});
      byCol.get(slot.col).bottom = slot;
    }

    const anchors = [];
    const cols = [...byCol.keys()].sort((a, b) => a - b);

    for (const col of cols) {
      const pair = byCol.get(col);
      const rand = mulberry32(hashString(`bloom-col:${col}:${Math.round(topLine.top + getScrollY())}`));

      // Occasionally leave a gap so density feels irregular
      if (rand() < 0.18) continue;

      const roll = rand();
      const picks = [];
      if (pair.top && pair.bottom) {
        if (roll < 0.36) picks.push(pair.top);
        else if (roll < 0.72) picks.push(pair.bottom);
        else {
          // Both — top first, then bottom a beat later
          picks.push(pair.top);
          picks.push(pair.bottom);
        }
      } else if (pair.top) {
        if (rand() > 0.22) picks.push(pair.top);
      } else if (pair.bottom) {
        if (rand() > 0.22) picks.push(pair.bottom);
      }

      for (const slot of picks) {
        anchors.push(slot);
      }
    }

    return anchors.slice(0, MAX_PLANTS);
  }

  function bindSelectionBloom(root, { reduceMotion = false } = {}) {
    if (!root) return () => {};

    const canvas = document.createElement('canvas');
    canvas.className = 'selection-bloom';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const plants = new Map();
    const spawnedKeys = new Set();
    let cutouts = [];
    let cutoutScrollX = 0;
    let cutoutScrollY = 0;
    let raf = 0;
    let dpr = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function ensureLoop() {
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function clearAll() {
      plants.clear();
      spawnedKeys.clear();
      cutouts = [];
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function punchSelectionHoles() {
      if (!cutouts.length) return;
      const dx = getScrollX() - cutoutScrollX;
      const dy = getScrollY() - cutoutScrollY;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      for (const rect of cutouts) {
        ctx.fillRect(
          rect.left - dx - 1,
          rect.top - dy - 1,
          rect.width + 2,
          rect.height + 2,
        );
      }
      ctx.restore();
    }

    function tick(now) {
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let alive = 0;
      for (const [key, plant] of plants) {
        const waiting = now < plant.phaseStart;
        const still = drawPlant(ctx, plant, now);
        if (!still && plant.phase === 'wilt') {
          plants.delete(key);
          continue;
        }
        if (still || waiting) alive += 1;
      }

      punchSelectionHoles();

      if (alive > 0) ensureLoop();
      else cutouts = [];
    }

    function syncFromSelection() {
      const sel = window.getSelection();

      if (!isTextSelection(sel)) {
        clearAll();
        return;
      }

      const anchorEl = sel.anchorNode.parentElement;
      if (!anchorEl || !root.contains(anchorEl) || anchorEl.closest('[data-award-case]')) {
        clearAll();
        return;
      }

      let range;
      try {
        range = sel.getRangeAt(0);
      } catch (_) {
        clearAll();
        return;
      }

      cutouts = [...range.getClientRects()]
        .filter((rect) => rect.width >= 2 && rect.height >= 2)
        .map((rect) => ({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }));
      cutoutScrollX = getScrollX();
      cutoutScrollY = getScrollY();

      const anchors = collectAnchors(range);
      const now = performance.now();

      // Only newly covered slots — cascade in left→right order within this batch
      // so a full select waves sequentially, while a drag still plants as you go.
      const fresh = anchors
        .filter((anchor) => !spawnedKeys.has(anchor.key) && !plants.has(anchor.key))
        .sort((a, b) => a.col - b.col || a.side - b.side);

      fresh.forEach((anchor, index) => {
        spawnedKeys.add(anchor.key);

        const plant = createPlant(
          anchor.key,
          anchor.x,
          anchor.y,
          anchor.seed,
          anchor.side,
        );

        if (reduceMotion) {
          plant.phase = 'hold';
          plant.phaseStart = now;
        } else {
          const sideLag = anchor.side > 0 ? 40 : 0;
          plant.phaseStart = now + index * 28 + sideLag;
        }

        plants.set(anchor.key, plant);
      });

      if (fresh.length || plants.size) ensureLoop();
    }

    let selectionRaf = 0;
    function onSelectionChange() {
      if (selectionRaf) return;
      selectionRaf = requestAnimationFrame(() => {
        selectionRaf = 0;
        syncFromSelection();
      });
    }

    function onScrollOrResize() {
      resize();
      if (plants.size) ensureLoop();
    }

    resize();
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return function cleanup() {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (selectionRaf) cancelAnimationFrame(selectionRaf);
      clearAll();
      canvas.remove();
    };
  }

  window.bindSelectionBloom = bindSelectionBloom;
})();
