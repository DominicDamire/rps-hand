## Rotation correction (rotation3)

The previous planar solver could reject a turned palm or pick an ambiguous branch and hold the last valid pose. The solver now seeds and disambiguates PnP with the raw 3D wrist/MCP frame. At degenerate views it uses the observed orientation with a perspective translation fit, rather than holding an old front-facing orientation. The status identifies this fallback. Reference-only 2D comparison still works without world landmarks.

Regression: 876 synthetic frames, both handed models, three aspect ratios, a complete turn and mismatched palm geometry. New poses follow all rotations; the prior solver fails the same suite. The real-image sample remains 0.2 px RMS / 0.5 px maximum. This does not establish live accuracy for every camera or metric scale.

The separate [PnP gun lab](../hand-pnp-gun/) shares this tracking and calibration.

# PnP aligned hand

The existing page is still `hand-pnp-photo/`; its URL is retained. Sweep `hand-sweep-neck/` and `hand-sweep-check/` import the same hand fit and driver.

The first screenshot supplies the 21 reference pixel centres. All joints lie on the internal reference plane; the palm-base pivot is determined using the actual shell front/back pair, 1.5 model mm inside its proximal edge, about 44.2 model mm away from the old wrist ball. Front/back mesh triangulation is symmetric about this plane so the surfaces, not just averaged vertices, enclose each joint centre equally. The original shared GLB is untouched. This deliberately makes thickness symmetric and can alter asymmetrical surface detail.

Finger lengths remain fixed. The driver intersects the observed camera rays with spheres at each fixed segment length; tracker world depth selects the bend branch. Thumb opposition uses a fixed wrist-to-CMC reach. Upper hinge/contact corrections do not override the image-fit path. An unreachable ray preserves bone length and appears as a nonzero pixel residual. Orthographic mode retains the older direction driver. Both hands use mirrored reference dimensions. Extra fingertip extension defaults to zero.

Model lines and dots are enabled for both hands. They read actual rig joints and modeled endpoints, with depth testing disabled so the mesh cannot obscure them. The on-page RMS/max residual measures actual 3D joint projections against tracking observations. PnP retains its estimator and near/neck calibration, adding a planar IPPE seed alongside the existing initialization/refinement. Sweep retains its depth estimator and calibration.

`reference.html` overlays the actual 3D rig on both original screenshot crops, with opacity control. Image 1 gives <0.001 px maximum error against its traced reference. Image 2 gives about 0.408 px RMS / 1.194 px maximum with the same fixed dimensions. Traces themselves are limited by screenshot resolution. This is not a measured metric scan and does not guarantee exact live tracking from unknown camera parameters.

Validation: `alignment.test.mjs` exports `checkAlignment()` for a browser module harness (Three import map required). It checks paired surfaces for all 42 points, mirrored dimensions, finite geometry, ray/bone constraints, unreachable observations and driver/rig agreement under rotation on both sides. Maximum centre discrepancy was below 0.000001 model mm; joint/driver and length discrepancies were below 1e-8 m. Reference overlays and sample tracking were visually checked. Existing capture, reference-scale and Sweep depth tests pass.
