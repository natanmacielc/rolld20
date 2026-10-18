// Desenho de uma cena de dados num contexto 2D: sombra no veludo, faces sombreadas, bisel que pega
// a luz, números gravados, runas e faíscas. Só recebe o contexto: sem DOM próprio, testável no Node.
import { add, cross, dot, normalize, qrot, scale } from './math.js';
import { DEFAULT_LIGHT, css, material, mix, multiply, shade, specular } from './shade.js';

/** Distância da câmera em raios do dado: perspectiva leve, o dado no alto parece maior. */
const CAMERA = 9;
/** Abaixo deste raio em px, o dado é desenhado sem bisel nem gradiente (ícones e 20 dados). */
const DETAIL_RADIUS = 30;
const INSET = 0.13;
export const LABEL_FONT = 'Cinzel';

/**
 * Runas das faces enquanto o resultado não existe: só traços, nunca dígitos nem letras que
 * pareçam número. Coordenadas em -1..1, y para baixo.
 */
export const RUNES = [
  [[[0, -1], [0, 1]], [[0, -0.55], [0.6, -1]], [[0, -0.05], [0.6, -0.5]]],
  [[[-0.5, -1], [-0.5, 1]], [[-0.5, -1], [0.5, -0.4]], [[0.5, -0.4], [-0.5, 0.2]], [[-0.5, 0.2], [0.5, 1]]],
  [[[0, -1], [0, 1]], [[-0.65, -0.35], [0, 0.25], [0.65, -0.35]]],
  [[[-0.6, -1], [-0.6, 1]], [[0.6, -1], [0.6, 1]], [[-0.6, -0.6], [0.6, 0.6]], [[0.6, -0.6], [-0.6, 0.6]]],
  [[[0, -1], [0.6, -0.3], [0, 0.4], [-0.6, -0.3], [0, -1]], [[0, 0.4], [-0.55, 1]], [[0, 0.4], [0.55, 1]]],
  [[[-0.55, -1], [0.55, 0], [-0.55, 1]]],
  [[[0, -1], [0, 1]], [[-0.55, -0.6], [0.55, 0.6]]],
  [[[-0.6, 1], [-0.6, -1], [0, -0.3], [0.6, -1], [0.6, 1]]],
];

/** Posição do vértice local `v` do dado na tela. */
function projector(die) {
  const { x, y, r, q } = die;
  const size = die.scale ?? 1;
  const height = die.h ?? 0;
  return (v) => {
    const p = scale(qrot(q, v), size);
    const k = CAMERA / (CAMERA - (height + p[2]));
    return [x + p[0] * r * k, y - p[1] * r * k, p[2]];
  };
}

/** Faces visíveis do dado já projetadas: contorno na tela, normal no mundo e o resto do rótulo. */
export function projectDie(die) {
  const project = projector(die);
  const screen = die.body.vertices.map(project);
  const faces = [];
  die.body.faces.forEach((face, index) => {
    const n = qrot(die.q, face.normal);
    if (n[2] <= 0.015) return;
    faces.push({
      index, face, n,
      points: face.ids.map((i) => screen[i]),
      center: project(face.center),
      edgeNormals: face.edgeNormals.map((e) => qrot(die.q, e)),
    });
  });
  return { faces, project };
}

const toCss = (rgb, a) => css(rgb, a);
const light2 = (light) => normalize([light[0], -light[1], 0]);

function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

/** Sombra de contato no veludo: aperta e escurece quando o dado encosta. */
export function drawShadow(ctx, die, light = DEFAULT_LIGHT) {
  const h = die.h ?? 0;
  const s = die.scale ?? 1;
  if (s <= 0.01) return;
  const dir = light2(light);
  const reach = die.r * (0.12 + h * 0.5);
  const cx = die.x - dir[0] * reach;
  const cy = die.y - dir[1] * reach;
  const radius = die.r * s * (1.05 + h * 0.22);
  const alpha = 0.62 / (1 + h * 0.9);
  const g = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
  g.addColorStop(0, `rgb(2 1 8 / ${alpha.toFixed(3)})`);
  g.addColorStop(0.55, `rgb(2 1 8 / ${(alpha * 0.45).toFixed(3)})`);
  g.addColorStop(1, 'rgb(2 1 8 / 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Halo atrás do dado (crítico em ouro, falha em vermelho, a gema em espera). */
export function drawGlow(ctx, die, rgb, strength) {
  if (strength <= 0.01) return;
  const radius = die.r * (die.scale ?? 1) * 2.1;
  const g = ctx.createRadialGradient(die.x, die.y, die.r * 0.2, die.x, die.y, radius);
  g.addColorStop(0, toCss(rgb, 0.5 * strength));
  g.addColorStop(1, toCss(rgb, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(die.x, die.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Base do rótulo na face: matriz que leva o plano da face para a tela (1 unidade ≈ 1 px de frente). */
function faceFrame(die, f, project) {
  const right = cross(f.face.up, f.face.normal);
  const unit = 0.25;
  const c = f.center;
  const pr = project(add(f.face.center, scale(right, unit)));
  const pu = project(add(f.face.center, scale(f.face.up, unit)));
  const px = die.r * (die.scale ?? 1) * unit;
  return {
    a: (pr[0] - c[0]) / px, b: (pr[1] - c[1]) / px,
    c: (c[0] - pu[0]) / px, d: (c[1] - pu[1]) / px,
    e: c[0], f: c[1],
    right: qrot(die.q, right), up: qrot(die.q, f.face.up),
  };
}

const INK = { max: [1, 0.78, 0.25], min: [1, 0.33, 0.33] };

function drawLabel(ctx, die, f, frame, text, light, dpr) {
  const mat = die.mat;
  const size = f.face.inradius * die.r * (die.scale ?? 1) * (text.length >= 3 ? 0.95 : text.length === 2 ? 1.18 : 1.42);
  const diffuse = Math.max(0, dot(f.n, light));
  const tone = die.tone && f.index === die.front ? INK[die.tone] : mat.ink;
  const fade = Math.min(1, (f.n[2] - 0.2) * 3);
  // Direção da luz no plano da face: a parede do lado da luz faz sombra dentro do número gravado.
  const lx = dot(light, frame.right);
  const ly = -dot(light, frame.up);
  const off = Math.max(0.6, size * 0.045);
  ctx.setTransform(dpr * frame.a, dpr * frame.b, dpr * frame.c, dpr * frame.d, dpr * frame.e, dpr * frame.f);
  ctx.font = `700 ${size.toFixed(1)}px ${LABEL_FONT}, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgb(4 2 12 / .62)';
  ctx.fillText(text, lx * off, ly * off + size * 0.04);
  ctx.fillStyle = 'rgb(255 255 255 / .28)';
  ctx.fillText(text, -lx * off, -ly * off + size * 0.04);
  ctx.fillStyle = toCss(multiply(tone, 0.6 + 0.55 * diffuse));
  ctx.fillText(text, 0, size * 0.04);
  if ((text === '6' || text === '9') && die.body.faces.length >= 8) {
    ctx.fillRect(-size * 0.22, size * 0.42, size * 0.44, size * 0.07);
  }
  ctx.globalAlpha = 1;
}

function drawRune(ctx, die, f, frame, rune, light, dpr) {
  const size = f.face.inradius * die.r * (die.scale ?? 1) * 0.42;
  const diffuse = Math.max(0, dot(f.n, light));
  ctx.setTransform(dpr * frame.a, dpr * frame.b, dpr * frame.c, dpr * frame.d, dpr * frame.e, dpr * frame.f);
  ctx.globalAlpha = Math.min(1, (f.n[2] - 0.15) * 2.5) * 0.8;
  ctx.strokeStyle = toCss(mix(die.mat.glow, die.mat.ink, 0.45 + 0.3 * diffuse));
  ctx.lineWidth = Math.max(0.8, size * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const stroke of RUNES[rune % RUNES.length]) {
    stroke.forEach(([px, py], i) => (i ? ctx.lineTo(px * size, py * size) : ctx.moveTo(px * size, py * size)));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Desenha um dado. die: { body, mat, q, x, y, r, h, scale, labels, runes, front, tone }.
 * labels[i] é o texto da face i (null: runa). O contexto volta à transformação do `dpr`.
 */
export function drawDie(ctx, subject, { light = DEFAULT_LIGHT, dpr = 1 } = {}) {
  if ((subject.scale ?? 1) <= 0.01) return;
  const mat = subject.mat ?? material(subject.body.sides);
  const die = { ...subject, mat };
  const detailed = die.r * (die.scale ?? 1) >= DETAIL_RADIUS;
  const { faces, project } = projectDie(die);
  const ls = light2(light);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineJoin = 'round';
  for (const f of faces) {
    const base = shade(f.n, mat, light);
    const c = f.center;
    if (!detailed) {
      polygon(ctx, f.points);
      ctx.fillStyle = toCss(base);
      ctx.fill();
      ctx.strokeStyle = toCss(multiply(base, 0.45));
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      const inner = f.points.map((p) => [p[0] + (c[0] - p[0]) * INSET, p[1] + (c[1] - p[1]) * INSET]);
      // Vinco escuro entre as faces e, por cima, as tiras do bisel com a normal da aresta.
      polygon(ctx, f.points);
      ctx.fillStyle = toCss(multiply(base, 0.4));
      ctx.fill();
      f.points.forEach((p, k) => {
        const q = f.points[(k + 1) % f.points.length];
        polygon(ctx, [p, q, inner[(k + 1) % inner.length], inner[k]]);
        ctx.fillStyle = toCss(mix(shade(f.edgeNormals[k], mat, light), base, 0.35));
        ctx.fill();
      });
      // Corpo da face: mais claro do lado da luz, como a luz atravessando a gema.
      const extent = Math.max(...inner.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))) || 1;
      const g = ctx.createLinearGradient(c[0] + ls[0] * extent, c[1] + ls[1] * extent, c[0] - ls[0] * extent, c[1] - ls[1] * extent);
      g.addColorStop(0, toCss(add(multiply(base, 1.22), multiply(mat.glow, 0.05))));
      g.addColorStop(1, toCss(multiply(base, 0.62)));
      polygon(ctx, inner);
      ctx.fillStyle = g;
      ctx.fill();
      const glint = specular(f.n, mat, light);
      if (glint > 0.03) {
        const gx = c[0] + ls[0] * extent * 0.4;
        const gy = c[1] + ls[1] * extent * 0.4;
        const gr = extent * 0.55;
        const sg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        sg.addColorStop(0, `rgb(255 255 255 / ${Math.min(0.85, glint).toFixed(3)})`);
        sg.addColorStop(1, 'rgb(255 255 255 / 0)');
        ctx.fillStyle = sg;
        polygon(ctx, inner);
        ctx.fill();
      }
    }
  }
  if (die.r * (die.scale ?? 1) >= 9) {
    for (const f of faces) {
      if (f.n[2] < 0.2) continue;
      const frame = faceFrame(die, f, project);
      const text = die.labels?.[f.index];
      if (text) drawLabel(ctx, die, f, frame, text, light, dpr);
      else if (die.runes) drawRune(ctx, die, f, frame, f.index, light, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  // Contorno fino: separa a gema escura do veludo escuro.
  const outline = silhouette(faces.flatMap((f) => f.points));
  if (outline.length > 2) {
    polygon(ctx, outline);
    ctx.strokeStyle = toCss(mix(mat.glow, [1, 1, 1], 0.3), 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Fecho convexo dos pontos na tela (contorno do dado). */
export function silhouette(points) {
  const pts = points.map(([x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const side = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && side(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && side(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Faíscas: pontos que brilham, voam e apagam. */
export function drawSparks(ctx, sparks, dpr = 1) {
  if (!sparks.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of sparks) {
    const life = 1 - s.age / s.ttl;
    if (life <= 0) continue;
    const radius = s.size * (0.4 + 0.6 * life);
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 2.4);
    g.addColorStop(0, toCss(s.color, life));
    g.addColorStop(0.35, toCss(s.color, life * 0.5));
    g.addColorStop(1, toCss(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

