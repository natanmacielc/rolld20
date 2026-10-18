// Corpos dos dados: faces, normais e números.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceOf, solid } from './geometry.js';
import { centroid, cross, dot, length, sub } from './math.js';
import { DIE_SIDES } from './shade.js';

const FACES = { 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 20: 20, 100: 10 };

for (const sides of DIE_SIDES) {
  test(`d${sides}: número de faces, cada número uma vez`, () => {
    const body = solid(sides);
    assert.equal(body.faces.length, FACES[sides]);
    const labels = body.faces.map((f) => f.label).sort((a, b) => a - b);
    assert.deepEqual(labels, Array.from({ length: FACES[sides] }, (_, i) => i + 1));
  });

  test(`d${sides}: faces planas, normais unitárias para fora, vértices em ordem anti-horária`, () => {
    const body = solid(sides);
    for (const face of body.faces) {
      assert.ok(Math.abs(length(face.normal) - 1) < 1e-9);
      assert.ok(dot(face.normal, face.center) > 0, 'normal aponta para fora');
      const points = face.ids.map((i) => body.vertices[i]);
      const c = centroid(points);
      for (const p of points) assert.ok(Math.abs(dot(sub(p, c), face.normal)) < 1e-6, 'face plana');
      for (let k = 0; k < points.length; k++) {
        const a = points[k];
        const b = points[(k + 1) % points.length];
        assert.ok(dot(cross(sub(a, c), sub(b, c)), face.normal) > 0, 'anti-horário visto de fora');
      }
      // Convexo: todos os vértices ficam atrás do plano de cada face.
      for (const v of body.vertices) assert.ok(dot(sub(v, face.center), face.normal) < 1e-6);
      assert.ok(Math.abs(dot(face.up, face.normal)) < 1e-9, 'o "para cima" do rótulo fica no plano da face');
      assert.ok(face.inradius > 0.1);
    }
  });

  if (sides !== 4) {
    test(`d${sides}: faces opostas somam n+1`, () => {
      const body = solid(sides);
      for (const face of body.faces) {
        const opposite = body.faces.find((f) => dot(f.normal, face.normal) < -0.999);
        assert.ok(opposite, 'toda face tem uma oposta');
        assert.equal(face.label + opposite.label, body.faces.length + 1);
      }
    });
  }
}

test('faceOf acha a face pelo número e recusa número que não existe', () => {
  const body = solid(20);
  assert.equal(body.faces[faceOf(body, 17)].label, 17);
  assert.throws(() => faceOf(body, 21));
});
