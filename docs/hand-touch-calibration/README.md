# Hands-touching experiment
Every capture button gives a five-second preparation countdown before recording. Reset cancels the countdown. Keep the head/camera still and both index fingertips touching. Measure lens-to-contact distance, capture anchor, record near-to-neck sweep, then record a separate validation sweep. Requires visible hands, sufficient range and an improvement of at least 10% with median fitted contact error below 2 cm before applying. Settings must have contact/relaxed palm off and hand offsets zero. Calibration is session-only.

This measures model consistency, not independent physical depth accuracy: monocular landmarks and assumed hand geometry remain uncertain. Synthetic fit test passes; real calibration requires the user’s measured capture.

## Touch 1.2
Fixed eight-second recording timer after five-second preparation: first half toward chest, second half toward camera. Displays accepted frames and rejection reasons; stops at the deadline even if tracking fails. Removed the unnecessary face-visible / 3 cm model-head-motion rejection gate: these hand-fit equations do not depend on face landmarks. Camera must remain fixed. Validation requires samples in both halves and a robust 1.5× near/far range.
