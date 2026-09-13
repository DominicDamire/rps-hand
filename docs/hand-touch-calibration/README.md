# One-hand sweep 2

Five seconds to prepare, then an eight-second one-way sweep. Extend one fully visible open hand toward the camera with the palm facing yourself, keep your face visible, and move back to your neck/shoulder. Finish with the hand at the neck. No manual centimetres, measured anchor, touching index fingers, second hand, return sweep or validation step.

Capture retains the starting model wrist depth and observes the initial palm span. At the neck endpoint it uses the head's existing depth plane plus the tracked wrist-to-palm depth offset. The saved inverse-palm-size mapping interpolates between those two endpoints and preserves the initial placement exactly. During subsequent motion the coefficients never refit themselves. Finger gestures continue using MediaPipe landmarks and the existing direct rig conversion. The head reference is retained at its already displayed distance. The endpoint assumes the requested hand-at-neck pose; it does not independently prove physical contact.

Reset removes the mapping; recapture replaces it. Capture fails clearly if the start/end frames are missing, the hand changes, the near/far size range is absent, or the endpoint is not farther away than the initial placement. Recording stops at eight seconds even if tracking fails. Session-only reference. Zero position offsets by default. Back-wall shifting is bypassed after capture. Contact assistance remains opt-in.

Shares the straight distal-joint depth correction with Alien 18.10. Tests cover one hand, preparation/deadline, missing frames, cancellation, no measurement fields, starting depth retention, endpoint mapping and no live refitting.

## Sweep 2.2

The entire eight-second recording goes toward the neck; no reversal at four seconds. A five-second preparation countdown is separate. Endpoint fitting now uses the first and last half-second rather than two-second moving averages.

Four finger bases retain open-hand splay through 65 degrees, taper it smoothly, and have zero palm-local sideways splay at 70 degrees and above (actual degrees, not 70% of an 80-degree fist). Forward flexion and upper-joint hinge behavior remain. Straight-line depth regularization is slightly stronger: full correction through 10 degrees of projected bend, tapering to zero at 20; short foreshortened segments retain tracker depth.

Two optional controls, both off by default: Match visible hand-to-hand contact; Outer collisions — hands and head. Contact needs nearby image landmarks on two fresh simultaneous hand results for at least 100 ms and two distinct observations. It translates whole hands to close the contact in the current frame; it does not modify sweep coefficients or finger shape. It releases when image contact disappears. Image overlap is only a contact hypothesis, not proof of physical depth. Outer convex shells exclude eyes/internal head pieces and never collide parts within the same hand. Collision resolution runs after contact matching so solid exterior surfaces take priority. Both corrections pause during recording; the face motion and depth calibration path are otherwise unchanged.
