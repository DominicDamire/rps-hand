# RPS Hand

Rock-paper-scissors with real hand tracking: the camera tracks every finger joint and a 3D hand copies the motion live.

## Two versions live on this repo (GitHub Pages from `docs/`)

| Version | Who | Live link | What it is |
|---|---|---|---|
| **Hand** (build 40) | — | https://d14life.github.io/rps-hand/ | The tracked 3D hand (owner's rigged arms model), first person + mirror view, solid-hand solver, and a pistol on a table you can pick up and shoot. Source: `docs/index.html`, `docs/gun.mjs`, `docs/arm_*.glb`. |
| **Movement** (v65) | — | https://d14life.github.io/rps-hand/movement/?v=65 | Walking and turning in Dust II with a camera thumb joystick and head look, plus the shooter: a table with the pistol, cans and ring targets at the spawn, a wall mirror, the tracked right hand picks the gun up and fires (`docs/movement/shooter.mjs` + `docs/gun.mjs`), and the player's upper body: the connected 15-bone rig and the upper-body tracker from [hands-lapse](https://github.com/tagirz500/hands-lapse/tree/hand-rig-workflow) (`docs/avatar/`, `docs/body/`), eyes on the camera, neck and head on the head tracker's physical angles, the right arm joined to the tracked hand (`docs/movement/body.mjs`). One hand alone is the 3D hand if it is the right hand, the joystick if it is the left. Phone as camera: same Wi-Fi, or `?turn=turn:host:port|user|password`. Source: `docs/movement/`. |

Both pages need a phone camera. The two are developed in the same repo but independently: hand builds are published
on top of the latest `docs/movement`, movement versions are published without touching the hand files.

- **Original repo:** https://github.com/tagirz500/rps-hand (this fork is https://github.com/d14life/rps-hand)
- **Desktop app:** `rps_hand.py` (Python + MediaPipe + pygame/OpenGL)
- **Tests:** `test_rps_hand.py` (desktop), `web_test.py` (web smoke), `web_hard_test.py` (real footage,
  metrics; needs the test media from `fetch_test_media.py` and the system Microsoft Edge), `web_shot.py` (one screenshot)

The 3D hand is the owner's hand scan (`hand1.OBJ`), decimated, rigged to the 21 MediaPipe joints and driven with the
tracked bone lengths (`docs/hand.glb` + `docs/hand.json`); `?skin=0` shows the old capsule hand.
In first-person view, point with the index finger and pull/push/drag to move and turn.

Layout: `docs/index.html` is the whole web app (one file). `docs/test/` holds Wikimedia Commons test photos
and clips (CC licences; two big ones are git-ignored). `assets/` holds the MediaPipe model for the desktop app.
