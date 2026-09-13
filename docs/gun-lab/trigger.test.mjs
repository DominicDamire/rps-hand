import { test } from "node:test";
import assert from "node:assert/strict";
import { TriggerTracker, indexBends } from "./trigger.mjs";
import { defaults, validateProfile } from "./profile.mjs";
const options = { ...defaults().trigger, smoothing: 0 };
function hand(bend) {
  const p = Array.from({ length: 21 }, () => [0, 0, 0]),
    r = (bend * Math.PI) / 180;
  p[0] = [0, -1, 0];
  p[5] = [0, 0, 0];
  p[6] = [0, 1, 0];
  p[7] = [0, 1 + Math.cos(r), Math.sin(r)];
  p[8] = [0, 1 + 2 * Math.cos(r), 2 * Math.sin(r)];
  return p;
}
test("3D bend is invariant under camera rotation, translation and scale", () => {
  const p = hand(63),
    q = p.map(([x, y, z]) => ({ x: 10 + z * 3, y: 20 + y * 3, z: 30 - x * 3 }));
  assert.ok(Math.abs(indexBends(p)[1] - 63) < 1e-8);
  assert.ok(Math.abs(indexBends(q)[1] - 63) < 1e-8);
});
test("release arms, a press counts once, held bends never repeat", () => {
  const t = new TriggerTracker();
  assert.equal(t.update(hand(75), 0, options).fired, false);
  t.update(hand(10), 20, options);
  assert.equal(t.update(hand(75), 40, options).fired, true);
  for (let i = 60; i < 160; i += 20)
    assert.equal(t.update(hand(75), i, options).fired, false);
  t.update(hand(10), 180, options);
  assert.equal(t.update(hand(75), 200, options).fired, true);
});
test("hysteresis rejects threshold chatter", () => {
  const t = new TriggerTracker();
  t.update(hand(10), 0, options);
  assert.equal(t.update(hand(65), 30, options).fired, true);
  for (const [i, b] of [54, 58, 52, 65, 50].entries())
    assert.equal(t.update(hand(b), 60 + i * 20, options).fired, false);
});
test("lost, stale, ambiguous and malformed input disarm before reacquisition", () => {
  for (const loss of [
    (t) => t.update(null, 40, options),
    (t) => t.update([], 40, options),
    (t) => t.stale(400),
  ]) {
    const t = new TriggerTracker();
    t.update(hand(10), 0, options);
    loss(t);
    assert.equal(t.update(hand(75), 450, options).fired, false);
    t.update(hand(10), 470, options);
    assert.equal(t.update(hand(75), 490, options).fired, true);
  }
  assert.equal(indexBends(Array(21).fill([NaN, 0, 0])), null);
  assert.equal(indexBends(Array(21).fill([0, 0, 0])), null);
});
test("long inference gap never turns a returning bent finger into a press", () => {
  const t = new TriggerTracker();
  t.update(hand(10), 0, options);
  assert.equal(t.update(hand(75), 300, options).fired, false);
});
test("time based smoothing follows motion consistently at different frame rates", () => {
  const run = (dt) => {
    const t = new TriggerTracker(),
      s = { ...options, smoothing: 50 };
    t.update(hand(10), 0, s);
    for (let i = dt; i <= 200; i += dt) t.update(hand(75), i, s);
    return t.value;
  };
  assert.ok(Math.abs(run(10) - run(20)) < 1e-9);
});
test("preset round trip preserves every edited joint and transform", () => {
  const p = defaults();
  p.angles.Thumb2 = [-20, 45, 14];
  p.gun.position = [120, -40, 50];
  p.hand.rotation = [90, -45, 30];
  p.trigger.pressed = 90;
  assert.deepEqual(validateProfile(JSON.parse(JSON.stringify(p))), p);
});
test("preset rejects incompatible and nonfinite data, reversed calibration and unknown fields", () => {
  for (const mutate of [
    (p) => (p.rig = "other"),
    (p) => (p.angles.Index1[0] = Infinity),
    (p) => (p.hand.scale = 0),
    (p) => (p.trigger.pressed = p.trigger.released),
    (p) => (p.trigger.off = p.trigger.on),
    (p) => (p.gun.position = [0, 0]),
  ]) {
    const p = defaults();
    mutate(p);
    assert.throws(() => validateProfile(p));
  }
  const p = defaults();
  p.extra = "ignored";
  assert.equal(validateProfile(p).extra, undefined);
});
