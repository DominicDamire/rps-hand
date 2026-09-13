# One-hand sweep 2

Five seconds to prepare, then an eight-second one-way sweep. Extend one fully visible open hand toward the camera with the palm facing yourself, keep your face visible, and move back to your neck/shoulder. Finish with the hand at the neck. No manual centimetres, measured anchor, touching index fingers, second hand, return sweep or validation step.

Capture retains the starting model wrist depth and observes the initial palm span. At the neck endpoint it uses the head's existing depth plane plus the tracked wrist-to-palm depth offset. The saved inverse-palm-size mapping interpolates between those two endpoints and preserves the initial placement exactly. During subsequent motion the coefficients never refit themselves. Finger gestures continue using MediaPipe landmarks and the existing direct rig conversion. The head reference is retained at its already displayed distance. The endpoint assumes the requested hand-at-neck pose; it does not independently prove physical contact.

Reset removes the mapping; recapture replaces it. Capture fails clearly if the start/end frames are missing, the hand changes, the near/far size range is absent, or the endpoint is not farther away than the initial placement. Recording stops at eight seconds even if tracking fails. Session-only reference. Zero position offsets by default. Back-wall shifting is bypassed after capture. Contact assistance remains opt-in.

Shares the straight distal-joint depth correction with Alien 18.10. Tests cover one hand, preparation/deadline, missing frames, cancellation, no measurement fields, starting depth retention, endpoint mapping and no live refitting.
