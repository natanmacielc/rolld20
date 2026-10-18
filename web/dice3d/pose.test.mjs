// Poses de repouso, caminho de queda e posições na bandeja.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solid } from './geometry.js';
import { qangle, qaxis, qrot } from './math.js';
import { dropHeight, IMPACTS, landingPath, layout, restingFace, restingPose } from './pose.js';
import { DIE_SIDES } from './shade.js';

const valuesOf = (sides) => Array.from({ length: sides === 100 ? 100 : sides }, (_, i) => i + 1);

for (const sides of DIE_SIDES) {
  test(`d${sides}: em repouso, a face do valor é a mais virada para a câmera, de pé`, () => {
    const body = solid(sides);
    for (const twist of [-0.25, 0, 0.25]) {
      for (const value of valuesOf(sides)) {
        const q = restingPose(sides, value, twist);
        const front = restingFace(sides, value);
        const z = body.faces.map((f) => qrot(q, f.normal)[2]);
        assert.equal(z.indexOf(Math.max(...z)), front, `d${sides}=${value}`);
        assert.ok(z[front] > 0.9);
        assert.ok(qrot(q, body.faces[front].up)[1] > 0.85, 'número de pé');
      }
    }
  });
}

test('d100: a face da frente é uma das dez do d10', () => {
  assert.equal(solid(100).faces[restingFace(100, 47)].label, 7);
  assert.equal(solid(100).faces[restingFace(100, 100)].label, 10);
});

test('landingPath começa em from e termina exatamente em to', () => {
  const from = qaxis([0.3, 1, 0.2], 1.7);
  const to = restingPose(20, 13);
  const path = landingPath(from, to, [1, 0.5, 0], 9);
  assert.ok(qangle(path(0), from) < 1e-9);
  assert.deepEqual(path(1), to);
  assert.ok(qangle(path(0.999), to) < 0.01);
});

test('a queda começa no alto, quica e para no veludo', () => {
  assert.equal(dropHeight(0, 2), 2);
  assert.equal(dropHeight(1, 2), 0);
  assert.ok(Math.abs(dropHeight(IMPACTS[0], 2)) < 1e-9);
  const bounce = dropHeight((IMPACTS[0] + IMPACTS[1]) / 2, 2);
  assert.ok(bounce > 0 && bounce < 1);
});

test('layout de 1 a 20 dados: dentro da bandeja e sem sobrepor', () => {
  for (const [w, h] of [[320, 320], [500, 340], [260, 420]]) {
    for (let count = 1; count <= 20; count++) {
      const { radius, positions } = layout(count, w, h);
      assert.equal(positions.length, count);
      for (const p of positions) {
        assert.ok(p.x - radius >= 0 && p.x + radius <= w, `x dentro (${count} em ${w}x${h})`);
        assert.ok(p.y - radius >= 0 && p.y + radius <= h, `y dentro (${count} em ${w}x${h})`);
      }
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
          assert.ok(d >= 2 * radius, `sem sobrepor (${count} em ${w}x${h})`);
        }
      }
    }
  }
});

test('layout é estável: a mesma quantidade dá as mesmas posições', () => {
  assert.deepEqual(layout(7, 300, 300), layout(7, 300, 300));
});
