# One-hand sweep 2

Five seconds to prepare, then an eight-second one-way sweep. Extend one fully visible open hand toward the camera with the palm facing yourself, keep your face visible, and move back to your neck/shoulder. Finish with the hand at the neck. No manual centimetres, measured anchor, touching index fingers, second hand, return sweep or validation step.

Capture retains the starting model wrist depth and observes the initial palm span. At the neck endpoint it uses the head's existing depth plane plus the tracked wrist-to-palm depth offset. The saved inverse-palm-size mapping interpolates between those two endpoints and preserves the initial placement exactly. During subsequent motion the coefficients never refit themselves. Finger gestures continue using MediaPipe landmarks and the existing direct rig conversion. The head reference is retained at its already displayed distance. The endpoint assumes the requested hand-at-neck pose; it does not independently prove physical contact.

Reset removes the mapping; recapture replaces it. Capture fails clearly if the start/end frames are missing, the hand changes, the near/far size range is absent, or the endpoint is not farther away than the initial placement. Recording stops at eight seconds even if tracking fails. Session-only reference. Zero position offsets by default. Back-wall shifting is bypassed after capture. Contact assistance remains opt-in.

Shares the straight distal-joint depth correction with Alien 18.10. Tests cover one hand, preparation/deadline, missing frames, cancellation, no measurement fields, starting depth retention, endpoint mapping and no live refitting.

## Sweep 2.2

The entire eight-second recording goes toward the neck; no reversal at four seconds. A five-second preparation countdown is separate. Endpoint fitting now uses the first and last half-second rather than two-second moving averages.

Four finger bases retain open-hand splay through 65 degrees, taper it smoothly, and have zero palm-local sideways splay at 70 degrees and above (actual degrees, not 70% of an 80-degree fist). Forward flexion and upper-joint hinge behavior remain. Straight-line depth regularization is slightly stronger: full correction through 10 degrees of projected bend, tapering to zero at 20; short foreshortened segments retain tracker depth.

Two optional controls, both off by default: Match visible hand-to-hand contact; Outer collisions — hands and head. Contact needs nearby image landmarks on two fresh simultaneous hand results for at least 100 ms and two distinct observations. It translates whole hands to close the contact in the current frame; it does not modify sweep coefficients or finger shape. It releases when image contact disappears. Image overlap is only a contact hypothesis, not proof of physical depth. Outer convex shells exclude eyes/internal head pieces and never collide parts within the same hand. Collision resolution runs after contact matching so solid exterior surfaces take priority. Both corrections pause during recording; the face motion and depth calibration path are otherwise unchanged.


## Sweep 2.3

The start reference is sampled while holding still during the last second of the five-second preparation countdown. If those samples are missing, the first second of motion is used. The nearest five samples are retained per endpoint; a brief gap inside the old half-second windows no longer rejects an otherwise visible sweep. The eight-second one-way movement and deadline stay unchanged. The palm must be visible, while small fingertip boundary errors are tolerated. Face loss in the middle does not discard hand observations; endpoint face metadata may be up to one second old. Accepted counts and specific rejection reasons are displayed live. Failed captures retain the previous mapping.

A folded PIP or DIP now also activates the base sideways lock at 70 degrees, even if the MCP itself is below 70. The open-hand splay and base forward flexion remain free. Straightening thresholds are reduced halfway from 2.2 (10/20 degrees) toward the earlier correction (8/18), to 9/19 degrees.

Contact options are beside the capture controls and remain off by default. Status reports rejected contact fits and the remaining contact-point distance after collision resolution, rather than claiming every candidate is touching. Outer collisions between the two hands and hand/head collisions have independent switches. Hand/head collisions default off. The old head back-wall correction is removed from Sweep, so moving head sliders cannot move the hand depth. Enabling head collision or relaxed-palm assistance explicitly permits those interactions again. No collision between parts within the same hand is added.

Validation: Node regression suite; browser actual DollRig tests with both hands, rotated palms, open/folded upper joints and variable base spread; outer collision separation; straightening regression; UI countdown/deadline and independent head adjustment on a fixed input fixture. Synthetic tests cannot prove all live-camera poses.

Contact matching now exposes detection range (2–50% of palm span, default 18%), confirmation time (0–500 ms, default 100), and maximum residual sideways correction per hand (0–20 cm, default 3.5). The image tolerance scales with palm span, rather than an additional fixed image-size cap. These are temporary matching controls, not sweep recalibration.

The shared forward/back hand offset is exposed (zero by default; negative toward camera). Calibration removes this offset from its saved base anchors so it is applied only once. Elbow/arm overlay dots and lines are removed; the shoulder tracker and shoulder line remain.
