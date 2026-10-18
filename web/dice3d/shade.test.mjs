// Luz e cor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from './math.js';
import { css, DEFAULT_LIGHT, DIE_SIDES, linear, luminance, material, shade } from './shade.js';

test('a face virada para a luz é mais clara que a do lado da sombra', () => {
  // As duas visíveis para a câmera (z > 0): de costas para a câmera nenhuma face é desenhada.
  const away = normalize([0.55, -0.62, 0.56]);
  for (const sides of DIE_SIDES) {
    const mat = material(sides);
    const lit = luminance(shade(DEFAULT_LIGHT, mat));
    const dark = luminance(shade(away, mat));
    assert.ok(lit > dark * 3, `d${sides}`);
  }
});

test('css sempre devolve uma cor válida, mesmo fora de 0..1', () => {
  const ok = /^rgb\(\d{1,3} \d{1,3} \d{1,3}( \/ [\d.]+)?\)$/;
  for (const rgb of [[0, 0, 0], [1, 1, 1], [2, -1, 0.5], [NaN, 0, 0].map((v) => v || 0)]) {
    assert.match(css(rgb), ok);
    assert.match(css(rgb, 0.4), ok);
  }
  assert.equal(css(linear('#ff3d9a')), 'rgb(255 61 154)');
});
