# Hand Pose Lab

Live: https://d14life.github.io/rps-hand/hand-lab/

A separate desktop editor using the original v80 doll asset and fixed joint attachments. It does not modify the movement game or its saved settings.

## Workflow

1. Connect a camera over HTTPS or localhost. Select the desired tracker hand label and right/left model. A sample and image upload also work.
2. Hold a pose and click **Freeze & edit**. The displayed camera frame, normalized tracking signature, palm rotation and finger rotations are captured together. An epoch counter rejects pending results; inference pauses until you resume. Disconnect explicitly stops the camera stream.
3. Select a joint by clicking its dot or the joint list. Orbit with dragging and zoom with the wheel. Edit X bend, Y sideways and Z twist with sliders or numbers. The local axes are shown at the selected pivot. Follow palm rotation is optional; the default stable view makes editing easier.
4. Set minimum and maximum values, enable the desired axes and click **Save my limits**. No anatomical limits are enabled by default. Limits are separate for each model hand.
5. Name the pose and **Save pose**. Resume live to test the correction. Save additional examples for different shapes. Smaller match tolerance requires a closer match.
6. Export JSON for backup or transfer. Import replaces the current library and limits. Save comparison PNG exports the camera input beside the rendered hand. Browser storage is local to this browser and origin; it is not a cloud backup.

## Joint conventions

Thumb: CMC, MCP, IP. Index/middle/ring/pinky: MCP, PIP, DIP. Fifteen joints expose three Euler rotation values each (45 values). These are editing coordinates, not medical joint angles. Positive rotation uses the right-hand rule about the displayed axis. Try a small change to confirm its visible direction, particularly for the thumb and opposite hand.

The local basis uses Z along the rest finger segment, X across the knuckles projected perpendicular to Z, and Y = Z cross X. Quaternion = basis * EulerXYZ * inverse(basis). Each joint rotates its descendants. Positions, attachment offsets and segment lengths are fixed. Rest is zero; enabled limits clamp individual editing coordinates, not physical collisions. The lab does not prevent fingers intersecting each other unless your chosen pose/limits avoid it.

## Recognition and reuse

`profile.mjs` is DOM-free and exports schema validation, feature extraction, matching and limit application. The input signature is 21 MediaPipe world landmarks expressed in a normalized palm frame (63 numbers). Translation, uniform scale and rigid rotation are removed. The nearest same-side saved example within the RMS tolerance supplies all 15 corrected rotations. If none matches, the tracker drives the fingers. Limits then apply. Palm rotation is independent of the saved correction.

This is nearest-example matching, not neural-network training or guaranteed recognition from arbitrary views/occlusion. Multiple examples can cover variation. The JSON includes the model identifier, axis convention, right/left limits, tolerance, named input signatures, corrected finger angles and optional frozen camera JPEGs. Recognition currently runs only inside this lab. To integrate elsewhere, import the profile, run the same feature/match/limit functions and apply angles using the same local joint bases. Applying these values to a different mesh or rig requires matching or recalibrating its axes first.

Camera processing uses the existing MediaPipe worker locally in the browser. Assets and tracking libraries load from the same dependencies as the project. Saved camera images are included in exported JSON; share only the examples you intend to share.

## Validation

Run `node --test docs/hand-lab/profile.test.mjs`. Tests cover invariant signatures, nearest-pose recognition, hand-side isolation, enabled-only limits, JSON roundtrip and malformed import rejection. Browser checks exercised image inference, freeze/edit/save, a 72-degree correction on recognition, a 45-degree limit, invalid import rejection and valid import. Live webcam performance depends on the user's camera and hardware; image tests do not measure webcam latency.
