// Peças visuais com um DOM mínimo falso (o Node não tem DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.textContent = '';
  }

  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  append(...c) { this.children.push(...c); }
}

globalThis.document = {
  createElement: (tag) => new FakeElement(tag),
  createElementNS: (_ns, tag) => new FakeElement(tag),
};

const { dieIcon, DIE_SIDES } = await import('./ui.js');

test('ícone de cada dado: faces sombreadas por atributo, sem estilo inline nem número', () => {
  for (const sides of DIE_SIDES) {
    const icon = dieIcon(sides);
    assert.equal(icon.tag, 'svg');
    assert.equal(icon.attrs.viewBox, '0 0 100 100');
    const paths = icon.children.filter((c) => c.tag === 'path');
    assert.ok(paths.length > 4, `d${sides} tem faces`);
    assert.ok(paths.every((p) => /^rgb\(/.test(p.attrs.fill)), 'cor por atributo fill');
    assert.ok(icon.children.every((c) => !('style' in c.attrs)), 'nada de style inline');
    assert.equal(icon.children.filter((c) => c.tag === 'text').length, 0);
  }
});

test('ícone com valor: o número vai na face da frente', () => {
  for (const [sides, value] of [[20, 17], [6, 4], [100, 73], [4, 1]]) {
    const texts = dieIcon(sides, value).children.filter((c) => c.tag === 'text');
    assert.equal(texts.length, 1);
    assert.equal(texts[0].textContent, String(value));
    assert.match(texts[0].attrs.transform, /^matrix\(/);
  }
});
