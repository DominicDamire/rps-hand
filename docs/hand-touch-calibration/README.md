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


## Sweep 2.4

Adds a second capture button alongside the original one-hand sweep. Hold both middle fingertips (MediaPipe landmark 12) physically together, fingers pointing inward, near the camera. After five seconds of preparation, move both hands one way toward the bottom of the neck over eight seconds, maintaining contact. No third validation step or manual distance is required. Face visibility is not used as a gate or a depth anchor for this mode. The endpoint position is an instruction, not an independently verified neck contact.

Each paired frame solves the two wrist camera-ray distances using fixed rig middle-fingertip offsets and the assumed real fingertip contact. It accepts only fresh simultaneous Left/Right results, opposing middle-finger directions, visible palm anchors/tips and a small image gap. The screenshot's drawn line is not used as data. Both endpoint windows and at least twelve motion observations are required. Image proximity remains a contact hypothesis, not physical proof.

All accepted samples fit a robust inverse-palm-span depth curve for each hand (A + B / palmSize). These coefficients are frozen after capture; the head is not repositioned, hands are not forced together afterward unless the separate existing runtime contact option is enabled, and geometry is unchanged. The displayed millimetre value is the residual on the calibration recording, not independent measured depth accuracy. Failed/degenerate recordings keep the previous capture. Models and manual settings can affect the inferred scale; this is still a monocular experiment.

Head collision uses exterior-shell separation along a separating normal, allowing tangential sliding. It no longer automatically shifts the other hand just because runtime hand contact is paired. Existing collision switches and defaults remain; there is no same-hand self-collision. Tests cover known synthetic sweep distances (including unseen positions), missing/stale/wrong-finger contact, UI capture activation/reset, fixed runtime coefficients, normal collision and free sliding, plus existing actual DollRig finger limits and collision separation.

The PC preview paints a solid black background and overlays tracking lines/dots only. The original camera/video frames still feed MediaPipe; no black frame is sent to inference.

## Sweep 2.4.1 — index contact correction

Two-hand calibration now uses index fingertips (landmark 8), with direction from index base knuckle 5. Hold index fingertips touching as in the requested pose. The countdown and one-way eight-second sweep are unchanged. Middle-finger contact does not substitute for index contact. One-hand calibration is unchanged.

## Sweep 2.4.2 — local video replay and declared index contact

Load movement video processes a local file using the existing MediaPipe workers, sampling hands at 30/s and face/shoulders at 10/s. It then replays the cached estimates at the video's timestamps, with pause, restart, seek, side and top views. No video is uploaded or committed. HEVC MOV support depends on the browser; an H.264 MP4 copy is supported for the supplied review clip.

The video option “Index fingertips stay touching throughout this video” declares known contact. While enabled, with contact matching on and two confident hands available, the solver uses index tips directly even if image landmarks momentarily separate, with zero confirmation delay. This is an explicit contact constraint, not proof of contact inferred from monocular RGB. Unchecking it restores visual proximity gating. Camera input still uses normal optional contact settings; missing/asynchronous/uncertain hand packets are rejected. Hand dimensions stay fixed; correction translates the two hands and does not rewrite the sweep curve.

The supplied approximately ten-second clip was tested privately via an H.264 copy: 297/297 sampled frames detected both hands; all 297 rendered frames had an index-point gap of 1 mm after correction. Side and top views were inspected. Estimated shared depth changed through the movement, rather than locking the hands in place. This is model-space contact verification, not measured camera-distance accuracy or proof that every joint matches the real hand. The review media stays under the git-excluded `docs/.lab-qa/` folder.
