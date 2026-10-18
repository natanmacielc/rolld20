// Ícone estático de um dado em SVG, saído do mesmo motor (mesma luz e mesmo material da bandeja).
// Só atributos de apresentação (fill, transform): nada de style inline, o CSP continua igual.
import { solid } from './geometry.js';
import { cross, qaxis, qmul, qrot } from './math.js';
import { restingFace, restingPose } from './pose.js';
import { projectDie, silhouette } from './renderer.js';
import { css, material, mix, multiply, shade } from './shade.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Ícone em 3/4: mais inclinado que o dado na bandeja, para as faces do lado aparecerem. */
const ICON_TILT = qmul(qaxis([1, 0, 0], 0.42), qaxis([0, 1, 0], -0.32));
const INSET = 0.14;

function node(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const pathOf = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;

/**
 * Dado em SVG (viewBox 0 0 100 100). Com `label`, a face da frente mostra esse valor como num
 * dado de verdade; sem, a gema fica lisa.
 */
export function dieIcon(sides, label = null) {
  const value = label === null ? (sides === 100 ? 100 : sides) : Number(label);
  const body = solid(sides);
  const mat = material(sides);
  const q = restingPose(sides, Number.isFinite(value) ? value : sides, 0, ICON_TILT);
  const die = { body, q, x: 50, y: 52, r: 38, h: 0, scale: 1 };
  const { faces, project } = projectDie(die);
  const icon = node('svg', { viewBox: '0 0 100 100', class: 'die-icon', 'aria-hidden': 'true' });
  const outline = silhouette(faces.flatMap((f) => f.points));
  icon.append(node('path', { class: 'die-icon-rim', d: pathOf(outline), fill: css(multiply(mat.body, 0.3)) }));
  for (const f of faces) {
    const base = shade(f.n, mat);
    const c = f.center;
    const inner = f.points.map((p) => [p[0] + (c[0] - p[0]) * INSET, p[1] + (c[1] - p[1]) * INSET]);
    icon.append(node('path', { d: pathOf(f.points), fill: css(multiply(base, 0.45)) }));
    f.points.forEach((p, k) => {
      const n = (k + 1) % f.points.length;
      icon.append(node('path', {
        d: pathOf([p, f.points[n], inner[n], inner[k]]), fill: css(mix(shade(f.edgeNormals[k], mat), base, 0.35)),
      }));
    });
    icon.append(node('path', { d: pathOf(inner), fill: css(base) }));
  }
  if (label !== null) {
    const front = faces.find((f) => f.index === restingFace(sides, value));
    if (front) {
      const right = cross(front.face.up, front.face.normal);
      const unit = 0.25;
      const pr = project(front.face.center.map((v, i) => v + right[i] * unit));
      const pu = project(front.face.center.map((v, i) => v + front.face.up[i] * unit));
      const px = die.r * unit;
      const m = [(pr[0] - c0(front)) / px, (pr[1] - c1(front)) / px, (c0(front) - pu[0]) / px, (c1(front) - pu[1]) / px, c0(front), c1(front)];
      const text = String(label);
      const size = front.face.inradius * die.r * (text.length >= 3 ? 0.95 : text.length === 2 ? 1.18 : 1.42);
      const t = node('text', {
        class: 'die-icon-num', x: 0, y: (size * 0.04).toFixed(2), 'font-size': size.toFixed(2),
        transform: `matrix(${m.map((v) => v.toFixed(4)).join(' ')})`,
        fill: css(multiply(mat.ink, 0.6 + 0.55 * Math.max(0, qrot(q, front.face.normal)[2]))),
      });
      t.textContent = text;
      icon.append(t);
    }
  }
  return icon;
}

const c0 = (f) => f.center[0];
const c1 = (f) => f.center[1];
