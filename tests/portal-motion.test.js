import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePortalTilt } from '../portal-motion.js';

test('gravity uses the current holding pose and a dead zone rather than an assumed upright angle', () => {
  const neutral = { beta: 48, gamma: -12 };
  assert.deepEqual(normalizePortalTilt(neutral, neutral), { x: 0, y: 0 });
  assert.deepEqual(normalizePortalTilt({ beta: 48.8, gamma: -12.6 }, neutral), { x: 0, y: 0 });
  assert.deepEqual(normalizePortalTilt({ beta: 57, gamma: -21 }, neutral), { x: -1, y: 1 });
});

test('gravity rotation maps tilt to screen axes in both landscape orientations', () => {
  const neutral = { beta: 40, gamma: 0 };
  const clockwise = normalizePortalTilt({ beta: 49, gamma: 0 }, neutral, 90);
  assert.ok(Math.abs(clockwise.x - 1) < 1e-9 && Math.abs(clockwise.y) < 1e-9);
  const counterclockwise = normalizePortalTilt({ beta: 49, gamma: 0 }, neutral, -90);
  assert.ok(Math.abs(counterclockwise.x + 1) < 1e-9 && Math.abs(counterclockwise.y) < 1e-9);
});

test('the sensor seam wraps smoothly and invalid samples remain neutral', () => {
  assert.deepEqual(normalizePortalTilt({ beta: -179, gamma: 0 }, { beta: 179, gamma: 0 }), { x: 0, y: .125 });
  assert.deepEqual(normalizePortalTilt({ beta: null, gamma: 4 }, { beta: 0, gamma: 0 }), { x: 0, y: 0 });
  assert.deepEqual(normalizePortalTilt({ beta: Infinity, gamma: 4 }, { beta: 0, gamma: 0 }), { x: 0, y: 0 });
});
