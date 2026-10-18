// Poses e caminhos: como o dado assenta mostrando um número, como chega lá e onde cada dado fica
// na bandeja. Puro: sem DOM, testado no Node.
import { faceOf, solid } from './geometry.js';
import { IDENTITY, easeOutCubic, qaxis, qfromTo, qmul, qnorm, qrot, qslerp, seeded } from './math.js';

const TOWARD_CAMERA = [0, 0, 1];

/**
 * Inclinação do dado parado: a face do resultado continua sendo a mais virada para a câmera,
 * mas as vizinhas aparecem e o dado ganha volume (de frente ele pareceria um polígono chato).
 */
export const REST_TILT = qmul(qaxis([1, 0, 0], 0.25), qaxis([0, 1, 0], -0.17));
/** O d4 de frente seria um triângulo chato: inclina mais para uma face vizinha aparecer. */
const REST_TILT_D4 = qmul(qaxis([1, 0, 0], 0.55), qaxis([0, 1, 0], -0.3));

/** A face que mostra `value`: no d100, uma das dez faces do d10 (o número é pintado por cima). */
export function restingFace(sides, value) {
  const body = solid(sides);
  const label = sides === 100 ? ((value - 1) % 10) + 1 : value;
  return faceOf(body, label);
}

/**
 * Orientação em que a face de `value` olha para a câmera, de pé, com `twist` radianos de giro
 * em torno do eixo da câmera e a inclinação de repouso.
 */
export function restingPose(sides, value, twist = 0, tilt = sides === 4 ? REST_TILT_D4 : REST_TILT) {
  const body = solid(sides);
  const face = body.faces[restingFace(sides, value)];
  const toCamera = qfromTo(face.normal, TOWARD_CAMERA);
  const up = qrot(toCamera, face.up);
  const upright = qaxis(TOWARD_CAMERA, Math.PI / 2 - Math.atan2(up[1], up[0]) + twist);
  return qnorm(qmul(tilt, qmul(upright, toCamera)));
}

/**
 * Caminho de `from` até exatamente `to`: começa girando em torno de `axis` (radianos totais em
 * `spin`) e desacelera até parar. t em 0..1.
 */
export function landingPath(from, to, axis, spin) {
  const unwound = qmul(qaxis(axis, -spin), from);
  return (t) => {
    if (t >= 1) return [...to];
    if (t <= 0) return [...from];
    const e = easeOutCubic(t);
    return qnorm(qmul(qaxis(axis, spin * (1 - e)), qslerp(unwound, to, e)));
  };
}

/**
 * Altura sobre o veludo durante a queda (em raios do dado): cai de `drop`, quica duas vezes cada
 * vez mais baixo e para. Devolve também os instantes dos impactos (para faíscas e achatamento).
 */
export const IMPACTS = [0.38, 0.64, 0.8];
export function dropHeight(t, drop = 2.4) {
  if (t <= 0) return drop;
  if (t >= IMPACTS[2]) return 0;
  if (t < IMPACTS[0]) {
    const x = t / IMPACTS[0];
    return drop * (1 - x * x);
  }
  const hop = (a, b, peak) => {
    const x = (t - a) / (b - a);
    return 4 * peak * x * (1 - x);
  };
  if (t < IMPACTS[1]) return hop(IMPACTS[0], IMPACTS[1], drop * 0.2);
  return hop(IMPACTS[1], IMPACTS[2], drop * 0.05);
}

/**
 * Achatamento no impacto: 0 longe dos impactos, até ~1 no instante do toque. Some rápido para
 * não parecer borracha.
 */
export function squash(t) {
  const strengths = [1, 0.45, 0.15];
  let s = 0;
  IMPACTS.forEach((at, i) => {
    const d = Math.abs(t - at);
    if (d < 0.05) s = Math.max(s, strengths[i] * (1 - d / 0.05));
  });
  return s;
}

/**
 * Onde fica cada dado na bandeja (w × h em px): centros e raio. Grade que cabe o maior dado
 * possível, com um desvio estável (sempre o mesmo para a mesma quantidade) para parecer jogado.
 */
export function layout(count, w, h) {
  if (count <= 0) return { radius: 0, positions: [] };
  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cell = Math.min(w / cols, h / rows);
    if (!best || cell > best.cell) best = { cols, rows, cell };
  }
  const { cols, rows, cell } = best;
  // O raio deixa folga para o desvio, para a inclinação e para a perspectiva na queda.
  const radius = Math.min(cell * 0.36, Math.min(w, h) * 0.3);
  const jitter = count === 1 ? 0 : cell * 0.07;
  const random = seeded(count * 7919);
  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    const col = i - row * cols;
    const x = w / 2 + (col - (inRow - 1) / 2) * cell + (random() - 0.5) * 2 * jitter;
    const y = h / 2 + (row - (rows - 1) / 2) * cell + (random() - 0.5) * 2 * jitter;
    positions.push({ x, y, twist: (random() - 0.5) * 0.5 });
  }
  return { radius, positions };
}

export { IDENTITY };
