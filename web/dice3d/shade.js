// Luz e materiais: uma luz principal coerente para a cena toda (alto à esquerda), céu de cima,
// rim light fria no contorno e brilho especular de gema. Puro: sem DOM, testado no Node.
import { add, clamp, dot, normalize } from './math.js';

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];

/** Cor de cada dado (também tinge a página pelo --c). */
export const DIE_COLORS = {
  4: '#2ee6ff', 6: '#4dffa6', 8: '#ffc23d', 10: '#ff7a3d', 12: '#ff3d9a', 20: '#a86bff', 100: '#6b8cff',
};

/** Luz de repouso: do alto à esquerda, um pouco à frente. */
export const DEFAULT_LIGHT = normalize([-0.55, 0.62, 0.72]);
const VIEW = [0, 0, 1];
const WARM = [1, 0.86, 0.62];
const COOL = [0.32, 0.36, 0.9];
const RIM = [0.62, 0.78, 1];

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** '#rrggbb' para RGB linear 0..1. */
export function linear(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
}

/** RGB linear para 'rgb(r g b / a)'. */
export function css(rgb, alpha = 1) {
  const [r, g, b] = rgb.map((v) => Math.round(clamp(toSrgb(clamp(v))) * 255));
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.round(clamp(alpha) * 1000) / 1000})`;
}

export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const multiply = (a, s) => a.map((v) => v * s);

/** Material de gema de um dado: corpo, tinta dos números e brilho. */
export function material(sides) {
  const color = linear(DIE_COLORS[sides] ?? DIE_COLORS[20]);
  return {
    // Corpo um pouco mais fundo que a cor da página: a gema escurece por dentro.
    body: mix(multiply(color, 0.78), [0.01, 0.006, 0.03], 0.18),
    glow: color,
    ink: [1, 0.9, 0.66],
    shininess: 56,
    specular: 0.85,
  };
}

/**
 * Cor de uma superfície com normal `n` (já no espaço do mundo). Lambert com céu de cima, matiz
 * mais quente no lado da luz e mais frio na sombra, rim light no contorno e especular Blinn-Phong.
 */
export function shade(n, mat, light = DEFAULT_LIGHT) {
  const diffuse = Math.max(0, dot(n, light));
  const sky = 0.16 + 0.1 * (n[1] * 0.5 + 0.5);
  let rgb = multiply(mat.body, sky + 1.05 * diffuse);
  rgb = add(rgb, multiply(WARM, 0.07 * diffuse * diffuse));
  rgb = add(rgb, multiply(COOL, 0.035 * (1 - diffuse)));
  const facing = Math.max(0, dot(n, VIEW));
  rgb = add(rgb, multiply(RIM, 0.22 * (1 - facing) ** 3 * (1 - diffuse)));
  const half = normalize(add(light, VIEW));
  const spec = mat.specular * Math.max(0, dot(n, half)) ** mat.shininess;
  return add(rgb, [spec, spec, spec]);
}

/** Só o brilho especular (para o reflexo pequeno e duro em cima da face). */
export function specular(n, mat, light = DEFAULT_LIGHT) {
  const half = normalize(add(light, VIEW));
  return Math.max(0, dot(n, half)) ** (mat.shininess * 2.4);
}

/** Luminância relativa (para os testes e para escolher a cor da tinta). */
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
