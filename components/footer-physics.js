(() => {
  const BLUE = '#3b95ff';
  const BALL_COUNT = 64;
  const CURSOR_RADIUS = 26;
  const HOVER_RADIUS = 120;
  const HOVER_ACCEL = 0.00135;
  const HOVER_MAX_SPEED = 9;
  const CURSOR_FOLLOW = 0.55;
  const SCROLL_COUPLE = 0.032;
  const SCROLL_DECAY = 0.86;
  const SCROLL_MAX_BOOST = 4.2;
  const CLICK_RADIUS = 260;
  const CLICK_IMPULSE = 22;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initFooterPhysics() {
    const stage = document.querySelector('[data-footer-physics]');
    const layer = stage?.querySelector('.footer-wordmark__physics');
    const wordmark = stage?.querySelector('.footer-wordmark');
    if (!stage || !layer || !wordmark || typeof Matter === 'undefined') {
      return false;
    }

    if (prefersReducedMotion()) {
      layer.hidden = true;
      return true;
    }

    layer.hidden = false;
    layer.replaceChildren();

    const {
      Engine,
      World,
      Bodies,
      Body,
      Events,
      Runner,
      Query,
    } = Matter;

    const engine = Engine.create({
      gravity: { x: 0, y: 1.1 },
      enableSleeping: true,
    });
    const world = engine.world;
    const runner = Runner.create();

    let cursorBall = null;
    let balls = [];
    let ballEls = [];
    let walls = [];
    let textBody = null;
    let pointerInside = false;
    let pointerX = 0;
    let pointerY = 0;
    let rafDraw = 0;
    let destroyed = false;
    let lastScrollY = 0;
    let scrollBoost = 0;
    let resizeTimer = 0;

    const getScrollY = () => window.__lenis?.scroll ?? window.scrollY ?? 0;

    function clearWorld() {
      World.clear(world, false);
      balls = [];
      ballEls = [];
      walls = [];
      textBody = null;
      cursorBall = null;
      layer.replaceChildren();
    }

    function measure() {
      const stageRect = stage.getBoundingClientRect();
      const textRect = wordmark.getBoundingClientRect();
      const w = Math.max(1, stageRect.width);
      const h = Math.max(1, stageRect.height);
      return {
        w,
        h,
        text: {
          x: textRect.left - stageRect.left + textRect.width / 2,
          y: textRect.top - stageRect.top + textRect.height / 2,
          w: Math.max(40, textRect.width),
          h: Math.max(20, textRect.height * 0.72),
        },
      };
    }

    function burstAt(originX, originY) {
      for (const ball of balls) {
        const dx = ball.position.x - originX;
        const dy = ball.position.y - originY;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > CLICK_RADIUS) continue;

        const t = 1 - dist / CLICK_RADIUS;
        const smooth = t * t * (3 - 2 * t);
        const strength = CLICK_IMPULSE * smooth;
        const nx = dx / dist;
        const ny = dy / dist;

        Body.setVelocity(ball, {
          x: ball.velocity.x + nx * strength,
          y: ball.velocity.y + ny * strength,
        });
        if (ball.isSleeping) Body.set(ball, { isSleeping: false });
      }
    }

    function spawnBalls({ w, h, text }) {
      const spawned = [];
      const els = [];
      const sizes = [10, 14, 18, 22, 26, 32, 40, 50, 58];
      const weights = [2, 3, 4, 4, 4, 3, 3, 2, 2];
      const weightSum = weights.reduce((a, b) => a + b, 0);

      function pickRadius() {
        let roll = Math.random() * weightSum;
        for (let i = 0; i < sizes.length; i += 1) {
          roll -= weights[i];
          if (roll <= 0) {
            return sizes[i] * (0.92 + Math.random() * 0.2);
          }
        }
        return sizes[sizes.length - 1];
      }

      const textLeft = text.x - text.w / 2;
      const textRight = text.x + text.w / 2;
      const textTop = text.y - text.h / 2;
      const leftRoom = Math.max(0, textLeft - 8);
      const rightRoom = Math.max(0, w - textRight - 8);
      const topRoom = Math.max(0, textTop - 8);

      const frag = document.createDocumentFragment();

      for (let i = 0; i < BALL_COUNT; i += 1) {
        const r = pickRadius();
        let x;
        let y;
        const lane = i % 3;

        if (lane === 0 && topRoom > r * 2) {
          x = textLeft + r + Math.random() * Math.max(1, text.w - r * 2);
          y = r + 6 + Math.random() * Math.max(1, topRoom - r * 2);
        } else if (lane === 1 && leftRoom > r * 2) {
          x = r + 4 + Math.random() * Math.max(1, leftRoom - r * 2);
          y = r + 6 + Math.random() * Math.max(1, h - r * 2 - 8);
        } else if (lane === 2 && rightRoom > r * 2) {
          x = textRight + r + 4 + Math.random() * Math.max(1, rightRoom - r * 2);
          y = r + 6 + Math.random() * Math.max(1, h - r * 2 - 8);
        } else if (topRoom > r * 2) {
          x = textLeft + r + Math.random() * Math.max(1, text.w - r * 2);
          y = r + 6 + Math.random() * Math.max(1, topRoom - r * 2);
        } else if (leftRoom > r * 2) {
          x = r + 4 + Math.random() * Math.max(1, leftRoom - r * 2);
          y = r + 6 + Math.random() * Math.max(1, h - r * 2 - 8);
        } else if (rightRoom > r * 2) {
          x = textRight + r + 4 + Math.random() * Math.max(1, rightRoom - r * 2);
          y = r + 6 + Math.random() * Math.max(1, h - r * 2 - 8);
        } else {
          x = r + 4 + Math.random() * Math.max(1, w - r * 2 - 8);
          y = r + 6 + Math.random() * Math.max(1, Math.min(h * 0.45, topRoom || h * 0.4));
        }

        x = Math.min(w - r - 4, Math.max(r + 4, x));
        y = Math.min(h - r - 4, Math.max(r + 4, y));

        const body = Bodies.circle(x, y, r, {
          restitution: 0.68,
          friction: 0.05,
          frictionAir: 0.01,
          density: 0.0016,
          label: 'ball',
        });

        const el = document.createElement('span');
        el.className = 'footer-ball';
        el.style.width = `${r * 2}px`;
        el.style.height = `${r * 2}px`;
        el.style.background = BLUE;
        el.style.transform = `translate(${x - r}px, ${y - r}px)`;
        frag.appendChild(el);

        spawned.push(body);
        els.push(el);
      }

      layer.appendChild(frag);
      ballEls = els;
      return spawned;
    }

    function build() {
      const { w, h, text } = measure();
      if (w < 40 || h < 40) {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          if (!destroyed) build();
        }, 100);
        return;
      }

      clearWorld();

      const thickness = 100;
      walls = [
        Bodies.rectangle(w / 2, h + thickness / 2 - 1, w + thickness * 2, thickness, {
          isStatic: true,
          friction: 0.4,
          label: 'ground',
        }),
        Bodies.rectangle(-thickness / 2, h / 2, thickness, h * 2, { isStatic: true, label: 'wall' }),
        Bodies.rectangle(w + thickness / 2, h / 2, thickness, h * 2, { isStatic: true, label: 'wall' }),
        Bodies.rectangle(w / 2, -thickness / 2, w + thickness * 2, thickness, { isStatic: true, label: 'ceiling' }),
      ];

      textBody = Bodies.rectangle(text.x, text.y, text.w, text.h, {
        isStatic: true,
        chamfer: { radius: Math.min(14, text.h / 2.5) },
        friction: 0.25,
        restitution: 0.3,
        label: 'wordmark',
      });

      cursorBall = Bodies.circle(w / 2, h / 2, CURSOR_RADIUS, {
        inertia: Infinity,
        friction: 0.05,
        frictionAir: 0,
        restitution: 0.35,
        density: 0.22,
        label: 'cursor',
        render: { visible: false },
      });

      balls = spawnBalls({ w, h, text });
      World.add(world, [...walls, textBody, cursorBall, ...balls]);
    }

    function draw() {
      if (destroyed) return;

      for (let i = 0; i < balls.length; i += 1) {
        const ball = balls[i];
        const el = ballEls[i];
        if (!el) continue;
        const r = ball.circleRadius;
        el.style.transform = `translate(${ball.position.x - r}px, ${ball.position.y - r}px)`;
      }

      rafDraw = requestAnimationFrame(draw);
    }

    Events.on(engine, 'beforeUpdate', () => {
      if (!cursorBall) return;

      const scrollY = getScrollY();
      const scrollDy = scrollY - lastScrollY;
      lastScrollY = scrollY;

      if (scrollDy < -0.5) {
        scrollBoost = scrollBoost * 0.5 + scrollDy * SCROLL_COUPLE;
      } else {
        scrollBoost *= 0.7;
      }

      if (scrollBoost < -0.03 && balls.length) {
        const lift = Math.max(scrollBoost, -SCROLL_MAX_BOOST);
        for (const ball of balls) {
          Body.setVelocity(ball, {
            x: ball.velocity.x,
            y: ball.velocity.y + lift,
          });
          if (ball.isSleeping) Body.set(ball, { isSleeping: false });
        }
      }
      scrollBoost *= SCROLL_DECAY;

      Body.applyForce(cursorBall, cursorBall.position, {
        x: 0,
        y: -cursorBall.mass * engine.gravity.y * engine.gravity.scale,
      });

      if (!pointerInside) {
        Body.setVelocity(cursorBall, { x: 0, y: 0 });
        return;
      }

      const pos = { x: pointerX, y: pointerY };
      if (Number.isNaN(pos.x) || Number.isNaN(pos.y)) return;

      const vx = (pos.x - cursorBall.position.x) * CURSOR_FOLLOW;
      const vy = (pos.y - cursorBall.position.y) * CURSOR_FOLLOW;
      Body.setVelocity(cursorBall, { x: vx, y: vy });
      Body.setPosition(cursorBall, {
        x: cursorBall.position.x + vx,
        y: cursorBall.position.y + vy,
      });
      if (cursorBall.isSleeping) Body.set(cursorBall, { isSleeping: false });

      const nearby = Query.region(world.bodies, {
        min: { x: pos.x - HOVER_RADIUS, y: pos.y - HOVER_RADIUS },
        max: { x: pos.x + HOVER_RADIUS, y: pos.y + HOVER_RADIUS },
      });

      for (const body of nearby) {
        if (body.isStatic || body.label !== 'ball') continue;

        const dx = body.position.x - pos.x;
        const dy = body.position.y - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist >= HOVER_RADIUS) continue;

        const t = 1 - dist / HOVER_RADIUS;
        const smooth = t * t * (3 - 2 * t);
        const nx = dx / dist;
        const ny = dy / dist;
        const accel = HOVER_ACCEL * smooth;

        Body.applyForce(body, body.position, {
          x: nx * accel * body.mass,
          y: ny * accel * body.mass,
        });

        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > HOVER_MAX_SPEED) {
          const scale = HOVER_MAX_SPEED / speed;
          Body.setVelocity(body, {
            x: body.velocity.x * scale,
            y: body.velocity.y * scale,
          });
        }

        if (body.isSleeping) Body.set(body, { isSleeping: false });
      }
    });

    function syncPointerFromEvent(event) {
      const rect = layer.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        pointerInside = false;
        return null;
      }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const inside =
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
      pointerInside = inside;
      if (inside) {
        pointerX = x;
        pointerY = y;
      }
      return inside ? { x, y } : null;
    }

    const onPointerMove = (event) => {
      const wasInside = pointerInside;
      syncPointerFromEvent(event);
      if (wasInside && !pointerInside && cursorBall) {
        Body.setVelocity(cursorBall, { x: 0, y: 0 });
      }
    };
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const local = syncPointerFromEvent(event);
      if (!local) return;
      burstAt(local.x, local.y);
    };
    const onPointerLeaveWindow = () => {
      pointerInside = false;
      if (cursorBall) Body.setVelocity(cursorBall, { x: 0, y: 0 });
    };

    // Layer is pointer-events: none; track pointer from document instead.
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('blur', onPointerLeaveWindow);

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!destroyed) build();
      }, 120);
    };

    requestAnimationFrame(() => {
      lastScrollY = getScrollY();
      build();
      Runner.run(runner, engine);
      draw();
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!destroyed) build();
      });
    }

    const ro = new ResizeObserver(onResize);
    ro.observe(stage);
    window.addEventListener('resize', onResize);

    window.__footerPhysics = {
      destroy() {
        destroyed = true;
        cancelAnimationFrame(rafDraw);
        Runner.stop(runner);
        ro.disconnect();
        window.removeEventListener('resize', onResize);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('blur', onPointerLeaveWindow);
        window.clearTimeout(resizeTimer);
        clearWorld();
        window.__footerPhysics = null;
      },
    };
  }

  let bootGeneration = 0;

  function bootFooterPhysics(attempt = 0) {
    if (attempt === 0) bootGeneration += 1;
    const generation = bootGeneration;

    window.__footerPhysics?.destroy?.();

    if (prefersReducedMotion()) {
      const layer = document.querySelector('.footer-wordmark__physics');
      if (layer) layer.hidden = true;
      return;
    }

    const retry = () => {
      if (generation !== bootGeneration) return;
      bootFooterPhysics(attempt + 1);
    };

    if (typeof Matter === 'undefined') {
      if (attempt < 50) window.setTimeout(retry, 50);
      return;
    }

    const stage = document.querySelector('[data-footer-physics]');
    const layer = stage?.querySelector('.footer-wordmark__physics');
    const wordmark = stage?.querySelector('.footer-wordmark');
    if (!stage || !layer || !wordmark) {
      if (attempt < 50) window.setTimeout(retry, 50);
      return;
    }

    initFooterPhysics();
  }

  window.bootFooterPhysics = bootFooterPhysics;

  function boot() {
    const start = () => bootFooterPhysics();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
    window.addEventListener('load', () => bootFooterPhysics(), { once: true });
  }

  boot();
})();
