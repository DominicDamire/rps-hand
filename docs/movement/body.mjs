// The player's upper body in the movement map (for the owner: "copy the head, torso, neck and elbow movement
// from hands-lapse, put them together with our right hand, finish the upper-body tracking"):
//  - docs/avatar/RiggedAvatar.js + upper-body.glb: hands-lapse's connected 15-bone rig (pelvis, spine, chest, neck, head,
//    clavicles, upper arms, forearms, twist helpers), eyes glued to the camera, head hidden for the first-person camera
//    only (the mirror and the other player see the whole body);
//  - docs/body/BodyView.js: hands-lapse's upper-body tracker (MediaPipe Pose Lite in a worker, scheduled between the face
//    frames), shoulders / elbows / wrists / hips relative to the eyes in the player's frame;
//  - the head tracker's PHYSICAL yaw/pitch turn the neck and head (the camera keeps its gained look);
//  - the tracked right hand (hand-model.mjs) is the right arm's IK target, so the rig's forearm ends at our hand.
// The body faces the walking heading (head-look.mjs), which the rig applies as `facing`.
import * as THREE from "three";
import { RiggedAvatar } from "../avatar/RiggedAvatar.js?v=65";
import { BodyView } from "../body/BodyView.js?v=65";

const SKIN = 0xd9a58a;   // the hand model's colour, so the arm and the hand read as one body
const KEYS = ["leftShoulder", "rightShoulder", "leftHip", "rightHip", "leftElbow", "rightElbow", "leftWrist", "rightWrist"];

export function setupBody({ scene, camera, handModel, video }) {
  const Q = new URLSearchParams(location.search);
  if (Q.get("body") === "0") return null;
  const cur = { head: null };
  const box = document.createElement("div"); box.id = "bodyBox";
  box.style.cssText = "position:fixed;top:64px;left:16px;z-index:5;display:flex;gap:6px;align-items:center;padding:6px 10px;background:#101b25cc;border-radius:8px;font:12px system-ui,sans-serif;color:#dfe8f0";
  box.innerHTML = `<span>Body</span><select id="bodyMode" style="font:inherit"><option value="seated">seated</option><option value="standing">standing</option><option value="off">off</option></select><button id="bodyCal" type="button" style="font:inherit">Calibrate</button><span id="bodyStatus" style="color:#9fb3c8;max-width:46vw"></span>`;
  document.body.appendChild(box);
  const modeEl = box.querySelector("#bodyMode"), calEl = box.querySelector("#bodyCal"), statusEl = box.querySelector("#bodyStatus");
  const m = Q.get("body"); if (m === "standing" || m === "off") modeEl.value = m;
  // BodyView wants the face tracker's fields (it captures only between two finished face frames); the page's head tracker is
  // recreated on every Start, so read the current one through an adapter.
  const headAdapter = { camera, get mode() { return cur.head?.mode ?? "off"; }, get ready() { return !!cur.head?.ready; }, get busy() { return !!cur.head?.busy; },
    get completedFrames() { return cur.head?.completedFrames ?? 0; }, performance: { get latency() { return cur.head?.perf?.latency ?? 0; } } };
  let body = null, error = null;
  try { body = new BodyView(video, headAdapter, { mode: modeEl, status: statusEl, recenter: calEl }); } catch (e) { error = e; console.warn("body tracking unavailable:", e); statusEl.textContent = "body tracking unavailable"; }
  const avatar = new RiggedAvatar(scene, camera, null);
  avatar.ready.then(() => { for (const mesh of avatar.meshes) mesh.material.color.set(SKIN); }).catch(e => { error = e; console.warn("avatar unavailable:", e); });
  const _F = new THREE.Quaternion(), _Y = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _w = new THREE.Vector3(), joints = {};
  let last = null;   // what the rig was given this frame (for the HUD and probes)

  return {
    avatar, body, get error() { return error; }, get joints() { return last; },
    recenter() { body?.pose.recenter(modeEl.value); },
    update(dt, now, { head, heading }) {   // after the camera moved and turned, before the render
      cur.head = head;
      const raw = body ? body.update(now, dt) : null;   // eye-relative, player frame: x right, y up, -z toward the phone
      _F.setFromAxisAngle(_Y, heading || 0);
      let j = null;
      if (raw) { j = joints; for (const k of KEYS) { const p = raw[k]; j[k] = p ? _v.fromArray(p).applyQuaternion(_F).toArray() : null; } }   // into world axes: the body faces the heading
      if (handModel.visible && avatar.loaded) {   // our tracked right hand: the arm reaches to its wrist (the rig's forearm ends there when in reach)
        handModel.group.updateMatrixWorld(true);
        const src = handModel.override ? handModel.override() : handModel.points;   // holding the gun: the drawn (gripping) hand's wrist
        _w.copy(src[0]).applyMatrix4(handModel.group.matrixWorld).sub(camera.position);
        if (!j) { j = joints; for (const k of KEYS) j[k] = null; }
        j.rightWrist = _w.toArray();
        if (!j.rightElbow) j.rightElbow = _v.set(0.08, -0.25, 0.15).applyQuaternion(_F).add(_w).toArray();   // bend-plane guide: the elbow hangs below and behind the wrist
      }
      last = j;
      avatar.update(camera, head, j, true, Math.min(0.1, dt), heading || 0);
    },
  };
}
