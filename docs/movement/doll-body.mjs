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
import { DollRig, HEAD_LAYER } from "../doll/DollRig.js?v=77";
import { BodyView } from "../body/BodyView.js?v=77";
import { BodyPose } from "../body/pose.mjs?v=77";

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

  // --- legs ------------------------------------------------------------------------------------------------------
  // A real gait, not a sine on the hip angles. One foot is always planted on a fixed point of the floor; the other
  // swings along an arc to the next contact, and both legs are solved to their foot with the same two-bone IK the arms
  // use. That is the only way the feet stop treading air: the previous version rotated the thigh and knee on a sine
  // and never referenced the floor at all, so for most of the cycle neither foot was near it.
  // Standing still, both feet ease back under the hips and stay there (owner: "the feet can just stay on the ground
  // as long as the joystick has not been moved").
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _hint = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3();
  const STEP_LEN = 0.42;      // metres of travel between footfalls
  const STEP_TIME = 0.26;     // seconds a swing takes
  const LIFT = 0.08;          // how high the swinging foot clears the floor
  const SPREAD = 0.085;       // half the distance between the feet
  const EYE_H = 1.65;         // the map holds the camera this far above the floor
  const contact = [new THREE.Vector3(), new THREE.Vector3()];   // world, where each foot is standing
  const swingFrom = new THREE.Vector3(), swingTo = new THREE.Vector3(), _foot = new THREE.Vector3();
  let placed = false, swing = -1, swingT = 0, travelled = 0, gait = 0, lastPos = null, ankleH = 0.23, crouch = 0;
  // Measured: at rest this doll's thigh-to-ankle gap is 0.819 m and its leg is 0.817 m - the knees are locked straight
  // with no slack at all, so a stride of any length puts the foot out of reach and it floats. A person solves this by
  // dropping their hips as they walk; so does this. The eyes are pinned a few centimetres lower while walking, which
  // bends the knees and lets the planted foot stay on the floor. Invisible from the player's own eyes.
  const CROUCH = 0.055;

  const restFoot = (out, i, pos, yaw) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw), side = i ? SPREAD : -SPREAD;
    return out.set(pos.x + c * side, pos.y - EYE_H, pos.z - sn * side);
  };

  function legs(dt, pos, yaw) {
    const floor = pos.y - EYE_H;
    if (!placed) { for (const i of [0, 1]) restFoot(contact[i], i, pos, yaw); placed = true; lastPos = pos.clone(); ankleH = rig.rest.RFoot.world.y; }
    const moved = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z);
    lastPos.copy(pos);
    gait += (Math.min(1, (moved / Math.max(1e-3, dt)) / 1.2) - gait) * Math.min(1, dt * 6);
    crouch += (gait * CROUCH - crouch) * Math.min(1, dt * 5);

    if (gait < 0.03 && swing < 0) {                       // standing: settle both feet under the hips
      for (const i of [0, 1]) contact[i].lerp(restFoot(_t, i, pos, yaw), Math.min(1, dt * 5));
      travelled = 0;
    } else {
      travelled += moved;
      // Step when the travel says so OR when the planted foot is about to go out of the leg's reach - without the
      // second test the player walks away from their own foot, the IK clamps, and the foot floats above the floor.
      const legLen = rig.rest.RShin.world.distanceTo(rig.rest.RThigh.world) + rig.rest.RFoot.world.distanceTo(rig.rest.RShin.world);
      const hipY = pos.y - EYE_H + rig.rest.Hips.world.y;
      const thighY = pos.y - EYE_H + rig.rest.RThigh.world.y - crouch;
      const stretched = i => Math.hypot(contact[i].x - pos.x, contact[i].z - pos.z, thighY - (pos.y - EYE_H + ankleH)) > legLen * 0.95;
      if (swing < 0 && (travelled >= STEP_LEN * (0.45 + 0.35 * gait) || stretched(0) || stretched(1))) {
        swing = contact[0].distanceTo(pos) > contact[1].distanceTo(pos) ? 0 : 1;   // the foot furthest behind swings
        swingFrom.copy(contact[swing]);
        // land it ahead of the player, along the way they are actually travelling
        restFoot(swingTo, swing, pos, yaw);
        const dx = pos.x - swingFrom.x, dz = pos.z - swingFrom.z, len = Math.hypot(dx, dz) || 1;
        swingTo.x += dx / len * STEP_LEN * 0.5; swingTo.z += dz / len * STEP_LEN * 0.5;   // land ahead, so the stance phase is centred under the hips
        swingT = 0; travelled = 0;
      }
      if (swing >= 0) {
        swingT += dt / STEP_TIME;
        const t = Math.min(1, swingT);
        contact[swing].lerpVectors(swingFrom, swingTo, t * t * (3 - 2 * t));
        if (t >= 1) swing = -1;
      }
    }

    for (const [S, i] of [["L", 0], ["R", 1]]) {
      _foot.copy(contact[i]); _foot.y = floor + ankleH;
      if (swing === i && swingT < 1) _foot.y += Math.sin(Math.min(1, swingT) * Math.PI) * LIFT;
      // the knee leads forward, and never the other way: that is what stops the leg inverting
      _hint.copy(rig.joints[`${S}Thigh`].getWorldPosition(_t));
      _hint.x -= Math.sin(yaw) * 0.6; _hint.z -= Math.cos(yaw) * 0.6; _hint.y -= 0.25;
      for (const n of ["Hips", `${S}Thigh`]) rig.refresh(rig.joints[n]);
      rig.reach(`${S}Thigh`, `${S}Shin`, `${S}Foot`, _foot, _hint);
    }
  }

  const bodyCrouch = () => crouch;
  const _crouched = new THREE.Vector3();

  /** everything the walk test needs to see: heights, which foot swings, and how far each contact is from the hip */
  function walkDebug(pos) {
    const floor = pos.y - EYE_H;
    const hip = rig.joints.Hips.getWorldPosition(new THREE.Vector3());
    return {
      h: ["L", "R"].map(S => +(rig.joints[`${S}Foot`].getWorldPosition(_t).y - floor - ankleH).toFixed(3)),
      target: [0, 1].map(i => +(contact[i].y - floor).toFixed(3)),
      fromThigh: [0, 1].map(i => +rig.joints[i ? "RThigh" : "LThigh"].getWorldPosition(_v).distanceTo(contact[i]).toFixed(3)),
      crouch: +crouch.toFixed(3),
      legLen: +(rig.joints.RShin.getWorldPosition(_t).distanceTo(rig.joints.RThigh.getWorldPosition(_v))
              + rig.joints.RFoot.getWorldPosition(_t).distanceTo(rig.joints.RShin.getWorldPosition(_v))).toFixed(3),
      swing, gait: +gait.toFixed(2), ankleH: +ankleH.toFixed(3),
    };
  }

  /** how far each ankle is from the floor it should be standing on - used by the walk test */
  function footHeights(pos) {
    const floor = pos.y - EYE_H;
    return ["L", "R"].map(S => +(rig.joints[`${S}Foot`].getWorldPosition(_t).y - floor - ankleH).toFixed(4));
  }

  let told = null, shownMode = null, neutral = null;
  const lean = new THREE.Vector3();
  return {
    rig, get error() { return error; }, footHeights: () => footHeights(camera.position), walkDebug: () => walkDebug(camera.position), get gait() { return gait; },
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
      // The eyes are pinned BEFORE the legs are solved: pinning afterwards dragged the planted foot down with
      // the root and sank it 2 cm into the floor.
      _crouched.copy(camera.position); _crouched.y -= bodyCrouch();   // the walk's hip drop, so the legs have slack
      rig.pinEyes(_crouched);
      if (mode !== "head") {
        legs(dt, camera.position, heading);
        // an arm that nothing is tracking swings with the opposite leg, which is what a person does
        for (const S of ["L", "R"]) {
          const driven = (handModel?.visible && (handModel.right ? "R" : "L") === S) || (handModelL?.visible && (handModelL.right ? "R" : "L") === S);
          if (driven || gait < 0.03) continue;
          const a = rig.joints[`${S}UpperArm`], f = rig.joints[`${S}Forearm`];
          const sw = Math.sin(travelled / STEP_LEN * Math.PI + (S === "L" ? Math.PI : 0)) * 0.22 * gait;
          if (a) { a.rotation.x = sw; rig.refresh(a); }
          if (f) { f.rotation.x = -0.12 - Math.abs(sw) * 0.5; rig.refresh(f); }
        }
      }
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
