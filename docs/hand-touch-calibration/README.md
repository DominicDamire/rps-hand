# Hands-touching experiment
Capture a measured anchor, then one eight-second sweep. Each capture starts after a five-second preparation countdown. During the sweep move touching index fingertips toward your chest for four seconds, then back toward the camera for four seconds. Keep both hands visible and the camera fixed; the face is not required. A usable fit applies immediately after the sweep, with fit error displayed for reference. There is no independent-validation step. Reset cancels capture and restores base depth. Contact/relaxed palm must be off and hand offsets zero while recording. Calibration is session-only.


This measures model consistency, not independent physical depth accuracy: monocular landmarks and assumed hand geometry remain uncertain. Synthetic fit test passes; real calibration requires the user’s measured capture.

## Touch 1.2
Fixed eight-second recording timer after five-second preparation: first half toward chest, second half toward camera. Displays accepted frames and rejection reasons; stops at the deadline even if tracking fails. Removed the unnecessary face-visible / 3 cm model-head-motion rejection gate: these hand-fit equations do not depend on face landmarks. Camera must remain fixed. Validation requires samples in both halves and a robust 1.5× near/far range.

## Touch 1.3
Removed independent validation at the user's request. Measured anchor + one eight-second sweep now applies a usable fit immediately. Fit error is shown for interpretation, not used as an accuracy acceptance threshold. Reset removes the applied fit. This change does not establish real-world depth accuracy.
