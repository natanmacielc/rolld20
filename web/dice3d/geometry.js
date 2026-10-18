// Poliedros dos dados: vértices, faces (anti-horário visto de fora), normais, número e "para cima"
// do rótulo de cada face. Puro: sem DOM, testado no Node. Raio de cada dado perto de 1.
import { add, centroid, cross, dot, length, normalize, scale, sub } from './math.js';

const PHI = (1 + Math.sqrt(5)) / 2;

/** Todas as combinações de sinais de um ponto (sem repetir quando a coordenada é zero). */
function signs(point) {
  let out = [[]];
  for (const c of point) {
    out = out.flatMap((p) => (c === 0 ? [[...p, 0]] : [[...p, c], [...p, -c]]));
  }
  return out;
}

/** As permutações cíclicas (x, y, z), (y, z, x) e (z, x, y). */
const cyclic = ([x, y, z]) => [[x, y, z], [y, z, x], [z, x, y]];

/**
 * Monta as faces de um poliedro convexo a partir das normais: os vértices mais avançados na
 * direção de cada normal formam a face, ordenados em volta dela.
 */
function facesFromNormals(vertices, normals) {
  return normals.map((n0) => {
    const n = normalize(n0);
    const reach = vertices.map((v) => dot(v, n));
    const max = Math.max(...reach);
    const ids = reach.flatMap((r, i) => (r > max - 1e-6 ? [i] : []));
    return orderAround(vertices, ids, n);
  });
}

/** Ordena os vértices da face no sentido anti-horário visto de fora (normal para a câmera). */
function orderAround(vertices, ids, n) {
  const c = centroid(ids.map((i) => vertices[i]));
  const ref = normalize(sub(vertices[ids[0]], c));
  const side = cross(n, ref);
  const angle = (i) => {
    const d = sub(vertices[i], c);
    return Math.atan2(dot(d, side), dot(d, ref));
  };
  return [...ids].sort((a, b) => angle(a) - angle(b));
}

/** Escala os vértices para o raio da esfera circunscrita dar `radius`. */
function fit(vertices, radius = 1) {
  const r = Math.max(...vertices.map(length));
  return vertices.map((v) => scale(v, radius / r));
}

function tetrahedron() {
  const vertices = fit([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], 1.12);
  return { vertices, faces: facesFromNormals(vertices, vertices.map((v) => scale(v, -1))) };
}

function cube() {
  const vertices = fit(signs([1, 1, 1]), 1.02);
  const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  return { vertices, faces: facesFromNormals(vertices, normals) };
}

function octahedron() {
  const vertices = fit([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], 1.08);
  return { vertices, faces: facesFromNormals(vertices, signs([1, 1, 1])) };
}

function icosahedron() {
  const vertices = fit(cyclic([0, 1, PHI]).flatMap(signs), 1.02);
  const normals = [...signs([1, 1, 1]), ...cyclic([0, PHI, 1 / PHI]).flatMap(signs)];
  return { vertices, faces: facesFromNormals(vertices, normals) };
}

function dodecahedron() {
  const vertices = fit([...signs([1, 1, 1]), ...cyclic([0, 1 / PHI, PHI]).flatMap(signs)], 1.02);
  return { vertices, faces: facesFromNormals(vertices, cyclic([0, PHI, 1]).flatMap(signs)) };
}

/**
 * Trapezoedro pentagonal (d10): dois ápices e um anel de 10 vértices em zigue-zague. A altura
 * dos ápices sai da condição de cada pipa ser plana.
 */
function trapezohedron() {
  const a = 0.105;
  const c36 = Math.cos(Math.PI / 5);
  const h = (2 * a * c36) / (1 - c36) + a;
  const ring = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI) / 5;
    return [Math.cos(angle), Math.sin(angle), i % 2 === 0 ? a : -a];
  });
  // O eixo dos ápices fica em y: o anel e as pipas giram para o eixo da tela.
  const raw = [[0, 0, h], [0, 0, -h], ...ring].map(([x, y, z]) => [x, z, y]);
  const vertices = fit(raw, 1.06);
  const top = 0;
  const bottom = 1;
  const r = (i) => 2 + (((i % 10) + 10) % 10);
  const faces = [];
  for (let k = 0; k < 5; k++) {
    faces.push([top, r(2 * k), r(2 * k + 1), r(2 * k + 2)]);
    faces.push([bottom, r(2 * k + 1), r(2 * k + 2), r(2 * k + 3)]);
  }
  return {
    vertices,
    faces: faces.map((ids) => {
      const n = normalize(centroid(ids.map((i) => vertices[i])));
      return orderAround(vertices, ids, n);
    }),
    apexes: [top, bottom],
  };
}

const BUILDERS = { 4: tetrahedron, 6: cube, 8: octahedron, 10: trapezohedron, 12: dodecahedron, 20: icosahedron };

/**
 * "Para cima" do rótulo: na pipa do d10, o ápice; em polígono de lados ímpares, um vértice;
 * de lados pares, o meio de uma aresta.
 */
function labelUp(vertices, ids, center, n, apexes) {
  const apex = ids.find((i) => apexes?.includes(i));
  let target;
  if (apex !== undefined) target = vertices[apex];
  else if (ids.length % 2 === 1) target = vertices[ids[0]];
  else target = scale(add(vertices[ids[0]], vertices[ids[1]]), 0.5);
  const d = sub(target, center);
  return normalize(sub(d, scale(n, dot(d, n))));
}

/** Números das faces: faces opostas somam n+1 (o d4 não tem faces opostas). */
function numberFaces(normals) {
  const n = normals.length;
  const labels = new Array(n).fill(0);
  let next = 1;
  for (let i = 0; i < n; i++) {
    if (labels[i]) continue;
    const opposite = normals.findIndex((m, j) => j !== i && dot(m, normals[i]) < -0.999);
    if (opposite < 0) {
      labels[i] = next++;
    } else {
      labels[i] = next;
      labels[opposite] = n + 1 - next;
      next += 1;
    }
  }
  return labels;
}

const cache = new Map();

/** Corpo do dado de `sides` lados (o d100 usa o corpo do d10). */
export function solid(sides) {
  const key = sides === 100 ? 10 : sides;
  if (cache.has(key)) return cache.get(key);
  const build = BUILDERS[key];
  if (!build) throw new Error(`dado sem corpo: d${sides}`);
  const { vertices, faces: rawFaces, apexes } = build();
  const normals = rawFaces.map((ids) => {
    const [a, b, c] = ids.map((i) => vertices[i]);
    return normalize(cross(sub(b, a), sub(c, a)));
  });
  const labels = numberFaces(normals);
  const faces = rawFaces.map((ids, f) => {
    const points = ids.map((i) => vertices[i]);
    // Na pipa, o rótulo desce um pouco do ápice para o meio da parte larga.
    const center = apexes ? centroid([...points, ...points.filter((_, k) => !apexes.includes(ids[k]))]) : centroid(points);
    const n = normals[f];
    const up = labelUp(vertices, ids, center, n, apexes);
    // Tamanho do rótulo: o raio do círculo inscrito aproximado (menor distância do centro a uma aresta).
    const inradius = Math.min(...points.map((p, k) => {
      const q = points[(k + 1) % points.length];
      const edge = sub(q, p);
      const t = dot(sub(center, p), edge) / dot(edge, edge);
      return length(sub(center, add(p, scale(edge, t))));
    }));
    return { ids, normal: n, center, up, label: labels[f], inradius };
  });
  // Vizinhos por aresta: a normal da aresta (média das duas faces) dá o brilho do bisel.
  const edgeFaces = new Map();
  faces.forEach((face, f) => face.ids.forEach((a, k) => {
    const b = face.ids[(k + 1) % face.ids.length];
    const key2 = a < b ? `${a}-${b}` : `${b}-${a}`;
    edgeFaces.set(key2, [...(edgeFaces.get(key2) ?? []), f]);
  }));
  for (const face of faces) {
    face.edgeNormals = face.ids.map((a, k) => {
      const b = face.ids[(k + 1) % face.ids.length];
      const pair = edgeFaces.get(a < b ? `${a}-${b}` : `${b}-${a}`);
      const other = faces[pair.find((f) => faces[f] !== face)];
      return normalize(add(face.normal, other.normal));
    });
  }
  const body = { sides: key, vertices, faces };
  cache.set(key, body);
  return body;
}

/** Índice da face com o número `label`. */
export function faceOf(body, label) {
  const i = body.faces.findIndex((f) => f.label === label);
  if (i < 0) throw new Error(`d${body.sides} sem a face ${label}`);
  return i;
}
