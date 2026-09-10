"""Smallest check that fails if the logic breaks:  python test_rps_hand.py [path\\to\\RPSHand.exe]"""
import os
import subprocess
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rps_hand import retarget, move_from_landmarks, LENGTH, PARENT


def hand(ext):
    """Wrist at origin; each finger has its middle joint at y=1 and its tip at y=2 (extended) or y=0.5 (curled)."""
    pts = np.zeros((21, 3), np.float32)
    for f, (tip, pip) in enumerate(((8, 6), (12, 10), (16, 14), (20, 18))):
        pts[pip] = (f, 1, 0)
        pts[tip] = (f, 2 if ext[f] else 0.5, 0)
    return pts


out = retarget(np.random.default_rng(0).normal(size=(21, 3)).astype(np.float32))
for j, p in PARENT.items():
    assert abs(np.linalg.norm(out[j] - out[p]) - LENGTH[j]) < 1e-5, j
assert move_from_landmarks(hand((0, 0, 0, 0))) == "ROCK"
assert move_from_landmarks(hand((1, 1, 1, 1))) == "PAPER"
assert move_from_landmarks(hand((1, 1, 0, 0))) == "SCISSORS"
assert move_from_landmarks(hand((1, 0, 0, 0))) is None

exe = sys.argv[1] if len(sys.argv) > 1 else None  # optionally test the built exe instead of the script
cmd = [exe] if exe else [sys.executable, os.path.join(HERE, "rps_hand.py")]
shot = os.path.join(HERE, "selfcheck.png")
r = subprocess.run(cmd + ["--source", os.path.join(HERE, "assets", "victory.jpg"), "--shot", shot],
                   capture_output=True, text=True, timeout=120)
assert r.returncode == 0, r.stderr[-2000:]
result = open(shot + ".txt").read()
assert "move=SCISSORS" in result, result
assert os.path.getsize(shot) > 10000
print("OK", result.strip())
