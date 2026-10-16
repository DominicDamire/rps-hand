[Reproduction steps, verified results and remaining limits](REVIEWER.md)

# Hand tracking: current pages

[**PnP**](https://d14life.github.io/rps-hand/hand-pnp-photo/?v=motion5) · [**Sweep**](https://d14life.github.io/rps-hand/hand-sweep-neck/?v=aligned2) · [**PnP gun lab**](https://d14life.github.io/rps-hand/hand-pnp-gun/?v=motion5) · [Compare the hand against the original lines](https://d14life.github.io/rps-hand/hand-pnp-photo/reference.html)

Both pages use the same reference hand, palm-base pivot, and visible model joint lines. The first reference image sets fixed proportions; the second checks the pose. Live projection error is displayed rather than claiming metric accuracy.

# Movement v90 · fixed hand attachments

[Play v90](https://d14life.github.io/rps-hand/movement/?v=90) · [Blender verification](https://d14life.github.io/rps-hand/movement/blender-check/) · [V90 details](docs/movement/V90.md)

# Movement v89 · restored v80 model and joints

[Play v89](https://d14life.github.io/rps-hand/movement/?v=89-v80) · [Hand movement test](https://d14life.github.io/rps-hand/movement/hand-check.html?v=89-v80) · [Implementation and validation](docs/movement/V89.md)

# RPS Hand

Rock-paper-scissors with real hand tracking: the camera tracks every finger joint and a 3D hand copies the motion live.

## Two versions live on this repo (GitHub Pages from `docs/`)

| Version | Who | Live link | What it is |
|---|---|---|---|
| **Hand** (build 40) | — | https://d14life.github.io/rps-hand/ | The tracked 3D hand (owner's rigged arms model), first person + mirror view, solid-hand solver, and a pistol on a table you can pick up and shoot. Source: `docs/index.html`, `docs/gun.mjs`, `docs/arm_*.glb`. |
| **Movement** (v74) | — | https://d14life.github.io/rps-hand/movement/?v=88 | Walking and turning in Dust II with a camera thumb joystick and head look, plus additions: the shooting range (table, pistol, cans, ring targets), a wall mirror, the tracked right hand picks the gun up and fires (`docs/movement/shooter.mjs` + `docs/gun.mjs`), the player's upper body from [hands-lapse](https://github.com/tagirz500/hands-lapse/tree/hand-rig-workflow) (`docs/avatar/`, `docs/body/`, `docs/movement/body.mjs`), and **phone as camera on any network**: the phone runs the trackers and sends the landmarks through a public broker (`docs/movement/link.mjs`, `phone.mjs`, `remote.mjs`), so no peer-to-peer connection is needed. Add `&video=1` for the old WebRTC camera stream (one shared Wi-Fi only). The three trackers (hand, face, body) run side by side instead of taking turns, and the mirror only refreshes when it is on screen, which took the page from 25 to 111 fps and the hand tracker from 6 to 26. The player is now the user's ball-joint doll (`docs/doll.glb`, 50 joints, 45k triangles, built by `tools/doll/build.py`): eyes on the camera, body turning with the heading, neck and head from the face tracker, arms solved to the tracked wrist, fingers from the hand landmarks, and legs that stride when you walk and stand still when you do not. The Body box picks full body, seated or standing with the pose tracker, head only, or off. With the phone as camera the preview shows the tracked landmarks, not video: encoding a picture on the phone starved its trackers. `?labels=1` adds JOYSTICK / 3D HAND / head labels. A fist stops the joystick and puts its circle back around your thumb. The hand rests low in the frame like a shooter's viewmodel (`?drop=` degrees, `?reach=` arm reach). A heavy bag stands beside the table: punch it with a fist and it thumps and rocks (`docs/movement/punch.mjs`), and the hand is stopped by the bag and the table top instead of passing through. Sounds are synthesized, no files (`docs/movement/sound.mjs`): punches, taps, footsteps, picking the gun up, plus the gun's own shot and can hits. `?reach=` sets the arm reach, `?body=0` turns the body tracker off. Source: `docs/movement/`. |

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

## Playable review build — 2026-10-16

The root page now provides an actual rock–paper–scissors round on top of the
existing MediaPipe tracker and 3D hand renderer. Start with
`/?img=victory.jpg` for a camera-free sample, or `/` for your webcam. The sample
supplies the player's gesture; it is labelled as sample input, not a live game.

A round commits a random opponent before the three-second countdown. Scoring
requires a recently observed, stable, single-hand gesture; missing/stale input
asks for a retry and does not change the score. Reset, instructions, visible
gesture feedback and camera-denial recovery are included. Camera/overlay and
3D mirror framing retain the complete input on narrow displays. The former gun
experiment is still available with `?gun=1`, and face/hand and geometry labs
remain linked under the instructions.

Run the full browser journey against the static server:

```sh
# npm ci and browser installation as described in REVIEWER.md
RPS_BASE=http://127.0.0.1:8765 node tools/product-journey.cjs
```

This exercises the real sample tracker, round scoring, reset, mobile controls,
and denied-camera recovery. Headless software rendering can be slow enough to
trigger a legitimate retry; that is not a reason to count stale observations as
a successful round. Physical phone accuracy and sustained device FPS still
require a real-device session. The latest Node suite contains 690 checks across
229 files, including four new game-state tests; copied experimental suites are
not independent product capabilities.
