# PnP Photo Hand 1

Separate fit of the current rigid hand to the first user landmark screenshot. 21 manually checked pixel centres are stored in photo-hand.mjs. No user photos or camera footage are published.

The old tracking origin was the mechanical wrist-ball pivot. The new origin is the proximal 3 mm band centroid of the largest outer-palm mesh, 44.1 model mm from that pivot. Mechanical wrist parts remain behind that origin. Both hands use mirrored fixed proportions; the PnP model and driver read the same modified rest points.

Projected knuckle and segment proportions come from the first screenshot. Existing rest normal offsets are retained because 2D screenshots do not establish 3D depth. The palm is deformed once using inverse-distance control-point displacements; finger segments are transformed once to the reference endpoints. Existing runtime thickness controls remain, and extra tip extension starts at zero so it does not add length beyond the reference.

The second screenshot is not used to resize the rig: its different projected lengths may include pose/foreshortening. This is not a metric hand scan and cannot guarantee matching every rotation. reference.html compares traced source points and the fixed model at matching flat-view scale. Live PnP, near/neck captures and orbit view are retained. Recalibrate the new geometry; previous versions are unchanged.
