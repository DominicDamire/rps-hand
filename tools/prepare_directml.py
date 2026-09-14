"""Keep upstream FP32 inference out of autocast, which DirectML does not support.
No model weights, temporal logic or depth calculations are changed.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1])/'Video-Depth-Anything/video_depth_anything/video_depth_stream.py'
s=p.read_text(encoding='utf-8')
s=s.replace('with torch.autocast(device_type=device, enabled=(not fp32)):', 'with (nullcontext() if fp32 else torch.autocast(device_type=device, enabled=True)):')
if 'from contextlib import nullcontext' not in s:
    s='from contextlib import nullcontext\n'+s
p.write_text(s,encoding='utf-8')
