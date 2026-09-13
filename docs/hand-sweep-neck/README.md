# Sweep 2.4.13: preserve palm placement, fit the full bust at neck contact

This comparison combines 2.4.10's geometry-based palm placement with the front-to-neck contact reference. Original 2.4.7 and 2.4.10 pages remain unchanged.

## Calibration

Hold one extended open hand, palm facing yourself, through the five-second preparation. Move back over eight seconds, finishing with gentle palm contact at the neck just below the jaw. Keep the face and palm visible and hold the last second. No pressure is required.

Both hands keep the same fixed-mesh, rotation-corrected palm-size depth estimator before and after capture. The saved hand depth gain is exactly one: the neck fit cannot enlarge the projected hands or pull their wrists together. Fingers retain the 2.4.7 segment driver; the 2.4.10 extended-finger-only correction remains excluded.

The final observations select nearby projected outer neck samples. Calibration first estimates a uniform bust scale about the camera from the neck/palm depth ratio, then a camera-space XYZ translation aligning that surface with the finishing palm joint centre plus a 6 mm skin allowance. The head, neck and shoulders share this transform. Median endpoint estimates are frozen; they never refit from later finger gestures or head movement. Recapture removes the previous transform when measuring neck samples, preventing cumulative adjustment. Failed captures retain the previous fit; reset clears it. The 10-degree phone-tilt assumption and rear allowance remain.

This is user-declared contact calibration using an approximate palm skin offset and sampled neck mesh. It is not measured camera distance or an exact skin fit. A single palm reference does not identify every head/neck proportion or guarantee the opposite hand's contact. Bust fitting may shift its displayed image position. Live landmark noise, palm orientation errors and fixed finger proportions can still cause fingertip mismatch.

## Optional contact

Hand-to-hand contact matching and both collision toggles start OFF, so assistance does not hide the placement result. They remain available. If enabled, the 2.4.12 exterior collision and contact logic runs after placement, pauses during calibration, and does not modify the saved fit.

## Verification

540 ideal projections of the actual doll palm cover both hands, orientations, portrait/landscape framing and near/far depth. Tests verify unchanged wrist/MCP projection and inverse-size ratios, full XYZ endpoint alignment, fixed hand gain, missing/unstable endpoints, capture timing, failed recapture and reset. A browser check using the actual alien mesh verifies a common head/neck/root transform, no accumulation over 60 frames, unchanged uncalibrated neck reference on recapture, and correct reset. These are software and geometry checks, not a claim that the user's live fists and fingertips now match perfectly.
