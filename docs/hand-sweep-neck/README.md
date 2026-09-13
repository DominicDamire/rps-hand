# Sweep 2.4.14: whole-hand placement and joint neck-contact calibration

## Three changes

1. Both hands and the head/neck/shoulder bust participate in calibration. A shared hand model scale changes hand geometry and camera-space depth together, preserving projection. Bust scale and XYZ offset meet the captured neck contact. All scales are frozen after capture; proportions do not change live.
2. All 21 landmarks contribute to a rigid XYZ translation fit after finger articulation. Wrist and MCPs receive half the total nominal weight, other finger points the other half. Three iteratively reweighted least-squares passes reduce individual outlier influence. At least 17 visible points are required; invalid fits fall back to the existing rotation-corrected palm estimate. This does not move fingers independently or force two hands together.
3. Calibration raycasts through the palm centre against the rendered palm meshes, taking the rear surface facing the neck. The corresponding sampled outer neck surface is fitted to that surface with zero added gap. The former 6 mm joint-centre allowance is removed. Missing surface observations reject capture rather than silently guessing an offset.

## Procedure and assumptions

Hold one extended open hand, palm facing yourself, through the five-second preparation. Move back over eight seconds, finishing with gentle palm contact just below the jaw; hold the final second with hand and face visible. Keep the phone and head still. No pressure is required. The fixed calibration applies to both hands. Recapture uses the original bust coordinates, avoiding accumulated adjustments. Failed capture preserves the prior fit; reset clears it.

Contact determines relative hand/bust scale, not absolute camera distance. The scale split minimizes equal squared log-scale changes from the starting hand and bust sizes: for the observed depth ratio r, bust scale is sqrt(r), hand scale is 1/sqrt(r). This is an explicit modelling prior, not sensor-derived metric depth or a research-calibrated anatomical ratio. Median XYZ offsets align endpoint contact; unstable finishing observations are rejected. The 10-degree phone-tilt assumption and rear allowance remain.

Whole-hand fitting is a compromise when fixed model proportions or finger angle constraints differ from the detected hand. It cannot guarantee every fingertip exactly overlays its landmark. Single-point surface contact does not guarantee that every other part of the palm and neck is free of penetration. Physical depth accuracy requires live validation.

## Fists and assistance

There is no enabled fist-to-fist attachment. Hand-to-hand matching, both collision passes, within-hand thumb contact, saved-pose matching and reference-fist blending start off in the live page. Curled fingers still have the established MCP splay and PIP/DIP plane limits. Optional contact corrections remain available but never alter the calibration.

## Verification

540 ideal actual-doll palm projections, 48 whole-hand XYZ recovery cases, both-hand scale and projection invariance, surface-contact endpoint equations, capture timing, invalid observations, failed recapture and reset are tested. Actual-model browser checks cover 30 open/curled hand cases across changing calibration scales with no accumulated joint drift or projection change; every case found a palm mesh surface. The prior full-bust transform test verifies coherent head/neck/root placement and reset. These are software/geometry checks, not proof of perfect live depth or contact. Private recordings and QA data are excluded from publication.
