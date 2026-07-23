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
    const canvas = stage?.querySelector('.footer-wordmark__physics');
    const wordmark = stage?.querySelector('.footer-wordmark');
    if (!stage || !canvas || !wordmark || typeof Matter === 'undefined') {
      return false;
    }

    if (prefersReducedMotion()) {
      canvas.hidden = true;
      return true;
    }

    const {
      Engine,
      World,
      Bodies,
      Body,
      Mouse,
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

    let mouse = null;
    let cursorBall = null;
    let balls = [];
    let walls = [];
    let textBody = null;
    let pointerInside = false;
    let rafDraw = 0;
    let destroyed = false;
    let lastScrollY = 0;
    let scrollBoost = 0;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    const getScrollY = () => window.__lenis?.scroll ?? window.scrollY ?? 0;

    function clearWorld() {
      World.clear(world, false);
      balls = [];
      walls = [];
      textBody = null;
      cursorBall = null;
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

    function syncCanvas(w, h) {
      const ratio = dpr();
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return ctx;
    }

    function pointerToLocal(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
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

        spawned.push(
          Bodies.circle(x, y, r, {
            restitution: 0.68,
            friction: 0.05,
            frictionAir: 0.01,
            density: 0.0016,
            label: 'ball',
          }),
        );
      }
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

      if (mouse) {
        Mouse.clearSourceEvents(mouse);
        mouse = null;
      }
      clearWorld();
      syncCanvas(w, h);

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

      mouse = Mouse.create(canvas);
      mouse.pixelRatio = dpr();
    }

    function draw() {
      if (destroyed) return;
      const { w, h } = measure();
      const ctx = canvas.getContext('2d');
      const ratio = dpr();
      if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
        syncCanvas(w, h);
      } else {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);

      for (const ball of balls) {
        ctx.beginPath();
        ctx.arc(ball.position.x, ball.position.y, ball.circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = BLUE;
        ctx.fill();
      }

      rafDraw = requestAnimationFrame(draw);
    }

    Events.on(engine, 'beforeUpdate', () => {
      if (!cursorBall || !mouse) return;

      // Subtle scroll couple — mostly a small lift on scroll-up
      const scrollY = getScrollY();
      const scrollDy = scrollY - lastScrollY;
      lastScrollY = scrollY;

      // scrollDy < 0 = scrolling up → negative Matter y = lift
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

      const pos = mouse.position;
      if (!pos || Number.isNaN(pos.x)) return;

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

    const onEnter = () => {
      pointerInside = true;
    };
    const onLeave = () => {
      pointerInside = false;
      if (cursorBall) Body.setVelocity(cursorBall, { x: 0, y: 0 });
    };
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const { x, y } = pointerToLocal(event);
      burstAt(x, y);
    };

    canvas.addEventListener('pointerenter', onEnter);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onPointerDown);

    let resizeTimer = 0;
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

    // Fonts can change wordmark bounds after first paint
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
        canvas.removeEventListener('pointerenter', onEnter);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.clearTimeout(resizeTimer);
        if (mouse) Mouse.clearSourceEvents(mouse);
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
      const canvas = document.querySelector('.footer-wordmark__physics');
      if (canvas) canvas.hidden = true;
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
    const canvas = stage?.querySelector('.footer-wordmark__physics');
    const wordmark = stage?.querySelector('.footer-wordmark');
    if (!stage || !canvas || !wordmark) {
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
