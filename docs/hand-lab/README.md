# Hand Pose Lab

Live: https://d14life.github.io/rps-hand/hand-lab/

A separate desktop editor using the original v80 doll asset and fixed joint attachments. It does not modify the movement game or its saved settings.

## Workflow

1. Connect a camera over HTTPS or localhost. Select the desired tracker hand label and right/left model. A sample and image upload also work.
2. Hold a pose and click **Freeze & edit**. The displayed camera frame, normalized tracking signature, palm rotation and finger rotations are captured together. An epoch counter rejects pending results; inference pauses until you resume. Disconnect explicitly stops the camera stream.
3. Select a joint by clicking its dot or the joint list. Orbit with dragging and zoom with the wheel. Edit X bend and base-joint Y sideways with sliders or numbers. Z is locked; middle/tip Y is locked. The local axes are shown at the selected pivot. Follow palm rotation is optional; the default stable view makes editing easier.
4. Set minimum and maximum values, enable the desired axes and click **Save my limits**. Structural no-twist and hinge locks always apply; additional range limits are optional. Limits are separate for each model hand.
5. Name the pose and **Save pose**. Resume live to test the correction. Save additional examples for different shapes. Smaller match tolerance requires a closer match.
6. Export JSON for backup or transfer. Import replaces the current library and limits. Save comparison PNG exports the camera input beside the rendered hand. Browser storage is local to this browser and origin; it is not a cloud backup.

## Joint conventions

Thumb: CMC, MCP, IP. Index/middle/ring/pinky: MCP, PIP, DIP. Fifteen joints display three Euler rotation values each (45 values); locked axes stay at zero. These are editing coordinates, not medical joint angles. Positive rotation uses the right-hand rule about the displayed axis. Try a small change to confirm its visible direction, particularly for the thumb and opposite hand.

The local basis uses Z along the rest finger segment, X normal to that finger’s rest bending plane, and Y = Z cross X. Quaternion = basis * EulerXYZ * inverse(basis). Each joint rotates its descendants. Positions, attachment offsets and segment lengths are fixed. Rest is zero; enabled limits clamp individual editing coordinates, not physical collisions. The lab does not prevent fingers intersecting each other unless your chosen pose/limits avoid it.

## Recognition and reuse

`profile.mjs` is DOM-free and exports schema validation, feature extraction, matching and limit application. The input signature is 21 MediaPipe world landmarks expressed in a normalized palm frame (63 numbers). Translation, uniform scale and rigid rotation are removed. The nearest same-side saved example within the RMS tolerance supplies all 15 corrected rotations. If none matches, the tracker drives the fingers. User limits and structural locks then apply. Palm rotation is independent of the saved correction.

This is nearest-example matching, not neural-network training or guaranteed recognition from arbitrary views/occlusion. Multiple examples can cover variation. The JSON includes the model identifier, axis convention, right/left limits, tolerance, named input signatures, corrected finger angles and optional frozen camera JPEGs. Recognition currently runs only inside this lab. To integrate elsewhere, import the profile, run the same feature/match/limit functions and apply angles using the same local joint bases. Applying these values to a different mesh or rig requires matching or recalibrating its axes first.

Camera processing uses the existing MediaPipe worker locally in the browser. Assets and tracking libraries load from the same dependencies as the project. Saved camera images are included in exported JSON; share only the examples you intend to share.

## Validation

Run `node --test docs/hand-lab/profile.test.mjs`. Tests cover invariant signatures, nearest-pose recognition, hand-side isolation, enabled-only limits, JSON roundtrip and malformed import rejection. Browser checks exercised image inference, freeze/edit/save, a 72-degree correction on recognition, a 45-degree limit, invalid import rejection and valid import. Live webcam performance depends on the user's camera and hardware; image tests do not measure webcam latency.

## Phone camera via QR

On the PC click **Phone camera · QR**, scan the code on your phone, choose front/back camera and tap **Start camera**. Keep the phone page open. Both devices should use the same Wi-Fi; networks with client isolation or blocked WebRTC may not connect. This lab connection uses PeerJS signaling and direct WebRTC video with STUN; no TURN relay is configured. Tracking runs on the PC against the received video. Freeze captures the exact received frame just as it does for a local webcam. Disconnect on the PC or Stop camera on the phone ends sharing. Each connection has a fresh random pairing address, separate from the game's camera codes.


## Planar fingers (lab v3)

Z is structurally locked to zero on all 15 joints. Y is locked at joints 2 and 3; only the base has bend and sideways freedom. A shared rest-plane normal is computed from the two rest segments of each finger, with a lateral-axis fallback for a straight rest chain. Each segment direction is transformed into the parent's frame and projected into that joint's allowed motion before solving its children. This replaces independent unconstrained aiming and Euler decomposition. Base angles jointly cover a directional sweep without Z spin. Imported/recognized poses and manual edits pass through the same structural locks after user limits. Original saved examples remain in storage; their prohibited rotations are ignored when applied. Existing game versions are unchanged. This is a deliberately simplified no-twist thumb, as requested, not a complete anatomical thumb simulation.
