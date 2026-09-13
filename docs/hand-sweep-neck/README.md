# Sweep 2.4.11: neck anchor and consistent finger solve

Separate comparison based on 2.4.10. Existing 2.4.7 and 2.4.10 pages are unchanged, with independent browser setting keys for this page.

## Neck endpoint

Keep the head/phone still; hold an extended open hand, palm facing yourself, for five seconds, then move it back to the bottom of the neck over eight seconds and hold the final second. Set the displayed head position/size before capture. The head is not moved or resized by this sweep.

For final valid frames, find the projected outer neck surface near the palm and calculate a wrist depth placing the back of the palm's joint centres 6 mm in front of it. Save the median ratio of that target wrist depth to the geometry-based palm depth. Subsequent depth is `saved gain * fixed palm length * camera focal factor / rotation-corrected palm size`. Before capture the gain is one. The shared gain stays frozen for both hands and does not depend on finger curl or later head motion. Capture also freezes the rear plane with the existing 10-degree phone-tilt assumption and 30 model-cm rear allowance. Failed capture preserves the previous reference; reset removes it.

This restores the 2.4.7 principle of anchoring the hand to the neck, using sampled neck geometry instead of eye depth. It is calibration from user-declared contact, not independent metric depth measurement. The fixed gain can change the projected size of the fixed hand model; exact camera overlay and metric accuracy are not guaranteed. Re-record after changing head placement or the camera setup.

## Fingers and collisions

The direct finger driver is byte-for-byte the 2.4.7 driver. The 2.4.10 extended-finger-only reprojection correction is removed; open hands and fists use the same tracked-segment retargeting with fixed bone lengths and existing hinge/base-splay limits. Palm placement remains the 2.4.10 geometry/camera estimator before applying the new fixed neck gain. No gesture-specific translation or finger-driven hand spreading is added.

The existing outer-hand collision solver starts on to separate overlapping exterior pieces between the two hands. Contact pulling and head collisions start off. The collision solver translates whole hands and uses approximate convex exterior shells; it does not constitute accurate tracking or soft-tissue simulation. During capture, all contact/collision corrections are paused so they cannot bias the depth fit.

## Checks

Tests cover 540 ideal projections of the actual doll palm, 96 rotation/depth combinations, fixed inverse-size ratios after anchoring, both-hand sharing, endpoint fitting, missing observations, reset, failed recapture, and independence from later head movement. A browser test with the actual doll/head assets exercised 18 open-to-fist-to-open poses with fixed palm input: palm drift zero, bone-length/bend/splay constraints preserved, no head transform change when sampling the neck, and zero remaining penetration in the constructed hand-collision case. These are software/geometry checks, not validation of the user's live transition or physical camera distance.
