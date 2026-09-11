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
import { DollRig, HEAD_LAYER } from "../doll/DollRig.js?v=72";
import { BodyView } from "../body/BodyView.js?v=72";
import { BodyPose } from "../body/pose.mjs?v=72";

const STEP = 0.42;          // metres of travel before the trailing foot swings through
const STEP_TIME = 0.28;     // seconds a step takes
const FOOT_SPREAD = 0.09;   // half the distance between the feet

export function setupBody({ scene, camera, handModel, video, getRemote = () => null }) {
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
      T.rotation.x = -thigh; K.rotation.x = knee; if (F) F.rotation.x = -knee * 0.45;
    }
  }

  let told = null, shownMode = null;
  return {
    rig, get error() { return error; },
    recenter() { (far || local?.pose)?.recenter(modeEl.value); phase = 0; gait = 0; lastPos = null; },
    wants() { return tracked(); }, get told() { return told; }, set told(v) { told = v; },

    update(dt, now, { head, heading = 0 } = {}) {
      cur.head = head;
      if (!rig.loaded) return;
      const mode = modeEl.value;
      rig.root.visible = mode !== "off";
      if (mode === "off") return;
      const link = getRemote();
      if (tracked()) { if (link && wired !== link) startFar(link); else if (!link && !local && !far && !error) startLocal(); }

      if (handModel && handModel.drawMesh !== false) handModel.drawMesh = false;   // the doll's own hand replaces it
      rig.reset();
      rig.placeEyes(camera.position, heading);

      // --- head -----------------------------------------------------------------------------------------------
      const p = head?.pose;
      if (p) rig.setHead({ pitch: p.physicalPitch || 0, yaw: p.physicalYaw || 0, roll: p.physicalRoll || 0 });

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
        rig.reach(`${S}UpperArm`, `${S}Forearm`, `${S}Hand`, _w, _e);
        setFingers(rig, S, src, handModel.group.matrixWorld);
      }
      if (raw) for (const S of ["L", "R"]) {
        if (handModel?.visible && (handModel.right ? "R" : "L") === S) continue;   // already driven, and better
        const wj = raw[S === "L" ? "leftWrist" : "rightWrist"], ej = raw[S === "L" ? "leftElbow" : "rightElbow"];
        if (!wj || !ej) continue;
        _w.fromArray(wj).applyAxisAngle(UP, heading).add(camera.position);
        _e.fromArray(ej).applyAxisAngle(UP, heading).add(camera.position);
        rig.reach(`${S}UpperArm`, `${S}Forearm`, `${S}Hand`, _w, _e);
      }

      // --- legs -------------------------------------------------------------------------------------------------
      if (mode !== "head") legs(dt, camera.position);
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
const FINGERS = [["Thumb", 1, 2, 3, 4], ["Index", 5, 6, 7, 8], ["Middle", 9, 10, 11, 12], ["Ring", 13, 14, 15, 16], ["Pinky", 17, 18, 19, 20]];
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();

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
      if (!rig.joints[`${S}${name}${k}`]) continue;
      const i0 = [a, b, c][k - 1], i1 = [b, c, d][k - 1];
      _p1.copy(pts[i0]).applyMatrix4(mat); _p2.copy(pts[i1]).applyMatrix4(mat);
      _d1.subVectors(_p2, _p1);
      const rest = fingerRest(rig, S, name, k);
      if (!rest || _d1.lengthSq() < 1e-8) continue;
      rig.aim(`${S}${name}${k}`, rest, _d1);
    }
  }
}
