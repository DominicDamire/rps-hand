# Direct Lines Lab

Separate experimental page at /hand-lines/. Original hand-lab remains unchanged.

The three segments of each digit use consecutive tracker endpoints. Each joint is translated to its target, oriented with a quaternion from the original segment direction to the tracked direction, and its mesh is stretched axially to the target length. No learned poses, screenshot offsets, hinge locks, fist preset, thumb IK, stillness hold or speed cap runs in this live path. Palm orientation still uses the palm frame and depth remains inferred from one camera. The original rigid palm is not reshaped to match individual palm proportions; seams can occur at translated knuckle attachments.

Controls at the top: smoothing in milliseconds, positional deadband in estimated model millimetres, thumb-tip contact proximity in source-image pixels, and distal coupling strength. All default to zero for direct tracking. Contact compares thumb to each fingertip, snaps endpoints to their midpoint and releases at 1.5 times the entry distance. It does not classify skin pixels or prove physical contact. Coupling optionally makes the final finger bend follow the preceding bend; it excludes the thumb. These assists intentionally deviate from raw points.

Validation: direct-check.html loads the real asset and verifies both hands' joint and transformed mesh endpoints against synthetic targets, with maximum error below 1e-6 metres. Sample image tracking loaded successfully. Actual phone-camera quality and occluded depth remain unverified.
