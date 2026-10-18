// Bandeja de dados 3D num <canvas>: quantos dados, de que tipo, e as animações de espera,
// queda e troca. Mesma API da bandeja antiga de ui.js. Os números das faces só existem a partir
// de land(values) ou show(values): esperando o drand, as faces têm runas.
import { solid } from './geometry.js';
import { clamp, easeOutCubic, normalize, qaxis, qmul, qnorm, qslerp, spring } from './math.js';
import { dropHeight, IMPACTS, landingPath, layout, restingFace, restingPose, squash } from './pose.js';
import { drawDie, drawGlow, drawShadow, drawSparks, LABEL_FONT } from './renderer.js';
import { DEFAULT_LIGHT, material, mix } from './shade.js';

export const LAND_MS = 1150;
const SWAP_OUT_MS = 200;
const SWAP_IN_MS = 440;
const ENTER_MS = 640;
const LEAVE_MS = 240;
const MAX_SPARKS = 60;
const GOLD = [1, 0.72, 0.22];
const RED = [1, 0.18, 0.2];
const WHITE = [1, 1, 1];

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const clock = () => globalThis.performance?.now() ?? Date.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const maxOf = (sides) => (sides === 100 ? 100 : sides);
/** Aproxima `from` de `to` sem depender da taxa de quadros. */
const approach = (from, to, dt, rate) => from + (to - from) * (1 - Math.exp(-dt * rate));

/** Textos das faces com o resultado `value`: a face da frente mostra o valor (no d100, as outras dezenas). */
export function resultLabels(sides, value) {
  const front = restingFace(sides, value);
  return solid(sides).faces.map((f, i) => {
    if (i === front) return String(value);
    return sides === 100 ? String((f.label % 10) * 10).padStart(2, '0') : String(f.label);
  });
}

/** Parado: só a face da frente mostra o número de lados ("%" no d100); as outras têm runas. */
export function idleLabels(sides) {
  const front = restingFace(sides, maxOf(sides));
  return solid(sides).faces.map((_, i) => (i === front ? (sides === 100 ? '%' : String(sides)) : null));
}

const toneOf = (sides, value) => (value === maxOf(sides) ? 'max' : value === 1 ? 'min' : null);

class DieState {
  constructor(sides, random) {
    this.random = random;
    this.phase = random() * Math.PI * 2;
    this.x = 0;
    this.y = 0;
    this.r = 0;
    this.tx = 0;
    this.ty = 0;
    this.ox = 0;
    this.oy = 0;
    this.twist = 0;
    this.h = 0;
    this.scale = 1;
    this.glow = 0;
    this.glowTarget = 0;
    this.glowColor = WHITE;
    this.runes = true;
    this.become(sides);
    this.q = restingPose(sides, maxOf(sides), 0);
    this.toIdle();
  }

  become(sides) {
    this.sides = sides;
    this.body = solid(sides);
    this.mat = material(sides);
  }

  toIdle() {
    this.mode = 'idle';
    this.labels = idleLabels(this.sides);
    this.front = restingFace(this.sides, maxOf(this.sides));
    this.tone = null;
    this.value = null;
    this.glowTarget = 0;
  }

  idlePose() {
    return restingPose(this.sides, maxOf(this.sides), this.twist);
  }
}

export class Tray {
  constructor(container, sides = 20, count = 1) {
    this.container = container;
    this.sides = sides;
    this.dice = [];
    this.leaving = [];
    this.sparks = [];
    this.light = [...DEFAULT_LIGHT];
    this.lightGoal = null;
    this.tilt = [0, 0];
    this.tiltGoal = [0, 0];
    this.random = Math.random;
    this.visible = true;
    this.running = false;
    this.last = clock();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'tray-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.measure();
    this.observe();
    this.setCount(count, false);
  }

  // ---------- Medidas e observadores ----------

  measure() {
    const box = this.container.getBoundingClientRect?.();
    this.width = box?.width || this.container.clientWidth || 0;
    this.height = box?.height || this.container.clientHeight || 0;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  observe() {
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        this.measure();
        this.relayout(false);
        this.wake(true);
      }).observe(this.container);
    }
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(([entry]) => {
        this.visible = entry?.isIntersecting ?? true;
        this.wake(true);
      }).observe(this.container);
    }
    globalThis.document?.addEventListener?.('visibilitychange', () => this.wake(true));
    // Os números são desenhados em Cinzel: redesenha quando a fonte chega.
    globalThis.document?.fonts?.load?.(`700 32px ${LABEL_FONT}`).then(() => this.wake(true), () => {});
    this.container.addEventListener?.('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || reducedMotion()) return;
      const box = this.container.getBoundingClientRect();
      const px = clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1);
      const py = clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1);
      this.lightGoal = normalize([px * 0.9 - 0.15, -py * 0.9 + 0.25, 0.78]);
      this.tiltGoal = [px, py];
      this.wake();
    });
    this.container.addEventListener?.('pointerleave', () => {
      this.lightGoal = null;
      this.tiltGoal = [0, 0];
      this.wake();
    });
  }

  get live() {
    return this.visible && !globalThis.document?.hidden;
  }

  /** Liga o laço de quadros (ou só desenha um, se a bandeja estiver fora da tela). */
  wake(redraw = false) {
    if (!this.live) return;
    if (this.running) return;
    if (typeof requestAnimationFrame !== 'function') {
      if (redraw) this.step(clock());
      return;
    }
    this.running = true;
    this.last = clock();
    const frame = (now) => {
      const active = this.step(now);
      if (active && this.live) requestAnimationFrame(frame);
      else this.running = false;
    };
    requestAnimationFrame(frame);
  }

  relayout(animate = true) {
    const { radius, positions } = layout(this.dice.length, this.width, this.height);
    this.dice.forEach((die, i) => {
      const p = positions[i];
      die.tx = p.x;
      die.ty = p.y;
      die.twist = p.twist;
      die.rGoal = radius;
      if (!animate || !die.r) {
        die.x = p.x;
        die.y = p.y;
        die.r = radius;
      }
    });
    this.container.dataset && (this.container.dataset.size = this.dice.length === 1 ? 'xl'
      : this.dice.length <= 4 ? 'lg' : this.dice.length <= 9 ? 'md' : 'sm');
  }

  // ---------- API da bandeja ----------

  setCount(count, animate = true) {
    const motion = animate && !reducedMotion();
    const now = clock();
    const before = this.dice.length;
    while (this.dice.length < count) {
      const die = new DieState(this.sides, this.random);
      if (motion) {
        die.mode = 'enter';
        die.t0 = now + (this.dice.length - before) * 35;
        die.scale = 0;
      }
      this.dice.push(die);
    }
    while (this.dice.length > count) {
      const die = this.dice.pop();
      if (motion) {
        die.mode = 'leave';
        die.t0 = now;
        die.scaleFrom = die.scale;
        this.leaving.push(die);
      }
    }
    this.relayout(motion);
    this.wake(true);
  }

  setSides(sides) {
    this.sides = sides;
    const now = clock();
    for (const die of this.dice) {
      die.swapTo = sides;
      if (reducedMotion()) {
        die.become(sides);
        die.toIdle();
        die.q = die.idlePose();
        die.scale = 1;
        continue;
      }
      // Já encolhendo: só troca o destino. Crescendo: volta a encolher de onde está.
      if (die.mode !== 'swap-out') {
        die.mode = 'swap-out';
        die.t0 = now - (1 - clamp(die.scale)) * SWAP_OUT_MS;
      }
    }
    this.wake(true);
  }

  idle() {
    for (const die of this.dice) {
      if (die.mode === 'swap-out' || die.mode === 'swap-in' || die.mode === 'enter') continue;
      die.toIdle();
      die.pending = null;
    }
    this.sparks = [];
    this.wake(true);
  }

  tumble() {
    for (const die of this.dice) {
      if (die.mode === 'swap-out' || die.mode === 'swap-in') {
        die.become(die.swapTo ?? die.sides);
        die.scale = 1;
      }
      die.mode = 'tumble';
      die.labels = die.labels.map(() => null);
      die.front = -1;
      die.tone = null;
      die.value = null;
      die.pending = null;
      die.axis = normalize([die.random() - 0.5, die.random() - 0.5, die.random() - 0.5]);
      die.omega = 7 + die.random() * 3;
      die.glowColor = die.mat.glow;
      die.glowTarget = 0.4;
    }
    this.wake(true);
  }

  /** Pousa os dados um a um, com o valor real de cada um. Resolve quando o último para. */
  async land(values) {
    const now = clock();
    if (reducedMotion()) {
      this.show(values);
      return;
    }
    const step = Math.max(60, Math.min(160, 900 / values.length));
    this.dice.forEach((die, i) => {
      die.pending = { value: values[i], at: now + i * step };
    });
    this.wake(true);
    await sleep((values.length - 1) * step + LAND_MS);
    // Sem quadros (aba oculta, palco fora da tela) o estado também tem de chegar ao fim.
    this.step(clock(), !this.live);
  }

  /** Mostra os valores sem animação (página já resolvida, movimento reduzido). */
  show(values) {
    this.dice.forEach((die, i) => this.rest(die, values[i]));
    this.wake(true);
  }

  rest(die, value) {
    if (die.swapTo && die.swapTo !== die.sides) die.become(die.swapTo);
    die.mode = 'rest';
    die.pending = null;
    die.value = value;
    die.labels = resultLabels(die.sides, value);
    die.front = restingFace(die.sides, value);
    die.tone = toneOf(die.sides, value);
    die.q = restingPose(die.sides, value, die.twist);
    die.h = 0;
    die.scale = 1;
    die.ox = 0;
    die.oy = 0;
    die.glowColor = die.tone === 'max' ? GOLD : die.tone === 'min' ? RED : die.mat.glow;
    die.glowTarget = die.tone === 'max' ? 0.55 : die.tone === 'min' ? 0.3 : 0;
  }

  /** Brilho do resultado: crítico em ouro, falha crítica em vermelho, os outros uma centelha. */
  flare(kind) {
    if (reducedMotion()) return;
    for (const die of this.dice) {
      if (kind === 'crit') {
        this.spray(die.x, die.y, 16, [GOLD, [1, 0.93, 0.7], WHITE], die.r * 3.2);
        die.glowColor = GOLD;
        die.glow = 1;
      } else if (kind === 'fumble') {
        die.glowColor = RED;
        die.glow = 0.9;
      } else {
        this.spray(die.x, die.y, 5, [die.mat.glow, WHITE], die.r * 2);
      }
    }
    this.wake();
  }

  spray(x, y, count, colors, speed) {
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const angle = this.random() * Math.PI * 2;
      const v = speed * (0.4 + this.random() * 0.6);
      this.sparks.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        age: 0, ttl: 500 + this.random() * 450, size: 1.4 + this.random() * 2.2, color: colors[i % colors.length],
      });
    }
  }

  // ---------- Quadro ----------

  /** Avança a cena até `now` (ms) e desenha. Devolve se ainda há algo se mexendo. */
  step(now, skipDraw = false) {
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    const motion = !reducedMotion();
    let active = false;
    // Luz e inclinação seguem o ponteiro com atraso suave.
    const lightGoal = this.lightGoal ?? DEFAULT_LIGHT;
    this.light = normalize(this.light.map((v, i) => approach(v, lightGoal[i], dt, 6)));
    this.tilt = this.tilt.map((v, i) => approach(v, this.tiltGoal[i], dt, 6));
    if (Math.abs(this.light[0] - lightGoal[0]) + Math.abs(this.light[1] - lightGoal[1]) > 0.002) active = true;

    for (const die of this.dice) active = this.update(die, now, dt, motion) || active;
    this.leaving = this.leaving.filter((die) => {
      const p = clamp((now - die.t0) / LEAVE_MS);
      die.scale = (die.scaleFrom ?? 1) * (1 - easeOutCubic(p));
      return p < 1;
    });
    if (this.leaving.length) active = true;

    this.sparks = this.sparks.filter((s) => {
      s.age += dt * 1000;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-dt * 3.2);
      s.vy *= Math.exp(-dt * 3.2);
      return s.age < s.ttl;
    });
    if (this.sparks.length) active = true;
    if (!skipDraw) this.draw();
    return active;
  }

  update(die, now, dt, motion) {
    die.r = approach(die.r, die.rGoal ?? die.r, dt, 10);
    die.x = approach(die.x, die.tx + die.ox, dt, 10);
    die.y = approach(die.y, die.ty + die.oy, dt, 10);
    die.glow = approach(die.glow, die.glowTarget, dt, 4);
    let active = Math.abs(die.x - die.tx - die.ox) > 0.3 || Math.abs(die.y - die.ty - die.oy) > 0.3
      || Math.abs(die.glow - die.glowTarget) > 0.01 || Math.abs(die.r - (die.rGoal ?? die.r)) > 0.3;
    const seconds = now / 1000;

    if (die.pending && now >= die.pending.at && (die.mode === 'tumble' || die.mode === 'idle')) {
      this.startLanding(die, now);
    }

    switch (die.mode) {
      case 'idle': {
        let goal = die.idlePose();
        let height = 0.08;
        if (motion) {
          const breathe = qmul(qaxis([1, 0, 0], 0.05 * Math.sin(seconds * 0.9 + die.phase)),
            qaxis([0, 1, 0], 0.06 * Math.sin(seconds * 0.7 + die.phase)));
          const lean = qmul(qaxis([0, 1, 0], this.tilt[0] * 0.22), qaxis([1, 0, 0], this.tilt[1] * 0.22));
          goal = qmul(qmul(lean, breathe), goal);
          height = 0.1 + 0.06 * Math.sin(seconds * 1.3 + die.phase);
          active = true;
        }
        die.q = qslerp(die.q, goal, 1 - Math.exp(-dt * 8));
        die.h = approach(die.h, height, dt, 6);
        die.scale = approach(die.scale, 1, dt, 10);
        die.ox = 0;
        die.oy = 0;
        break;
      }
      case 'tumble': {
        if (motion) {
          die.axis = normalize(die.axis.map((v) => v + (die.random() - 0.5) * dt * 2));
          die.q = qnorm(qmul(qaxis(die.axis, die.omega * dt), die.q));
          die.h = approach(die.h, 0.9 + 0.15 * Math.sin(seconds * 2.1 + die.phase), dt, 5);
          die.ox = Math.sin(seconds * 1.7 + die.phase) * die.r * 0.08;
          die.oy = Math.cos(seconds * 1.3 + die.phase) * die.r * 0.06;
          die.glowTarget = 0.3 + 0.15 * Math.sin(seconds * 5 + die.phase);
          active = true;
        }
        break;
      }
      case 'landing': {
        const p = clamp((now - die.t0) / LAND_MS);
        die.q = die.path(p);
        die.h = dropHeight(p, die.drop);
        die.scale = 1 + 0.06 * squash(p);
        const settle = 1 - easeOutCubic(p);
        die.ox = die.ox0 * settle;
        die.oy = die.oy0 * settle;
        while (die.impacts < IMPACTS.length && p >= IMPACTS[die.impacts]) {
          const strength = [6, 3, 0][die.impacts];
          this.spray(die.x, die.y + die.r * 0.4, strength, [mix(die.mat.glow, WHITE, 0.5), WHITE], die.r * 1.6);
          die.impacts += 1;
        }
        if (p >= 1) this.rest(die, die.value);
        active = true;
        break;
      }
      case 'swap-out': {
        const p = clamp((now - die.t0) / SWAP_OUT_MS);
        die.scale = 1 - p * p;
        die.q = qnorm(qmul(qaxis([0, 0, 1], dt * 9), die.q));
        if (p >= 1) {
          die.become(die.swapTo);
          die.toIdle();
          die.mode = 'swap-in';
          die.t0 = now;
          die.scale = 0;
        }
        active = true;
        break;
      }
      case 'swap-in': {
        const p = clamp((now - die.t0) / SWAP_IN_MS);
        die.scale = spring(p);
        die.q = qmul(qaxis([0, 0, 1], -(1 - easeOutCubic(p)) * 1.6), die.idlePose());
        if (p >= 1) {
          die.scale = 1;
          die.swapTo = null;
          die.toIdle();
        }
        active = true;
        break;
      }
      case 'enter': {
        const p = clamp((now - die.t0) / ENTER_MS);
        die.h = dropHeight(p, 2.6);
        die.scale = Math.min(1, p * 4);
        die.q = qmul(qaxis([0.3, 1, 0], (1 - easeOutCubic(p)) * 2.4), die.idlePose());
        if (p >= 1) die.toIdle();
        active = true;
        break;
      }
      default:
        break;
    }
    return active;
  }

  startLanding(die, now) {
    const { value, at } = die.pending;
    die.pending = null;
    if (die.swapTo && die.swapTo !== die.sides) die.become(die.swapTo);
    die.swapTo = null;
    die.scale = 1;
    die.value = value;
    // A partir daqui o resultado existe: as faces ganham os números, com o valor na face da frente.
    die.labels = resultLabels(die.sides, value);
    die.front = restingFace(die.sides, value);
    die.tone = null;
    const to = restingPose(die.sides, value, die.twist);
    const axis = die.axis ?? [1, 0.4, 0.2];
    const omega = die.mode === 'tumble' ? die.omega : 6;
    die.path = landingPath(die.q, to, axis, (omega * LAND_MS) / 1000 / 3);
    die.drop = Math.max(1.2, die.h + 1.1);
    die.ox0 = die.ox;
    die.oy0 = die.oy;
    die.impacts = 0;
    die.mode = 'landing';
    die.t0 = at;
  }

  draw() {
    const { ctx, dpr } = this;
    if (!ctx || !this.width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const all = [...this.leaving, ...this.dice].filter((die) => die.scale > 0.01);
    for (const die of all) drawShadow(ctx, die, this.light);
    for (const die of [...all].sort((a, b) => a.h - b.h)) {
      drawGlow(ctx, die, die.glowColor, die.glow);
      drawDie(ctx, die, { light: this.light, dpr });
    }
    drawSparks(ctx, this.sparks, dpr);
  }
}
