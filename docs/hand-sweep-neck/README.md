# Sweep 2.4.12: neck anchor and contact protections

Separate comparison based on 2.4.10. Existing 2.4.7 and 2.4.10 pages are unchanged, with independent browser setting keys for this page.

## Neck endpoint

Keep the head/phone still; hold an extended open hand, palm facing yourself, for five seconds, then move it back to the bottom of the neck over eight seconds and hold the final second. Set the displayed head position/size before capture. The head is not moved or resized by this sweep.

For final valid frames, find the projected outer neck surface near the palm and calculate a wrist depth placing the back of the palm's joint centres 6 mm in front of it. Save the median ratio of that target wrist depth to the geometry-based palm depth. Subsequent depth is `saved gain * fixed palm length * camera focal factor / rotation-corrected palm size`. Before capture the gain is one. The shared gain stays frozen for both hands and does not depend on finger curl or later head motion. Capture also freezes the rear plane with the existing 10-degree phone-tilt assumption and 30 model-cm rear allowance. Failed capture preserves the previous reference; reset removes it.

This restores the 2.4.7 principle of anchoring the hand to the neck, using sampled neck geometry instead of eye depth. It is calibration from user-declared contact, not independent metric depth measurement. The fixed gain can change the projected size of the fixed hand model; exact camera overlay and metric accuracy are not guaranteed. Re-record after changing head placement or the camera setup.

## Fingers and collisions

The direct finger driver is byte-for-byte the 2.4.7 driver. The 2.4.10 extended-finger-only reprojection correction is removed; open hands and fists use the same tracked-segment retargeting with fixed bone lengths and existing hinge/base-splay limits. Palm placement remains the 2.4.10 geometry/camera estimator before applying the new fixed neck gain. No gesture-specific translation or finger-driven hand spreading is added.

The existing outer-hand collision solver starts on to separate overlapping exterior pieces between the two hands. Contact matching and head collisions also start on in 2.4.12; each remains switchable. The collision solver translates whole hands and uses approximate convex exterior shells; it does not constitute accurate tracking or soft-tissue simulation. During capture, all contact/collision corrections are paused so they cannot bias the depth fit.

## Checks

Tests cover 540 ideal projections of the actual doll palm, 96 rotation/depth combinations, fixed inverse-size ratios after anchoring, both-hand sharing, endpoint fitting, missing observations, reset, failed recapture, and independence from later head movement. A browser test with the actual doll/head assets exercised 18 open-to-fist-to-open poses with fixed palm input: palm drift zero, bone-length/bend/splay constraints preserved, no head transform change when sampling the neck, and zero remaining penetration in the constructed hand-collision case. These are software/geometry checks, not validation of the user's live transition or physical camera distance.


## 2.4.12: contact protections enabled and through-head protection

Corrects the 2.4.11 comparison's defaults: visible hand-to-hand contact matching, outer-hand collisions and head collisions now start ON. A confirmed pair of nearby tracked contact points receives the existing temporary depth/translation correction; separation or missing/stale tracking releases it. Head collision may push hands, as required to keep their surfaces outside it. Corrections are paused during the sweep and never change its frozen gain.

The prior discrete collision test missed a hand that landed entirely behind the face between frames. A conservative camera-forward clearance check now also tests the path through head shells. It allows XY-separated side/top poses. Confirmed touching hands share the head clearance translation, preserving contact while clearing the head. Convex shells and face-axis swept intervals can add extra clearance near a silhouette; this is assisted model contact, not proof of accurate physical depth or exact skin collision.

Verification: contact latch tests (confirmation, release, missing/asynchronous packets), overlap and through-head box cases, and actual-model checks using six sampled poses from an earlier private recorded landmark dataset. Five poses satisfied the visual index-contact gate: after deliberately placing the head through their contact area, all five had zero reported head-shell intersections and at most 1 mm index-point gap after both collision stages. The sixth was correctly left unconnected because the observed index lines exceeded the proximity gate. These are replay-pose contact checks with a constructed head obstruction, not a full live calibration accuracy test. Personal recording/landmark data remains excluded from Git.
