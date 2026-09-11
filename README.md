# RPS Hand

Rock-paper-scissors with real hand tracking: the camera tracks every finger joint and a 3D hand copies the motion live.

## Two versions live on this repo (GitHub Pages from `docs/`)

| Version | Who | Live link | What it is |
|---|---|---|---|
| **Hand** (build 40) | — | https://d14life.github.io/rps-hand/ | The tracked 3D hand (owner's rigged arms model), first person + mirror view, solid-hand solver, and a pistol on a table you can pick up and shoot. Source: `docs/index.html`, `docs/gun.mjs`, `docs/arm_*.glb`. |
| **Movement** (v69) | — | https://d14life.github.io/rps-hand/movement/?v=69 | Walking and turning in Dust II with a camera thumb joystick and head look, plus additions: the shooting range (table, pistol, cans, ring targets), a wall mirror, the tracked right hand picks the gun up and fires (`docs/movement/shooter.mjs` + `docs/gun.mjs`), the player's upper body from [hands-lapse](https://github.com/tagirz500/hands-lapse/tree/hand-rig-workflow) (`docs/avatar/`, `docs/body/`, `docs/movement/body.mjs`), and **phone as camera on any network**: the phone runs the trackers and sends the landmarks through a public broker (`docs/movement/link.mjs`, `phone.mjs`, `remote.mjs`), so no peer-to-peer connection is needed. Add `&video=1` for the old WebRTC camera stream (one shared Wi-Fi only). The three trackers (hand, face, body) run side by side instead of taking turns, and the mirror only refreshes when it is on screen, which took the page from 25 to 111 fps and the hand tracker from 6 to 26. The avatar shows the head alone by default (`head only` in the Body box; `seated`/`standing` bring the shoulders, torso and arms back with their tracker). With the phone as camera the preview shows the phone's live picture (it sends a small frame about seven times a second) under the joystick; `?labels=1` adds JOYSTICK / 3D HAND / head labels. A fist stops the joystick and puts its circle back around your thumb. The hand rests low in the frame like a shooter's viewmodel (`?drop=` degrees, `?reach=` arm reach). A heavy bag stands beside the table: punch it with a fist and it thumps and rocks (`docs/movement/punch.mjs`), and the hand is stopped by the bag and the table top instead of passing through. Sounds are synthesized, no files (`docs/movement/sound.mjs`): punches, taps, footsteps, picking the gun up, plus the gun's own shot and can hits. `?reach=` sets the arm reach, `?body=0` turns the body tracker off. Source: `docs/movement/`. |

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
