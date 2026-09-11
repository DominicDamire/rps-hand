// The shooting range inside the movement map: a bar-height table with the pistol, cans and ring targets in front of
// the spawn, a mirror to the front-left, and a body under the camera so the mirror shows a person. The tracked right
// hand (hand-model.mjs, a child of the camera) picks the gun up, aims and fires through docs/gun.mjs; while the gun
// is held the hand is drawn in the gripping pose (hand-model's `override`). Added for the owner
// ("take v62, add a table, a gun, a shooting range and a mirror"); docs/movement otherwise stays as it was.
import * as THREE from "three";
import { Reflector } from "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/objects/Reflector.js";
import { makeGun, fingersUp } from "../gun.mjs";

const TABLE_H = 1.3;   // table top above the floor: the tracked hand sits at chest height in front of the eye (1.65 m)

export function setupShooter({ scene, camera, dustMap, handModel, hud }) {
  const Q = new URLSearchParams(location.search);
  if (Q.get("gun") === "0") return null;
  let gun = null, mirror = null, error = null;
  if (!hud) { const d = document.createElement("div"); d.id = "gunHud"; d.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);padding:6px 12px;background:#101b25cc;border-radius:8px;font:12px monospace;color:#ffdf75;pointer-events:none;z-index:5"; document.body.appendChild(d); hud = t => { d.textContent = t; }; }
  const body = new THREE.Group(); scene.add(body);   // the player's own body: shows in the mirror, and when you look down
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a58a, roughness: 0.7 });
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.05, 4, 10), new THREE.MeshStandardMaterial({ color: 0x3b4a5c, roughness: 0.8 })); trunk.position.y = -0.95; body.add(trunk);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); body.add(head);   // at the eye: seen from inside, so invisible to the player, visible in the mirror
  }
  const _inv = new THREE.Matrix4(), _fwd = new THREE.Vector3(), pts = Array.from({ length: 21 }, () => new THREE.Vector3());
  const hand = { key: "R", group: handModel.group, pts, right: true, ext: [true, true, true, true] };

  async function build() {   // once the map is there: the range in front of the spawn, the mirror front-left
    const spawn = dustMap.spawn.clone(), floor = spawn.y - dustMap.eye;
    const tableZ = spawn.z - 0.75, tableFloor = dustMap.floor(spawn.x, tableZ, floor + 1) ?? floor;
    gun = await makeGun({ scene, worldObjs: dustMap.meshes, floorY: tableFloor, url: new URL("../gun.glb", import.meta.url).href,
      place: { pos: new THREE.Vector3(spawn.x, tableFloor + TABLE_H, tableZ), yaw: 0 }, hold: Q.has("grab") });
    const mw = 8, mh = 4;   // a wall-sized mirror (owner: "much bigger, like 15 times" - about 15x the old 1.1 x 2.0 m area), 6.4 m to the front-left, facing the spawn: the whole body fits with room to walk
    mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { clipBias: 0.003, textureWidth: 1024, textureHeight: 512, color: 0xb8c4cc });
    const mx = spawn.x - 4.5, mz = spawn.z - 4.5, mfloor = dustMap.floor(mx, mz, floor + 1) ?? floor;   // measured (probe_map.py): flat floor there, nearest wall 19 m away, no ceiling
    mirror.position.set(mx, mfloor + mh / 2, mz); mirror.lookAt(spawn.x, mfloor + mh / 2, spawn.z); scene.add(mirror);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(mw + 0.3, mh + 0.3, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6 }));   // a 15 cm border: visible from 6 m
    frame.position.copy(mirror.position); frame.quaternion.copy(mirror.quaternion); frame.translateZ(-0.045); scene.add(frame);
  }
  const ready = dustMap.ready ? build() : new Promise(res => { const t = setInterval(() => { if (dustMap.ready) { clearInterval(t); res(build()); } }, 200); });
  ready.catch(e => { error = e; console.warn("shooter unavailable:", e); });

  return {
    ready, get gun() { return gun; }, get mirror() { return mirror; },
    update(dt, now) {
      body.position.copy(camera.position); body.rotation.set(0, camera.rotation.y, 0);
      if (!gun) return;
      const shown = handModel.visible;
      if (shown) {
        handModel.group.updateMatrixWorld(true);
        for (let i = 0; i < 21; i++) pts[i].copy(handModel.points[i]).applyMatrix4(handModel.group.matrixWorld);   // the phone-frame points into the world
        hand.right = handModel.right; const ext = fingersUp(pts); for (let i = 0; i < 4; i++) hand.ext[i] = ext[i];
      }
      gun.update(dt, shown ? [hand] : [], now, camera);
      const held = gun.state.mode === "held" && gun.state.holder === "R";
      handModel.override = held ? () => { _inv.copy(handModel.group.matrixWorld).invert(); return gun.handPose(hand, _inv); } : null;   // the gripping pose, in the hand group's frame
      if (hud) hud(gun.hud());
    },
  };
}
