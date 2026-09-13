import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GripController, heldAngles, observation } from "./held-pose.mjs";
import { jointAxes } from "./joint-axes.mjs";
import { validateProfile } from "./profile.mjs";
import { providedProfile } from "./presets.mjs";
const source = (file) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url)));
const profile = providedProfile(
  source("./released-grip.json"),
  source("./pressed-grip.json"),
  source("./thumb-up-grip.json"),
);
function hand(lower = 80, index = 5, thumb = 30) {
  const p = Array.from({ length: 21 }, () => [0, 0, 0]);
  p[0] = [0, -0.1, 0];
  for (let f = 0; f < 5; f++) {
    const start = 1 + 4 * f,
      angle = ((f === 0 ? thumb : f === 1 ? index : lower) * Math.PI) / 180;
    p[start] = [f * 0.02, 0, 0];
    p[start + 1] = [f * 0.02, 0.03, 0];
    p[start + 2] = [
      f * 0.02,
      0.03 + 0.03 * Math.cos(angle),
      0.03 * Math.sin(angle),
    ];
    p[start + 3] = [
      f * 0.02,
      0.03 + 0.06 * Math.cos(angle),
      0.06 * Math.sin(angle),
    ];
  }
  return p;
}
test("saved transforms and pose survive JSON validation unchanged", () => {
  assert.deepEqual(profile.hand.position, [-37, 65, -185]);
  assert.deepEqual(profile.gun.position, [-18, 16, -18]);
  assert.equal(profile.gun.scale, 0.82);
  assert.deepEqual(profile.angles.Thumb1, [19, 0, -67]);
});
test("all three lower fingers stay exactly saved for every live thumb/index input", () => {
  for (const index of [-10, 0, 0.5, 1, 10])
    for (const thumb of [-3, 0, 0.3, 1, 10]) {
      const a = heldAngles(profile, index, thumb);
      for (const f of ["Middle", "Ring", "Pinky"])
        for (let k = 1; k <= 3; k++)
          assert.deepEqual(a[f + k], profile.angles[f + k]);
    }
});
test("index stops at exact JSON 4 values, released index stays JSON 2", () => {
  for (const v of [1, 2, 100]) {
    const a = heldAngles(profile, v, 1);
    assert.deepEqual([a.Index1[0], a.Index2[0], a.Index3[0]], [-3, 78, 69]);
  }
  assert.deepEqual(heldAngles(profile, 0, 1).Index3, [-19, 0, 0]);
});
test("thumb values stay between the raised pose and JSON 4 maximum", () => {
  for (let i = -10; i <= 110; i++) {
    const a = heldAngles(profile, 0, i / 100);
    for (const n of ["Thumb1", "Thumb2", "Thumb3"])
      a[n].forEach((v, k) =>
        assert.ok(
          v >= Math.min(profile.thumbOpen[n][k], profile.angles[n][k]) - 1e-8 &&
            v <= Math.max(profile.thumbOpen[n][k], profile.angles[n][k]) + 1e-8,
        ),
      );
  }
  assert.deepEqual(heldAngles(profile, 0, 1), profile.angles);
});
test("thumb anatomical control mapping preserves legacy XYZ presets and twist", () => {
  assert.deepEqual(jointAxes("Thumb2"), [
    { name: "Bend", axis: 1, sign: -1 },
    { name: "Sideways", axis: 0, sign: 1 },
    { name: "Twist", axis: 2, sign: 1 },
  ]);
  for (const n of Object.keys(profile.angles)) {
    const values = [...profile.angles[n]];
    for (const { axis, sign } of jointAxes(n)) {
      const shown = values[axis] * sign;
      values[axis] = shown * sign;
    }
    assert.deepEqual(values, profile.angles[n]);
  }
  assert.equal(jointAxes("Index2")[0].axis, 0);
});
test("confirmed three-finger grip picks up; index and thumb do not control pickup", () => {
  for (const index of [0, 90]) {
    const c = new GripController();
    assert.equal(c.update(hand(80, index), 0, profile).held, false);
    assert.equal(c.update(hand(80, index), 80, profile).held, false);
    const p = c.update(hand(80, index), 130, profile);
    assert.equal(p.picked, true);
    assert.equal(p.fired, false);
  }
});
test("one shot per press, release rearms, no firing on pickup bent", () => {
  const p = structuredClone(profile);
  p.trigger.smoothing = 0;
  const c = new GripController();
  c.update(hand(80, 90), 0, p);
  c.update(hand(80, 90), 130, p);
  assert.equal(c.update(hand(80, 90), 150, p).fired, false);
  c.update(hand(80, 0), 170, p);
  assert.equal(c.update(hand(80, 90), 200, p).fired, true);
  assert.equal(c.update(hand(80, 90), 230, p).fired, false);
  c.update(hand(80, 0), 250, p);
  assert.equal(c.update(hand(80, 90), 280, p).fired, true);
});
test("open hand releases after confirmation; tracking loss never drops or shoots", () => {
  const c = new GripController();
  c.update(hand(), 0, profile);
  c.update(hand(), 130, profile);
  c.update(null, 150, profile);
  assert.equal(c.held, true);
  assert.equal(c.update(hand(80, 90), 500, profile).fired, false);
  c.update(hand(0), 520, profile);
  assert.equal(c.update(hand(0), 600, profile).dropped, false);
  assert.equal(c.update(hand(0), 750, profile).dropped, true);
});
test("lost frames and hand-label changes cannot complete an earlier pickup dwell", () => {
  const c = new GripController();
  c.update(hand(), 0, profile, "Right");
  c.update(null, 100, profile);
  assert.equal(c.update(hand(), 130, profile, "Right").held, false);
  assert.equal(c.update(hand(), 250, profile, "Left").held, false);
  assert.equal(c.update(hand(), 390, profile, "Left").held, true);
});
test("degenerate inputs cannot grip", () => {
  assert.equal(observation(Array(21).fill([0, 0, 0])), null);
  assert.equal(observation(hand().map((p) => p.map(() => NaN))), null);
});
test("the two supplied thumb poses are exact endpoints and cannot be exceeded", () => {
  const first = JSON.parse(
      readFileSync(new URL("./thumb-up-grip.json", import.meta.url)),
    ),
    p = structuredClone(profile);
  p.thumbOpen = Object.fromEntries(
    ["Thumb1", "Thumb2", "Thumb3"].map((n) => [n, first.angles[n]]),
  );
  for (const [input, expected] of [
    [-1, first.angles],
    [0, first.angles],
    [1, p.angles],
    [3, p.angles],
  ])
    for (const n of ["Thumb1", "Thumb2", "Thumb3"])
      assert.deepEqual(heldAngles(p, 0, input)[n], expected[n]);
  assert.deepEqual(validateProfile(JSON.parse(JSON.stringify(p))), p);
  for (let i = 0; i <= 100; i++)
    for (const n of ["Thumb1", "Thumb2", "Thumb3"])
      heldAngles(p, 0, i / 100)[n].forEach((v, k) =>
        assert.ok(
          v >= Math.min(p.thumbOpen[n][k], p.angles[n][k]) - 1e-8 &&
            v <= Math.max(p.thumbOpen[n][k], p.angles[n][k]) + 1e-8,
        ),
      );
});
