import * as THREE from "three";

// v80 direction-based hand retargeting, with per-avatar calibration state.
export function createHandDriver(rig) {
const FINGERS = [["Thumb", 1, 2, 3, 4], ["Index", 5, 6, 7, 8], ["Middle", 9, 10, 11, 12], ["Ring", 13, 14, 15, 16], ["Pinky", 17, 18, 19, 20]];
const FI = [[0, 1], [1, 2], [2, 3]];   // which two of (a, b, c, d) each phalanx runs between, hoisted out of the frame loop
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _v2 = new THREE.Vector3();
// --- the palm ---------------------------------------------------------------------------------------------------
// The IK only decides where the wrist is. Without this the hand keeps whatever twist the forearm happened to end with,
// so the knuckles can sit 10 cm from the tracked ones even with every finger angle right. Build a frame from the
// tracked wrist, index knuckle and little-finger knuckle, build the same frame from the doll's own rest pose, and turn
// the hand by the rotation between them.
const _u = new THREE.Vector3(), _n2 = new THREE.Vector3(), _y = new THREE.Vector3();
const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4(), _qh = new THREE.Quaternion();
const restPalm = new Map();
function basis(out, o, a, b) {
  _u.subVectors(a, o); _v2.subVectors(b, o);
  _n2.crossVectors(_u, _v2);
  if (_u.lengthSq() < 1e-10 || _n2.lengthSq() < 1e-12) return null;
  _u.normalize(); _n2.normalize(); _y.crossVectors(_n2, _u).normalize();
  return out.makeBasis(_u, _y, _n2);
}
// The doll is stylised and its hands are small. Scale the hand (and with it every finger, since they hang off it) to
// the player's own hand the first time it is seen, so the knuckles land where the tracked ones are and the gun sits in
// a hand the right size for it. Clamped, so a bad frame cannot produce a giant hand.
const handScaled = new Set();
function fitHand(rig, S, pts, mat) {
  if (handScaled.has(S)) return;
  const length = (a, b) => _p1.copy(pts[a]).applyMatrix4(mat).distanceTo(_p2.copy(pts[b]).applyMatrix4(mat));
  const real = length(0, 9) + length(9, 10) + length(10, 11);
  const rest = rig.rest, hand = rig.joints[`${S}Hand`];
  const parentScale = hand.parent.matrixWorld.getMaxScaleOnAxis();
  const restLength = (a,b) => rest[a].world.distanceTo(rest[b].world);
  const mine = parentScale * (restLength(`${S}Hand`,`${S}Middle1`) + restLength(`${S}Middle1`,`${S}Middle2`) + restLength(`${S}Middle2`,`${S}Middle3`));
  if (!(real > 0.05 && real < 0.35) || !(mine > 0.02)) return;
  const k = Math.max(0.8, Math.min(1.8, real / mine));
  hand.scale.setScalar(k);
  // Use segment lengths rather than endpoint chords: a folded finger must not calibrate shorter.
  for (const [name, a, b, c] of FINGERS) {
    const j = rig.joints[`${S}${name}1`]; if (!j) continue;
    const yours = length(a,b) + length(b,c);
    const ours = parentScale * k * (restLength(`${S}${name}1`,`${S}${name}2`) + restLength(`${S}${name}2`,`${S}${name}3`));
    if (yours > 0.01 && ours > 0.005) j.scale.setScalar(Math.max(0.6, Math.min(2.2, yours / ours)));
  }
  handScaled.add(S);

}

// Where the knuckles sit across the palm is the doll's own geometry, and it is not yours: after scaling the hand and
// every finger, the knuckle joints themselves were still 4 cm from the tracked ones, and everything below them
// inherits that. Each knuckle is moved onto the tracked one, once, in the hand's own space. Calibrate undoes it.
const knuckled = new Set();
function fitKnuckles(rig, S, pts, mat) {
  if (knuckled.has(S)) return;
  const hand = rig.joints[`${S}Hand`]; if (!hand) return;
  rig.refresh(hand);
  _mB.copy(hand.matrixWorld).invert();
  let moved = 0;
  for (const [name, a] of FINGERS) {
    const j = rig.joints[`${S}${name}1`]; if (!j) continue;
    _p1.copy(pts[a]).applyMatrix4(mat).applyMatrix4(_mB);
    if (!Number.isFinite(_p1.x) || _p1.length() > 0.5) continue;   // a nonsense frame must not stick
    j.position.copy(_p1); rig.refresh(j); moved++;
  }
  if (moved === 5) knuckled.add(S);
}

function setPalm(rig, S, pts, mat) {
  const key = S;
  if (!restPalm.has(key)) {
    const m = new THREE.Matrix4();
    const ok = basis(m, rig.rest[`${S}Hand`].world, rig.rest[`${S}Index1`].world, rig.rest[`${S}Pinky1`].world);
    restPalm.set(key, ok ? m.clone().invert() : null);
  }
  const restInv = restPalm.get(key); if (!restInv) return;
  _p1.copy(pts[0]).applyMatrix4(mat); _p2.copy(pts[5]).applyMatrix4(mat); _p3.copy(pts[17]).applyMatrix4(mat);
  if (!basis(_mA, _p1, _p2, _p3)) return;
  _mB.multiplyMatrices(_mA, restInv);
  _qh.setFromRotationMatrix(_mB);
  rig.setWorldQuat(`${S}Hand`, _qh);
  rig.refresh(rig.joints[`${S}Hand`]);
}


/** curl the doll's fingers to match the tracked hand: each phalanx points where the tracked one points */
const restDirs = new Map();
function fingerRest(rig, S, name, k) {
  const key = `${S}${name}${k}`;
  if (restDirs.has(key)) return restDirs.get(key);
  const here = rig.rest[key]?.world, next = rig.rest[`${S}${name}${k + 1}`]?.world;
  // the last phalanx has no joint beyond it, so it carries on in the direction of the one before it
  const v = next ? new THREE.Vector3().subVectors(next, here)
                 : new THREE.Vector3().subVectors(rig.rest[`${S}${name}${k}`].world, rig.rest[`${S}${name}${k - 1}`].world);
  restDirs.set(key, v.lengthSq() > 1e-9 ? v.normalize() : null);
  return restDirs.get(key);
}
function setFingers(rig, S, pts, mat) {
  for (const [name, a, b, c, d] of FINGERS) {
    for (let k = 1; k <= 3; k++) {
      const j = rig.joints[`${S}${name}${k}`]; if (!j) continue;
      rig.refresh(j);   // its parent (the hand, or the phalanx before) has just been turned
      const i0 = FI[k - 1][0], i1 = FI[k - 1][1];
      _p1.copy(pts[i0 === 0 ? a : i0 === 1 ? b : c]).applyMatrix4(mat); _p2.copy(pts[i1 === 1 ? b : i1 === 2 ? c : d]).applyMatrix4(mat);
      _d1.subVectors(_p2, _p1);
      const rest = fingerRest(rig, S, name, k);
      if (!rest || _d1.lengthSq() < 1e-8) continue;
      rig.aim(`${S}${name}${k}`, rest, _d1);
    }
  }
}

  function reset() {
    handScaled.clear(); restPalm.clear(); restDirs.clear(); knuckled.clear();
    for (const S of ["L", "R"]) {
      rig.joints[`${S}Hand`]?.scale.setScalar(1);
      for (const [name] of FINGERS) for (let k=1;k<=3;k++) { const j=rig.joints[`${S}${name}${k}`]; if(j)j.quaternion.copy(rig.rest[j.name].localQ); }
      for (const [name] of FINGERS) {
        const j = rig.joints[`${S}${name}1`]; if (!j) continue;
        j.scale.setScalar(1);
        j.position.copy(rig.rest[j.name].world).sub(rig.rest[`${S}Hand`].world);
      }
    }
  }
  return { fitHand, setPalm, fitKnuckles, setFingers, reset };
}
