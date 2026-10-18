// Bandeja com um canvas falso que registra o que é escrito: nenhum número aparece antes do
// resultado real, e o resultado aparece na face da frente.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const written = [];
function fakeContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'fillText') return (text) => written.push(String(text));
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

globalThis.document = {
  createElement: () => ({ setAttribute() {}, getContext: fakeContext, width: 0, height: 0 }),
  addEventListener() {},
  hidden: false,
};
globalThis.requestAnimationFrame = () => {}; // o teste avança os quadros com step()

const { Tray, LAND_MS } = await import('./tray.js');
const { solid } = await import('./geometry.js');
const { qrot } = await import('./math.js');

function container() {
  return {
    dataset: {},
    append() {},
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 320 }),
  };
}

/** Avança a bandeja de `from` até `to` ms (relógio do performance.now), quadro a quadro. */
function run(tray, from, to, every = 16) {
  for (let t = from; t <= to; t += every) tray.step(t);
}

const frontLabel = (die) => {
  const z = die.body.faces.map((f) => qrot(die.q, f.normal)[2]);
  return die.labels[z.indexOf(Math.max(...z))];
};

test('esperando o drand nenhum número é desenhado; ao pousar, a face da frente mostra o valor', () => {
  const tray = new Tray(container(), 20, 3);
  const start = performance.now();
  tray.tumble();
  written.length = 0;
  run(tray, start, start + 3000);
  assert.ok(written.every((t) => !/\d/.test(t)), `escreveu ${written.filter((t) => /\d/.test(t))}`);

  const values = [20, 1, 13];
  tray.land(values);
  const t0 = performance.now();
  run(tray, t0, t0 + 400 + LAND_MS + 200);
  tray.dice.forEach((die, i) => {
    assert.equal(die.mode, 'rest');
    assert.equal(frontLabel(die), String(values[i]));
  });
  assert.equal(tray.dice[0].tone, 'max');
  assert.equal(tray.dice[1].tone, 'min');
  for (const v of values) assert.ok(written.includes(String(v)));

  // Rolar de novo apaga os números antes de girar.
  tray.tumble();
  written.length = 0;
  run(tray, t0 + 2000, t0 + 3000);
  assert.ok(written.every((t) => !/\d/.test(t)));
});

test('sem quadros (aba oculta), land termina com o resultado mesmo assim', async () => {
  const tray = new Tray(container(), 100, 2);
  tray.tumble();
  await tray.land([47, 100]);
  assert.deepEqual(tray.dice.map((d) => d.mode), ['rest', 'rest']);
  assert.deepEqual(tray.dice.map(frontLabel), ['47', '100']);
});

test('dois setSides seguidos: o último vence e não sobra estado da troca', () => {
  const tray = new Tray(container(), 20, 2);
  const start = performance.now();
  tray.setSides(6);
  run(tray, start, start + 120);
  tray.setSides(12);
  run(tray, start + 120, start + 2000);
  for (const die of tray.dice) {
    assert.equal(die.sides, 12);
    assert.equal(die.body, solid(12));
    assert.equal(die.mode, 'idle');
    assert.equal(die.scale, 1);
    assert.equal(die.swapTo, null);
    assert.equal(frontLabel(die), '12');
  }
});

test('setCount põe e tira dados; os que saem somem ao fim', () => {
  const tray = new Tray(container(), 8, 1);
  const start = performance.now();
  tray.setCount(5);
  assert.equal(tray.dice.length, 5);
  run(tray, start, start + 1500);
  assert.ok(tray.dice.every((d) => d.mode === 'idle' && Math.abs(d.scale - 1) < 0.01));
  tray.setCount(2);
  assert.equal(tray.dice.length, 2);
  assert.equal(tray.leaving.length, 3);
  run(tray, start + 1500, start + 2000);
  assert.equal(tray.leaving.length, 0);
});

test('show mostra os valores sem animar', () => {
  const tray = new Tray(container(), 6, 2);
  tray.show([3, 6]);
  assert.deepEqual(tray.dice.map(frontLabel), ['3', '6']);
});
