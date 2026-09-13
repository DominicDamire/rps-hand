"""Local-only Video Depth Anything Small metric streaming bridge.
Official upstream code is installed outside the repository by setup-vda.ps1.
No camera images or depth outputs are saved by this server.
"""
import argparse, base64, json, os, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import cv2
import numpy as np
import torch

parser = argparse.ArgumentParser()
parser.add_argument('--runtime', required=True, type=Path)
parser.add_argument('--port', type=int, default=8788)
parser.add_argument('--input-size', type=int, default=224)
args = parser.parse_args()
sys.path.insert(0, str(args.runtime / 'Video-Depth-Anything'))
from video_depth_anything.video_depth_stream import VideoDepthAnything

torch.set_num_threads(min(4, os.cpu_count() or 2))
model = VideoDepthAnything(encoder='vits', features=64, out_channels=[48,96,192,384])
model.load_state_dict(torch.load(args.runtime / 'checkpoints/metric_video_depth_anything_vits.pth', map_location='cpu', weights_only=True), strict=True)
model.eval()
lock = threading.Lock()
last_source = None
last_shape = None
allowed = {'https://d14life.github.io', 'http://127.0.0.1:8776', 'http://localhost:8776'}

def clear_cache():
    model.transform = None
    model.frame_id_list = []
    model.frame_cache_list = []
    model.id = -1

def measure(depth, region):
    points = np.asarray(region.get('polygon', []), dtype=np.float32)
    if points.shape != (5,2) or not np.isfinite(points).all():
        return None
    h,w = depth.shape
    points = points * [w,h]
    mask = np.zeros((h,w), np.uint8)
    cv2.fillConvexPoly(mask, cv2.convexHull(points.astype(np.int32)), 255)
    mask = cv2.erode(mask, np.ones((3,3),np.uint8))
    values = depth[(mask>0)&np.isfinite(depth)&(depth>.03)&(depth<20)]
    if len(values)<16:
        return None
    q1,median,q3 = np.percentile(values,[25,50,75])
    centre = np.mean(points/[w,h],axis=0)
    return {'label':str(region.get('label',''))[:16], 'meters':float(median), 'spread':float((q3-q1)/median), 'pixels':int(len(values)), 'uv':centre.tolist()}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def send_json_headers(self, status=200):
        self.send_response(status)
        origin = self.headers.get('Origin','')
        if origin in allowed:
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.send_header('Access-Control-Allow-Private-Network','true')
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.end_headers()
    def reply(self, data, status=200):
        self.send_json_headers(status)
        try:
            self.wfile.write(json.dumps(data, allow_nan=False).encode())
        except (BrokenPipeError, ConnectionResetError):
            pass
    def do_OPTIONS(self):
        self.reply({},200 if self.headers.get('Origin') in allowed else 403)
    def do_GET(self):
        if self.path!='/health':
            return self.reply({'error':'Not found'},404)
        self.reply({'ready':True,'model':'Metric Video Depth Anything Small','device':'CPU','inputSize':args.input_size,'streaming':'official experimental implementation'})
    def do_POST(self):
        global last_source,last_shape
        if self.path!='/infer' or self.headers.get('Origin') not in allowed:
            return self.reply({'error':'Origin or route not allowed'},403)
        if not lock.acquire(blocking=False):
            return self.reply({'error':'Depth engine busy; no frame queue'},429)
        try:
            size=int(self.headers.get('Content-Length',0))
            if size<1 or size>2_000_000:
                return self.reply({'error':'Frame too large'},413)
            payload=json.loads(self.rfile.read(size))
            encoded=base64.b64decode(payload['image'],validate=True)
            frame=cv2.imdecode(np.frombuffer(encoded,np.uint8),cv2.IMREAD_COLOR)
            if frame is None or max(frame.shape[:2])>960:
                return self.reply({'error':'Invalid frame dimensions'},400)
            source=str(payload.get('source',''))[:100]
            if source!=last_source or frame.shape!=last_shape:
                clear_cache();last_source=source;last_shape=frame.shape
            begin=time.perf_counter()
            depth=model.infer_video_depth_one(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB),input_size=args.input_size,device='cpu',fp32=True)
            ms=(time.perf_counter()-begin)*1000
            valid=depth[np.isfinite(depth)&(depth>0)]
            if not valid.size:
                return self.reply({'error':'No valid depth'},422)
            near,far=np.percentile(valid,[5,95])
            gray=np.uint8(np.clip((depth-near)/max(.001,far-near),0,1)*255)
            colour=cv2.applyColorMap(255-gray,cv2.COLORMAP_TURBO)
            samples=[s for r in payload.get('regions',[])[:3] if (s:=measure(depth,r))]
            ok,png=cv2.imencode('.jpg',colour,[cv2.IMWRITE_JPEG_QUALITY,85])
            self.reply({'image':base64.b64encode(png).decode(),'samples':samples,'ms':ms,'near':float(near),'far':float(far),'width':int(depth.shape[1]),'height':int(depth.shape[0]),'frame':model.id,'device':'CPU'})
        except Exception as e:
            clear_cache()
            self.reply({'error':type(e).__name__+': '+str(e)[:250]},500)
        finally:
            lock.release()

print(f'Video Depth engine ready on http://127.0.0.1:{args.port}; CPU, input {args.input_size}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
