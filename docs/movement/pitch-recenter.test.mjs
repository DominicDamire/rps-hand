import test from "node:test"; import assert from "node:assert/strict";
import { HeadLook } from "./head-look.mjs";
test("with recenterPitch on, a lost face eases the view level again", () => {
  const h = new HeadLook(); h.recenterPitch = true;
  h.updatePitch(-0.6, 0.1, true); h.updatePitch(-0.6, 0.1, true); h.updatePitch(-0.6, 0.1, true);
  const looking = h.pitch;
  assert.ok(looking < -0.1, "looking down first, got " + looking);
  for (let i = 0; i < 30; i++) h.updatePitch(NaN, 0.1, false);
  assert.ok(Math.abs(h.pitch) < Math.abs(looking) * 0.15, "eased back to level, got " + h.pitch);
});
test("off by default it holds, which is the original rule", () => {
  const h = new HeadLook();
  h.updatePitch(-0.6, 0.1, true); h.updatePitch(-0.6, 0.1, true);
  const held = h.pitch;
  for (let i = 0; i < 30; i++) h.updatePitch(NaN, 0.1, false);
  assert.equal(h.pitch, held);
});
