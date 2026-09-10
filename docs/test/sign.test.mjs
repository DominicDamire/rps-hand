// Sign check of the head -> first-person camera mapping (INTEGRATION.md 2.2 / 3.8 item 3): a synthetic face turned to
// the user's right must give a camera forward vector with x < 0 in the rps_hand true frame (the user faces +z, so the
// user's right is -x); looking up must give forward y > 0. Checked through both facePose (the plane prior) and fitHead.
import assert from 'node:assert/strict';
import { facePose, ViewPose, firstPersonForward, firstPersonRotation } from '../head/pose.mjs';
import { template, project, fitHead } from '../head/spatial.mjs';

// pose.test.mjs's synthetic face: cheeks 234/454, forehead/chin 10/152 rotated by yaw about y and pitch about x
const mesh = (yaw = 0, pitch = 0, aspect = 4 / 3) => {
  const p = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const [i, x, y] of [[234, -.15, 0], [454, .15, 0], [10, 0, -.2], [152, 0, .2]]) {
    const yy = y * Math.cos(pitch), z = y * Math.sin(pitch);
    p[i] = { x: .5 + x * Math.cos(yaw) + z * Math.sin(yaw), y: .5 + yy * aspect, z: -x * Math.sin(yaw) + z * Math.cos(yaw) };
  }
  return p;
};
const neutral = facePose(mesh());
assert.ok(facePose(mesh(.3)).yaw > 0, 'plane yaw > 0 = the into-head axis tilts to image right = the user turned right');
const v = new ViewPose(); v.mode = 'first'; v.sensitivity = 1;
v.receive(neutral, 0); v.receive(facePose(mesh(.3)), 100);
for (let i = 0; i < 40; i++) v.update(100, .1);
assert.ok(v.physicalYaw < 0 && v.yaw < 0, 'right turn -> negative physicalYaw');
let f = firstPersonForward(v.yaw, v.pitch);
assert.ok(f[0] < 0 && f[2] > 0, `right turn: forward x < 0, still ahead (+z): ${f}`);
assert.deepEqual(firstPersonRotation(0, 0, 0), [0, Math.PI, 0]);
f = firstPersonForward(0, 0, 0); assert.ok(Math.abs(f[0]) < 1e-12 && Math.abs(f[2] - 1) < 1e-12, 'neutral looks straight at the phone (+z)');
// nav yaw composes the same way as the hands (applyAxisAngle(y, nav.yaw)): forward = (sin(navYaw), 0, cos(navYaw))
f = firstPersonForward(0, 0, .4); assert.ok(Math.abs(f[0] - Math.sin(.4)) < 1e-12 && Math.abs(f[2] - Math.cos(.4)) < 1e-12);

// The same through fitHead on a projected template (spatial.test.mjs's fixture), yaw about y and pitch about x
const aspect = 4 / 3, focal = 1 / (2 * Math.tan(Math.PI / 6));
function fixture(parameters) {
  const points = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const { id, point } of template) { const uv = project(point, parameters, focal); points[id] = { x: uv[0] + .5, y: uv[1] * aspect + .5, z: 0 }; }
  return points;
}
const fit = (rx, ry) => {
  const p = [rx, ry, 0, 0, 0, .6], prior = { yaw: ry, pitch: -rx, span: focal * .09 / p[5], centerX: .5, centerY: .5 };
  const r = fitHead(fixture(p), aspect, prior, Math.PI / 3, null); assert.ok(r); return r;
};
const centre = fit(0, 0), right = fit(0, .3), up = fit(-.25, 0);
assert.ok(Math.abs(centre.yaw) < 1e-6 && Math.abs(centre.pitch) < 1e-6);
assert.ok(right.yaw > .29, 'fitHead yaw > 0 for a right turn');
assert.ok(up.pitch > .2, 'fitHead pitch > 0 for looking up');
const w = new ViewPose(); w.mode = 'first'; w.sensitivity = 1; w.receive(centre, 0); w.receive({ ...right, pitch: up.pitch }, 100);
for (let i = 0; i < 40; i++) w.update(100, .1);
f = firstPersonForward(w.yaw, w.pitch);
assert.ok(f[0] < 0 && f[1] > 0 && f[2] > 0, `fitHead right+up turn: forward ${f}`);
// camera frame -> true GL frame is (x, -y, -z): a head 0.5 m in front of the phone sits at z = -0.5 like the hands
const camToGL3 = p => [p[0], -p[1], -p[2]];
const g = camToGL3(centre.position); assert.ok(Math.abs(g[0]) < 1e-6 && Math.abs(g[1]) < 1e-6 && Math.abs(g[2] + .6) < 1e-6, `GL ${g}`);
console.log('PASS: right turn -> forward x < 0, up -> forward y > 0, nav yaw composition, camera->GL sign');
