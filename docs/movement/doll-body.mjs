// The player's body in the map: the user's ball-joint doll, driven from the trackers.
//
// Replaces the old skinned upper-body avatar. What drives what:
//   eyes      <- the camera position, so the doll is always where the player is
//   body yaw  <- the walking heading (head-look.mjs), so it turns with you
//   neck/head <- the face tracker's physical angles, and its 3D position when the spatial fit is running
//   arms      <- two-bone IK to the tracked wrists: the right one from our own hand model (which is exact), the left
//                from the body tracker when it is on
//   fingers   <- the 21 hand landmarks, when that hand is being tracked
//   legs      <- feet planted on the floor while you are not walking, and a simple alternating stride when you are
//
// The doll's proportions are stylised (arm reach 0.47 m on a 1.75 m figure, where a person's is nearer 0.52), so wrist
// targets are taken as directions from the shoulder and the IK clamps the distance; the arm points the right way even
// when a real arm would be longer.
import * as THREE from "three";
import { DollRig, HEAD_LAYER } from "../doll/DollRig.js?v=76";
import { BodyView } from "../body/BodyView.js?v=76";
import { BodyPose } from "../body/pose.mjs?v=76";

const STEP = 0.42;          // metres of travel before the trailing foot swings through
const STEP_TIME = 0.28;     // seconds a step takes
const FOOT_SPREAD = 0.09;   // half the distance between the feet

export function setupBody({ scene, camera, handModel, handModelL = null, video, getRemote = () => null }) {
  const Q = new URLSearchParams(location.search);
  const mode0 = Q.get("body");
  if (mode0 === "off") return null;

  const box = document.createElement("div"); box.id = "bodyBox";
  box.style.cssText = "position:fixed;top:64px;left:16px;z-index:5;display:flex;gap:6px;align-items:center;padding:6px 10px;background:#101b25cc;border-radius:8px;font:12px system-ui,sans-serif;color:#dfe8f0";
  box.innerHTML = `<span>Body</span><select id="bodyMode" style="font:inherit"><option value="full">full body</option><option value="seated">seated + tracker</option><option value="standing">standing + tracker</option><option value="head">head only</option><option value="off">off</option></select><button id="bodyCal" type="button" style="font:inherit">Calibrate</button><span id="bodyStatus" style="color:#9fb3c8;max-width:46vw"></span>`;
  document.body.appendChild(box);
  const modeEl = box.querySelector("#bodyMode"), calEl = box.querySelector("#bodyCal"), statusEl = box.querySelector("#bodyStatus");
  if (["full", "seated", "standing", "head"].includes(mode0)) modeEl.value = mode0;
  const tracked = () => modeEl.value === "seated" || modeEl.value === "standing";

  const rig = new DollRig(scene);
  // The doll is stylised: its arms reach 0.470 m where a 1.75 m adult's reach about 0.52, so a hand held out at arm's
  // length - which is exactly where the gun is - was 5 cm beyond what the arm could reach and the wrist fell short by
  // that much, taking every finger with it. A 1.1 scale on each arm puts the reach at a human 0.517 m.
  const ARM_SCALE = +(new URLSearchParams(location.search).get("arm")) || 1.1;
  rig.ready.then(() => { for (const S of ["L", "R"]) rig.joints[`${S}UpperArm`].scale.setScalar(ARM_SCALE); });
  let error = null;
  rig.ready.catch(e => { error = e; console.warn("doll unavailable:", e); statusEl.textContent = "doll could not load"; });

  // the body tracker, local or over the phone link, only when a tracked mode is chosen
  const cur = { head: null };
  const headAdapter = { camera, get mode() { return cur.head?.mode ?? "off"; }, get ready() { return !!cur.head?.ready; },
    get busy() { return !!cur.head?.busy; }, get completedFrames() { return cur.head?.completedFrames ?? 0; },
    performance: { get latency() { return cur.head?.perf?.latency ?? 0; } } };
  let local = null, far = null, wired = null;
  const startLocal = () => { try { local = new BodyView(video, headAdapter, { mode: modeEl, status: statusEl, recenter: calEl }); } catch (e) { error = e; } };
  const startFar = link => { far = new BodyPose(modeEl.value); wired = link; link.onBody = s => far.receive(s, performance.now());
    modeEl.addEventListener("change", () => far.recenter(modeEl.value)); calEl.addEventListener("click", () => far.recenter(modeEl.value)); };

  // --- legs ----------------------------------------------------------------------------------------------------
  // Standing still, the doll's own rest pose already has both feet flat on the floor, so the legs are simply left
  // alone: nothing to drift, nothing to solve (owner: "the body and feet can just stay on the ground as long as the
  // joystick has not been moved"). Walking advances a stride whose phase is driven by the distance actually covered,
  // so the legs keep pace with the map rather than with a timer, and it eases back to standing when you stop.
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _h = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3();
  const STRIDE = 0.75;        // metres of travel per full two-step cycle
  const THIGH_SWING = 0.42;   // radians
  const KNEE_BEND = 0.55;
  let phase = 0, gait = 0, lastPos = null;

  function legs(dt, pos) {
    if (!lastPos) { lastPos = pos.clone(); return; }
    const moved = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z);
    lastPos.copy(pos);
    const speed = moved / Math.max(1e-3, dt);
    gait += (Math.min(1, speed / 1.2) - gait) * Math.min(1, dt * 6);   // how much of the walk to show
    phase += (moved / STRIDE) * Math.PI * 2;
    if (gait < 0.02) { gait = 0; return; }                             // standing: leave the rest pose exactly alone
    for (const [S, sign] of [["L", 1], ["R", -1]]) {
      const a = phase * sign;
      const thigh = Math.sin(a) * THIGH_SWING * gait;
      const knee = Math.max(0, -Math.sin(a - 0.6)) * KNEE_BEND * gait;
      const T = rig.joints[`${S}Thigh`], K = rig.joints[`${S}Shin`], F = rig.joints[`${S}Foot`];
      if (!T) continue;
      // A positive rotation here swings the shin FORWARD, which is a knee bending backwards. It is negative, and
      // clamped so it can never cross zero however the phase is tuned later.
      T.rotation.x = -thigh;
      K.rotation.x = -Math.min(KNEE_BEND, Math.max(0, knee));
      if (F) F.rotation.x = knee * 0.45;
    }
  }

  let told = null, shownMode = null, neutral = null;
  const lean = new THREE.Vector3();
  return {
    rig, get error() { return error; },
    recenter() {
      (far || local?.pose)?.recenter(modeEl.value);
      phase = 0; gait = 0; lastPos = null; neutral = null; lean.set(0, 0, 0);
      handScaled.clear(); restPalm.clear(); restDirs.clear();   // one bad first frame is no longer permanent
      for (const S of ["L", "R"]) rig.joints?.[`${S}Hand`]?.scale.setScalar(1);
    },
    wants() { return tracked(); }, get told() { return told; }, set told(v) { told = v; },

    update(dt, now, { head, heading = 0 } = {}) {
      cur.head = head;
      if (!rig.loaded) return;
      const mode = modeEl.value;
      rig.root.visible = mode !== "off";
      // the doll's hand replaces the old mesh only while the doll is actually drawing one
      const drawOld = (mode === "off" || mode === "head"); if (handModel) handModel.drawMesh = drawOld; if (handModelL) handModelL.drawMesh = drawOld;
      if (mode === "off") return;
      const link = getRemote();
      if (tracked()) { if (link && wired !== link) startFar(link); else if (!link && !local && !far && !error) startLocal(); }

      // Every channel below is set absolutely, so there is nothing to clear: dropping the per-frame reset means a
      // tracker that misses a frame leaves the limb where it was instead of the whole body snapping to rest.
      rig.placeEyes(camera.position, heading);

      // --- head and the lean under it ---------------------------------------------------------------------------
      const p = head?.pose;
      if (p) rig.setHead({ pitch: p.physicalPitch || 0, yaw: p.physicalYaw || 0, roll: p.physicalRoll || 0, facing: heading });
      // The doll's eyes are pinned to the camera, so the way to show the head moving through space is to lean the body
      // under it (owner: "the head can move in 3D plane space"). The face tracker gives where the head is in the
      // picture and how far away it is; the offset from where it started becomes a lean at the waist and the chest.
      const L = head?.latest;
      if (L && L.span > 0) {
        const asp = (video?.videoWidth / video?.videoHeight) || 4 / 3;
        const f = 1 / (2 * Math.tan(60 * Math.PI / 360)), d = Math.min(2, Math.max(0.18, f * 0.09 / L.span));
        _v.set((L.centerX - 0.5) * d / f, -(L.centerY - 0.5) * d / (f * asp), d);
        if (!neutral) neutral = _v.clone();
        lean.lerp(_t.set(_v.x - neutral.x, _v.y - neutral.y, _v.z - neutral.z), Math.min(1, dt * 8));
      }
      for (const [name, k] of LEAN_JOINTS) {
        const j = rig.joints[name]; if (!j) continue;
        j.rotation.z = THREE.MathUtils.clamp(-lean.x * 1.6, -0.35, 0.35) * k;      // sway sideways
        j.rotation.x = THREE.MathUtils.clamp(-lean.y * 1.6, -0.35, 0.35) * k;      // lean forward and back
        rig.refresh(j);
      }

      // --- body from the pose tracker ---------------------------------------------------------------------------
      const raw = !tracked() ? null : far ? far.update(now, dt, true, camera.position.toArray()) : local ? local.update(now, dt) : null;
      statusEl.textContent = !tracked() ? (mode === "head" ? "Head only" : "Full body · arms follow your hand")
        : raw ? `Body · ${mode}` : "Body tracker: hold a relaxed pose";

      // --- arms -------------------------------------------------------------------------------------------------
      // the right wrist comes from our own hand model when it is visible: it is the most accurate thing we have
      if (handModel?.visible) {
        handModel.group.updateMatrixWorld(true);
        const src = handModel.override ? handModel.override() : handModel.points;
        _w.copy(src[0]).applyMatrix4(handModel.group.matrixWorld);
        const S = handModel.right ? "R" : "L";
        _e.copy(_w).add(_v.set(handModel.right ? 0.22 : -0.22, -0.2, 0.12).applyAxisAngle(UP, heading));
        // the arm sits under the chest, which the lean just moved: bring the chain up to date first
        for (const n of ["Hips", "Waist", "Chest", `${S}Clavicle`]) rig.refresh(rig.joints[n]);
        rig.reach(`${S}UpperArm`, `${S}Forearm`, `${S}Hand`, _w, _e);
        rig.refresh(rig.joints[`${S}Hand`]);
        fitHand(rig, S, src, handModel.group.matrixWorld);
        setPalm(rig, S, src, handModel.group.matrixWorld);
        setFingers(rig, S, src, handModel.group.matrixWorld);
      }
      // the steering hand: same treatment, it is a tracked hand like the other (owner: "make the left hand appear too")
      if (handModelL?.visible) {
        handModelL.group.updateMatrixWorld(true);
        const srcL = handModelL.points, SL = handModelL.right ? "R" : "L";
        if (!(handModel?.visible && (handModel.right ? "R" : "L") === SL)) {   // never two hands on one arm
          _w.copy(srcL[0]).applyMatrix4(handModelL.group.matrixWorld);
          _e.copy(_w).add(_v.set(SL === "R" ? 0.22 : -0.22, -0.2, 0.12).applyAxisAngle(UP, heading));
          for (const n of ["Hips", "Waist", "Chest", `${SL}Clavicle`]) rig.refresh(rig.joints[n]);
          rig.reach(`${SL}UpperArm`, `${SL}Forearm`, `${SL}Hand`, _w, _e);
          rig.refresh(rig.joints[`${SL}Hand`]);
          fitHand(rig, SL, srcL, handModelL.group.matrixWorld);
          setPalm(rig, SL, srcL, handModelL.group.matrixWorld);
          setFingers(rig, SL, srcL, handModelL.group.matrixWorld);
        }
      }
      if (raw) for (const S of ["L", "R"]) {
        if (handModel?.visible && (handModel.right ? "R" : "L") === S) continue;   // already driven, and better
        const wj = raw[S === "L" ? "leftWrist" : "rightWrist"], ej = raw[S === "L" ? "leftElbow" : "rightElbow"];
        if (!wj || !ej) continue;
        _w.fromArray(wj).applyAxisAngle(UP, heading).add(camera.position);
        _e.fromArray(ej).applyAxisAngle(UP, heading).add(camera.position);
        for (const n of ["Hips", "Waist", "Chest", `${S}Clavicle`]) rig.refresh(rig.joints[n]);
        rig.reach(`${S}UpperArm`, `${S}Forearm`, `${S}Hand`, _w, _e);
      }

      // --- legs -------------------------------------------------------------------------------------------------
      if (mode !== "head") legs(dt, camera.position);
      rig.pinEyes(camera.position);   // after the lean, the head and the arms have moved things
      rig.root.updateMatrixWorld(true);   // the one full tree update this frame
      if (shownMode !== mode) {   // "head only" hides the body; the head itself is always on its own layer, so a
        shownMode = mode;         // first-person camera never sees it from the inside while the mirror still does
        for (const m of rig.parts) {
          const isHead = m.name.startsWith("Head") || m.name.startsWith("Neck");
          m.visible = isHead || mode !== "head";
        }
      }
      rig.root.updateMatrixWorld(true);
    },
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const LEAN_JOINTS = [["Waist", 0.5], ["Chest", 0.5]];
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
  _p1.copy(pts[0]).applyMatrix4(mat); _p2.copy(pts[9]).applyMatrix4(mat); _p3.copy(pts[12]).applyMatrix4(mat);
  const real = _p1.distanceTo(_p2) + _p2.distanceTo(_p3);
  // measured live, so any scale already applied to the arm is included
  rig.root.updateMatrixWorld(true);   // once, the first time only
  const P = n => rig.joints[n].getWorldPosition(new THREE.Vector3());
  const h = P(`${S}Hand`), m1 = P(`${S}Middle1`), m3 = P(`${S}Middle3`);
  const mine = h.distanceTo(m1) + m1.distanceTo(m3);
  if (!(real > 0.05 && real < 0.35) || !(mine > 0.02)) return;
  const k = Math.max(0.8, Math.min(1.8, real / mine));
  rig.joints[`${S}Hand`].scale.setScalar(k);
  handScaled.add(S);
  console.info(`doll: ${S} hand scaled x${k.toFixed(2)} (yours ${real.toFixed(3)} m, the doll's ${mine.toFixed(3)} m)`);
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
