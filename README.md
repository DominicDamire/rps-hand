# RPS Hand

Rock-paper-scissors with real hand tracking: the camera tracks every finger joint of both hands and a 3D
hand copies the motion live in a room, with depth, physics and tilt levelling.

- **Live (phone, camera needed):** https://tagirz500.github.io/rps-hand/  (served from `docs/`)
- **Desktop app:** `rps_hand.py` (Python + MediaPipe + pygame/OpenGL)
- **Tests:** `test_rps_hand.py` (desktop), `web_test.py` (web smoke), `web_hard_test.py` (real footage,
  metrics; needs the test media from `fetch_test_media.py` and the system Microsoft Edge)

Layout: `docs/index.html` is the whole web app (one file). `docs/test/` holds Wikimedia Commons test photos
and clips (CC licences; two big ones are git-ignored). `assets/` holds the MediaPipe model for the desktop app.
