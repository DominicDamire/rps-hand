# Video Depth 1

Separate Sweep 2.4.18 fork with official Metric Video Depth Anything Small streaming inference on a loopback PC helper. See setup.html and tools/setup-vda.ps1. Weights and runtime are outside the repository. Preview defaults on only after Start; positional contribution defaults off and is never persisted on reload.

The optional module samples wrist/MCP palm regions, anchors each hand to a frozen map/base reference, and blends 25% map estimate with 75% calibrated palm distance. It rejects stale, moved, noisy or disagreeing observations. It pauses during the sweep. Sweep rear-plane and explicit contact options run afterward. It is a conservative experiment, not measured depth or a replacement for the sweep.

Tests: real CPU inference on two sequential frames, browser preview, fusion regression tests and inherited sweep geometry tests. Sample CPU inference was 148/254 ms at 224 input size; sustained browser preview approximately 2.5 updates/s including scheduling. Live phone accuracy is not established by these checks.

Official source revision: 4f5ae23172ba60fd7bc11ef671cca678842c7072. See upstream license and model usage terms. No upstream weights or private recordings are published here.
