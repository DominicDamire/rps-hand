## Live motion restored (motion5)

The reference fit runs once at model load. Live PnP, PnP gun and both current Sweep pages use the original constrained direction driver (`fitImage:false`). The ray-based screen matching is only an explicit static reference-comparison option. PIP/DIP plane locks and base-splay limits are active again; existing temporal settings are preserved. No further mesh changes were made in this restoration. The PnP solver blob remains exactly 186a377f0fb348836b65176dcee72546c9830ed1.

The existing contact panel is visible again. PnP's unconditional collision bypass is removed, restoring optional hand/hand, hand/head and contact controls. Collisions remain optional; capture/check suspends corrections as before. Gun-specific work is deferred at the user’s request. Both model-line overlays are updated after corrections.

motion-check.mjs: 72 poses, no image-target influence, unchanged geometry, preserved lengths and upper-joint planes. Compared locally with the 9d9addf driver: zero point difference. Collision/contact regression tests pass. No claim that raw camera noise is eliminated.

# PnP aligned hand — original solver, corrected palm

`palm-pnp.mjs` is restored exactly from commit `9d9addf`, Git blob `186a377f0fb348836b65176dcee72546c9830ed1`. It uses the existing OpenCV EPnP seed, ITERATIVE refinement, previous-pose seed, error gates and translation continuity. No IPPE, world-orientation seed, angular scoring or orientation/translation fallback remains. This preserves the previously selected EPnP method: https://www.epfl.ch/labs/cvlab/software/multi-view-stereo/epnp/

The regression was in the model references: flattening all 21 reference depths made the fixed palm target planar. `fitPhotoHand(...,{preservePalmRelief:true})` now retains the original model's depth relief, while preserving the traced XY coordinates. `palm-relief.mjs` restores the corresponding mesh depth and rebinds each reference to its actual paired front/back surface midpoint. The pivot stays inside the palm base. No per-frame geometry resizing or change to PnP intrinsics or estimation is introduced.

PnP and its gun lab use this correction. Sweep keeps its existing model/estimator. The gun remains attached using the saved poses; visible lines still read actual model joints. Reference comparison uses the same corrected PnP hand.

Validation: original solver blob identity; 876 synthetic actual-model frames covering both sides, three aspect ratios, two distances and full turns; zero failures, max angular error under 0.000003 degrees. All 42 reference points have paired surfaces, maximum midpoint error below 0.000001 model mm. Reference image 1: 0.040 px RMS / 0.117 px maximum. A real sample image remains subpixel. These numerical checks do not establish live phone accuracy or physical scale. Gun integration checks cover 60 held poses, grip invariance, lengths, calibration, pickup/release/loss.
