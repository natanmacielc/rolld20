// Vetores 3D, quatérnios e curvas de movimento. Puro: sem DOM, testado no Node.
// Convenção do motor: x para a direita, y para cima na tela, z saindo da mesa em direção à câmera.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function normalize(a) {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function centroid(points) {
  const sum = points.reduce((acc, p) => add(acc, p), [0, 0, 0]);
  return scale(sum, 1 / points.length);
}

// ---------- Quatérnios [w, x, y, z] ----------

export const IDENTITY = [1, 0, 0, 0];

export function qmul(a, b) {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function qnorm(q) {
  const l = Math.hypot(...q) || 1;
  return q.map((v) => v / l);
}

/** Giro de `angle` radianos em torno de `axis`. */
export function qaxis(axis, angle) {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

/** Aplica o quatérnio ao vetor. */
export function qrot(q, v) {
  const [w, x, y, z] = q;
  // v' = v + 2w(u × v) + 2u × (u × v), com u = (x, y, z)
  const u = [x, y, z];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, w)), cross(u, t));
}

/** Menor giro que leva a direção `from` até a direção `to`. */
export function qfromTo(from, to) {
  const a = normalize(from);
  const b = normalize(to);
  const d = dot(a, b);
  if (d > 1 - 1e-9) return [...IDENTITY];
  if (d < -1 + 1e-9) {
    // Opostos: qualquer eixo perpendicular serve.
    const axis = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]);
    return qaxis(axis, Math.PI);
  }
  return qnorm([1 + d, ...cross(a, b)]);
}

/** Interpolação esférica; t=0 devolve a, t=1 devolve b. */
export function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let end = b;
  if (d < 0) {
    d = -d;
    end = b.map((v) => -v);
  }
  if (t <= 0) return [...a];
  if (t >= 1) return [...end];
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (end[i] - v) * t));
  const theta = Math.acos(d);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return a.map((v, i) => v * wa + end[i] * wb);
}

/** Ângulo (radianos) entre duas orientações. */
export function qangle(a, b) {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}

// ---------- Curvas ----------

export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3;
export const easeInOutCubic = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Mola suave com um pequeno passo além do fim (a mesma da --ease-spring do CSS). */
export function spring(t) {
  const x = clamp(t);
  if (x === 1) return 1;
  return 1 - Math.exp(-6.5 * x) * Math.cos(7.2 * x);
}

/** Gerador pseudoaleatório determinístico (mulberry32): o mesmo seed dá a mesma bandeja. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
