# Combined Hands + Head Lab V18

Live: https://d14life.github.io/rps-hand/hand-combined/?v=18

This is the combined lab, based on the V17 direct-lines hand code. One scene contains both original doll hands and the existing alien.glb head/shoulder bust. Face orientation, eye gaze and shoulder rotation drive the black bust. No lip morphs or mouth animation are applied.

Camera capture requests 60 FPS. Hands target 60 measurements/s, face 20 and shoulders 10. GPU is preferred with an explicitly reported CPU fallback. Each task has its own worker and one frame in flight; busy tasks skip camera frames. requestVideoFrameCallback supplies distinct frames where supported. Rate controls at zero terminate that task; re-enabling reloads it. Camera FPS and tracker initialization depend on the browser/device.

Top-right camera badge reports delivered video-frame callbacks and completed measurements over the latest second. The detailed status also shows the processor, inference duration and actual render FPS. A 60 target is not a measured 60 FPS result. Reference-fixture captureStream measurements are development checks, not device-camera benchmarks.

The phone route runs the same workers, sends hands plus face/shoulder results over the existing broker link, and receives tracking settings from the PC. No camera images are transmitted. The phone shows overlays on its own video; the PC shows the landmark preview on black. The selected camera capture rate applies when reconnecting. Tracking changes apply during streaming.

Existing V17 hand controls remain under collapsible sections. New performance controls explain processing cost versus smoothing delay. New controls cover head size, face depth offset, neck share, movement gain, head smoothing and shoulder lock. Head controls save automatically; hand controls retain Save starting settings.

Shared calibration requires perspective, a detected face, and hands beside the face at the entered phone distance. It calibrates the existing hand depth gains and the head distance reference together. The head model scale is captured once, and stays fixed until explicit size adjustment or calibration. Hands keep V17 fixed joint lengths. This does not guarantee physical skin-to-skin contact: monocular depth and alien/human proportions differ. Face depth offset allows measured visual correction; orthographic view is a diagnostic view, not exact pixel alignment.

Validation: node head-depth.test.mjs, tracking-session.test.mjs and projection.test.mjs. Browser reference-frame test runs all three real MediaPipe GPU workers with both hands and the black head visible in one scene; face rate zero stops face measurements while hands continue. Moving gesture fixture is available with ?v=18&fixture=gesture, seated two-hand reference with &fixture=seated. No user iPhone performance or real cheek-contact accuracy is claimed by these tests.
