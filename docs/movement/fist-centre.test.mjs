// The fist re-centring the movement page turns on (ThumbJoystick.fistCentre), kept in its own file so thumb-joystick.test.mjs
// keeps checking the original rule (a circle is captured once and never moves) with the flag off.
// node docs/movement/fist-centre.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ThumbJoystick } from "./thumb-joystick.mjs";

const sample = (point, rest = false) => ({ open: false, rest, scale: 0.2, palm: [0.5, 0.5], point, tip: 4 });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
// The joystick confirms a new direction over two samples before it walks, so every move here is held for two.
const hold = (j, pt, t0) => { j.receive(sample(pt), t0); j.receive(sample(pt), t0 + 40); return Math.hypot(j.x, j.z); };

test("a fist stops and puts the circle back on the thumb", () => {
  const j = new ThumbJoystick(); j.fistCentre = true;
  j.receive(sample([0.5, 0.5]), 100);
  assert.deepEqual(j.centre, [0.5, 0.5], "the first thumb seen places the circle on it");

  hold(j, [0.5, 0.38], 140);                                 // thumb forward: walk
  assert.ok(j.z < -0.2, "thumb above the centre walks forward, got z=" + j.z);

  j.receive(sample([0.56, 0.55], true), 220);                // fist somewhere else
  assert.equal(j.x, 0); assert.equal(j.z, 0);
  assert.ok(near(j.centre[0], 0.56) && near(j.centre[1], 0.55), "the fist re-centres the circle on the thumb, got " + j.centre);

  j.receive(sample([0.56, 0.55]), 260);                      // thumb where the fist left it: still neutral
  assert.equal(j.x, 0); assert.equal(j.z, 0);

  hold(j, [0.56, 0.43], 300);                                // the same forward move from the new centre still works
  assert.ok(j.z < -0.2, "forward is reachable from the new centre, got z=" + j.z);
});

test("forward and backward are the same distance from the centre", () => {
  const j = new ThumbJoystick(); j.fistCentre = true;
  j.receive(sample([0.5, 0.5], true), 100);
  const travel = 0.5 * j.effectiveScale;                     // the circle edge
  const forward = hold(j, [0.5, 0.5 - travel], 140);
  j.receive(sample([0.5, 0.5], true), 220);
  const back = hold(j, [0.5, 0.5 + travel], 260);
  assert.ok(forward > 0.9 && back > 0.9, `both edges reach full speed (forward ${forward}, back ${back})`);
  assert.ok(Math.abs(forward - back) < 0.05, `and by the same amount (forward ${forward}, back ${back})`);
});

test("with the flag off the circle still never moves", () => {
  const j = new ThumbJoystick();                             // fistCentre defaults to false
  j.receive(sample([0.5, 0.5]), 100);
  const before = [...j.centre];
  j.receive(sample([0.56, 0.55], true), 140);
  assert.deepEqual(j.centre, before, "a fist does not move a captured circle");
});
