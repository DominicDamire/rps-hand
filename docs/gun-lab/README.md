# Gun Grip Lab

Standalone lab at `/gun-lab/` for adjusting a fixed hand pose around the existing pistol. It reuses the sweep's `DollRig`, `doll.glb`, `doll-report.json`, and hand tracking session. It does not start a camera until Connect camera is clicked.

The initial pose has a raised thumb, extended index toward the Front camera, and curled middle/ring/pinky. The orbit view exposes the hand side of the gun. Hand and gun have independent position (millimetres), XYZ Euler rotation (degrees), and uniform scale. Move gun with hand preserves their relative transform. Optional 3D handles translate or rotate the selected object; orbit, front, side, top and first-person views aid alignment.

All 15 finger joints expose bend, sideways and twist. Geometry remains the sweep's articulated rigid hand, with its default 1.3× finger thickness. Fingertip extension is left at the model's original length. Joint markers can be clicked to select a joint. The gun can be hidden or made transparent to inspect overlap. There is no automatic collision fitting.

Save in browser stores one named preset under `gun-grip-lab-v1`. JSON export/import preserves both transforms, hand side, all joint rotations, thickness, and trigger calibration. Import validates finite bounds, rig/schema, release/press calibration, and threshold hysteresis before replacing the current state. The saved preset loads on page entry. Initial pointing pose resets the working state; Save explicitly replaces the saved preset. Presets currently affect this lab only.

Live trigger mode uses one confident, selected tracker hand label. The edited grip and placement stay fixed; only index middle/tip bends follow measured 3D landmark bends. The smoothing setting filters both rendered bends and the trigger meter. Capture released/pressed calibrates the index middle-joint range. Hysteresis counts one press per release, with no looping or timed animation. Loss or a >250 ms result gap disarms; a released observation is required to rearm. Stopping, leaving or hiding the page closes the tracking workers and camera stream.

## Validation

Run `node --test docs/gun-lab/trigger.test.mjs` from the repository root. Eight tests cover 3D bend invariance, press/release hysteresis, tracking loss and invalid input, long result gaps, time-based smoothing, and profile round-trips/rejection.

Serve `docs` and open `/gun-lab/tracker-check.html` to run the actual sweep tracker on `test/count5.png` without camera access. This verifies inference and index-bend extraction, not the user's live camera accuracy. Browser checks exercised numeric joint edits, saved-preset restoration, linked object translation, direct 3D handle dragging, visual grip alignment, and a 390 px phone layout.

Live grip occlusion, phone latency and comfort still need testing with the user's camera. The public movement game is not modified by this lab.
