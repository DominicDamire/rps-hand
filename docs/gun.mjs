// A pistol on a table that a tracked hand can pick up and fire.
//   pick up: close the hand (middle, ring, pinky curled) within GRAB_R of the grip
//   fire:    with the gun held, curl the index finger (straight -> bent past FIRE_ON degrees at the middle knuckle)
//   drop:    open the hand (middle, ring, pinky extended); the gun falls to the table or the floor
// The gun is a child of the holding hand's group while held (so it is drawn with that hand's camera in first person) and a
// room object (worldObjs) otherwise. Shots: muzzle flash + light, slide and muzzle kick, a synthesized bang, a bullet mark
// where the ray from the muzzle hits the room.
import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/loaders/GLTFLoader.js";

const GRAB_R = 0.12;        // metres from the palm centre to the grip to pick the gun up
const FIRE_ON = 55, FIRE_OFF = 35;   // index middle-knuckle bend (degrees) that fires / re-arms the trigger
const GRIP = new THREE.Vector3(0, 0.045, 0.062);          // grip centre, gun space (y up, barrel -z)
const GRIP_UP = new THREE.Vector3(0, 0.96, -0.28).normalize();   // grip axis toward the slide (raked back)
const BARREL = new THREE.Vector3(0, 0, -1);
const MUZZLE = new THREE.Vector3(0, 0.124, -0.16);
const V = () => new THREE.Vector3();

export async function makeGun({ scene, worldGroup, worldObjs, floorY, right = true, url = "gun.glb", tableY = -0.14, tableZ = -0.3, hold = false }) {
  // --- table --------------------------------------------------------------------------------------------------
  const table = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.75 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.6), wood); top.position.set(0, tableY - 0.02, tableZ); top.receiveShadow = true; top.castShadow = true; table.add(top);
  for (const [x, z] of [[-0.42, tableZ - 0.27], [0.42, tableZ - 0.27], [-0.42, tableZ + 0.27], [0.42, tableZ + 0.27]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, tableY - 0.04 - floorY, 0.04), wood); leg.position.set(x, (tableY - 0.04 + floorY) / 2, z); leg.castShadow = true; table.add(leg);
  }
  scene.add(table); worldObjs.push(table);
  const marks = new THREE.Group(); scene.add(marks); worldObjs.push(marks);
  const targets = [...worldObjs.filter(o => o !== marks && o !== table), top];   // what bullets can hit

  // --- the pistol ---------------------------------------------------------------------------------------------
  const gltf = await new GLTFLoader().loadAsync(url);
  const gun = gltf.scene; gun.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.8; } } });
  for (const nm of ["Bullet_low", "Catridge_low"]) { const o = gun.getObjectByName(nm); if (o) o.visible = false; }   // the model's loose display cartridge
  const slide = gun.getObjectByName("Slide_low"), slide0 = slide ? slide.position.clone() : null;
  const REST = { pos: new THREE.Vector3(0, tableY + 0.016, tableZ - 0.02), quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI) };   // standing on the magazine, barrel toward the phone
  gun.position.copy(REST.pos); gun.quaternion.copy(REST.quat); worldGroup.add(gun); worldObjs.push(gun);

  // muzzle flash: additive sprite + a short light
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, "rgba(255,255,230,1)"); grad.addColorStop(0.25, "rgba(255,200,90,0.9)"); grad.addColorStop(0.6, "rgba(255,120,30,0.35)"); grad.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const flashTex = new THREE.CanvasTexture(c); flashTex.colorSpace = THREE.SRGBColorSpace;
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flash.scale.setScalar(0.09); flash.visible = false; gun.add(flash); flash.position.copy(MUZZLE);
  const light = new THREE.PointLight(0xffb060, 0, 0.9, 2); scene.add(light);
  const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.8 })); tracer.visible = false; scene.add(tracer); worldObjs.push(tracer);
  const markGeo = new THREE.CircleGeometry(0.012, 12), markMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });

  // --- sound: a synthesized bang (WebAudio needs a user tap first; silent until then) --------------------------
  let actx = null;
  const unlock = () => { try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) { actx = null; } };
  addEventListener("pointerdown", unlock, { passive: true });
  function bang() {
    if (!actx || actx.state !== "running") return;
    const t = actx.currentTime, out = actx.destination;
    const n = actx.sampleRate * 0.25, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (actx.sampleRate * 0.045));
    const src = actx.createBufferSource(); src.buffer = buf;
    const lp = actx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const gn = actx.createGain(); gn.gain.setValueAtTime(0.7, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(lp).connect(gn).connect(out); src.start(t); src.stop(t + 0.3);
    const osc = actx.createOscillator(), og = actx.createGain(); osc.type = "sine"; osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15); osc.connect(og).connect(out); osc.start(t); osc.stop(t + 0.16);
  }

  // --- state ---------------------------------------------------------------------------------------------------
  const st = { mode: "rest", holder: null, armed: true, shots: 0, kick: 0, slideT: 1, flashT: 0, lastSeen: 0, cool: 0, vel: V(), grabHand: null };
  const ray = new THREE.Raycaster(); ray.far = 8;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _kq = new THREE.Quaternion(), _c = V(), _pu = V(), _pv = V(), _n = V(), _F = V(), _U = V(), _R = V(), _g = V(), _w = V(), _dir = V(), _a = V(), _b = V();
  const palmCentre = pts => { _c.set(0, 0, 0); for (const i of [0, 5, 9, 13, 17]) _c.add(pts[i]); return _c.multiplyScalar(0.2); };
  const bendDeg = (a, b, c) => { _a.subVectors(b, a).normalize(); _b.subVectors(c, b).normalize(); return Math.acos(Math.max(-1, Math.min(1, _a.dot(_b)))) * 180 / Math.PI; };
  const closed = h => !h.ext[1] && !h.ext[2] && !h.ext[3], open = h => h.ext[1] && h.ext[2] && h.ext[3];
  const GRIP_ANGLE = 50 * Math.PI / 180;   // barrel direction: from the palm axis toward the palm normal by this much (a fist's grip)
  const GRIP_OFF = 0.032;                  // grip centre this far in front of the palm plane

  function gripFrame(h) {   // world frame of the held gun from the hand's points: barrel F, grip-up U, side R, grip centre C
    const p = h.pts; _pu.subVectors(p[9], p[0]).normalize(); _pv.subVectors(p[17], p[5]).normalize();
    _n.crossVectors(_a.subVectors(p[5], p[0]), _b.subVectors(p[17], p[0])).normalize(); if (!h.right) _n.negate();   // out of the palm, palm side
    _U.copy(_pv).negate();                                                                    // pinky -> index: up the grip toward the slide
    _F.copy(_pu).multiplyScalar(Math.cos(GRIP_ANGLE)).addScaledVector(_n, Math.sin(GRIP_ANGLE)); _F.addScaledVector(_U, -_F.dot(_U)).normalize();
    _R.crossVectors(_F, _U).normalize(); _U.crossVectors(_R, _F).normalize();
    _c.copy(palmCentre(p)).addScaledVector(_n, GRIP_OFF);
  }
  const GB = new THREE.Matrix4().makeBasis(BARREL, GRIP_UP, new THREE.Vector3().crossVectors(BARREL, GRIP_UP).normalize()).invert();   // gun basis -> identity
  function placeInHand(h) {
    gripFrame(h);
    _m.makeBasis(_F, _U, _R).multiply(GB);                                                     // gun space -> world rotation (as a matrix)
    _q.setFromRotationMatrix(_m);
    if (st.kick > 1e-4) { _kq.setFromAxisAngle(_R, -st.kick); _q.premultiply(_kq); }         // recoil: muzzle up about the side axis
    gun.quaternion.copy(_q);
    _g.copy(GRIP).applyQuaternion(_q); gun.position.copy(_c).sub(_g);                        // the grip centre lands in the hand
  }
  function reparent(obj, parent) {   // keep the world transform
    obj.updateMatrixWorld(true); _m.copy(obj.matrixWorld); parent.updateMatrixWorld(true); obj.removeFromParent(); parent.add(obj);
    _m.premultiply(parent.matrixWorld.clone().invert()); _m.decompose(obj.position, obj.quaternion, obj.scale);
  }
  function fire() {
    st.shots++; st.kick = 0.16; st.slideT = 0; st.flashT = 0.06; bang();
    gun.updateMatrixWorld(true); _w.copy(MUZZLE).applyMatrix4(gun.matrixWorld); _dir.copy(BARREL).transformDirection(gun.matrixWorld);
    light.position.copy(_w); light.intensity = 6; flash.material.rotation = Math.random() * Math.PI * 2; flash.visible = true;
    ray.set(_w, _dir); const hit = ray.intersectObjects(targets, true)[0];
    const pts = tracer.geometry.attributes.position; pts.setXYZ(0, _w.x, _w.y, _w.z);
    if (hit) {
      pts.setXYZ(1, hit.point.x, hit.point.y, hit.point.z);
      const m = new THREE.Mesh(markGeo, markMat); const nrm = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : _dir.clone().negate();
      m.position.copy(hit.point).addScaledVector(nrm, 0.0015); m.lookAt(_a.copy(hit.point).add(nrm)); marks.add(m); if (marks.children.length > 40) marks.remove(marks.children[0]);
    } else { _a.copy(_w).addScaledVector(_dir, 6); pts.setXYZ(1, _a.x, _a.y, _a.z); }
    pts.needsUpdate = true; tracer.visible = true; tracer.material.opacity = 0.8;
  }

  return {
    obj: gun, table, get state() { return st; }, fireNow: fire, get marks() { return marks.children.length; },
    hud() { return st.mode === "held" ? `gun held · ${st.shots} shot${st.shots === 1 ? "" : "s"}` : st.shots ? `${st.shots} shot${st.shots === 1 ? "" : "s"}` : "gun on the table: close your hand on it"; },
    update(dt, hands, now) {   // hands: [{ key, group, pts (world Vector3[21]), right, ext: [index, middle, ring, pinky extended] }]
      // effects
      if (st.kick > 0) st.kick = Math.max(0, st.kick - st.kick * Math.min(1, dt * 16) - dt * 0.2);
      if (slide) { st.slideT = Math.min(1, st.slideT + dt / 0.09); const back = st.slideT < 0.4 ? st.slideT / 0.4 : 1 - (st.slideT - 0.4) / 0.6; slide.position.copy(slide0).z += 0.014 * Math.max(0, back); }
      if (st.flashT > 0) { st.flashT -= dt; if (st.flashT <= 0) { flash.visible = false; light.intensity = 0; } else light.intensity *= 0.8; }
      if (tracer.visible) { tracer.material.opacity -= dt * 12; if (tracer.material.opacity <= 0) tracer.visible = false; }
      st.cool = Math.max(0, st.cool - dt);
      const holder = st.holder && hands.find(h => h.key === st.holder);
      if (st.mode === "held") {
        if (holder) {
          st.lastSeen = now; placeInHand(holder);
          const bend = bendDeg(holder.pts[5], holder.pts[6], holder.pts[7]);
          if (st.armed && bend > FIRE_ON) { st.armed = false; fire(); } else if (!st.armed && bend < FIRE_OFF) st.armed = true;
          if (open(holder)) drop(holder.group);
        } else if (now - st.lastSeen > 1000) drop(null);
        return;
      }
      if (st.mode === "falling") {
        st.vel.y -= 9.8 * dt; gun.position.addScaledVector(st.vel, dt);
        const onTable = Math.abs(gun.position.x) < 0.45 && Math.abs(gun.position.z - tableZ) < 0.3, ground = (onTable ? tableY : floorY) + 0.016;
        if (gun.position.y <= ground) { gun.position.y = ground; gun.quaternion.copy(REST.quat); st.mode = "rest"; }
        return;
      }
      // rest: a closing hand at the grip picks it up
      if (st.cool > 0) return;
      gun.updateMatrixWorld(true); _g.copy(GRIP).applyMatrix4(gun.matrixWorld);
      for (const h of hands) {
        const near = palmCentre(h.pts).distanceTo(_g) < GRAB_R;
        if ((near && closed(h)) || (hold && !st.forced)) { st.forced = true; st.mode = "held"; st.holder = h.key; st.armed = false; st.lastSeen = now; const i = worldObjs.indexOf(gun); if (i >= 0) worldObjs.splice(i, 1); reparent(gun, h.group); placeInHand(h); break; }
      }
    },
  };
  function drop(group) {
    reparent(gun, worldGroup); worldObjs.push(gun); st.mode = "falling"; st.holder = null; st.cool = 0.8; st.vel.set(0, 0, 0);
  }
}
