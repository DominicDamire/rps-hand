// Upper-body tracker glue for rps_hand: a PoseLandmarker-Lite worker that only runs after the face tracker has
// delivered two results (turn-taking, never concurrently with the face), 512 px frames, results filtered by BodyPose.
// Joints come back in the branch "player" frame relative to the eyes: x = the user's right, y up, z = camera z
// (toward the user's back), metres. docs/index.html converts them to its own frame.
// Adapted from origin/hand-rig-workflow mirror/body/BodyView.js (which read DOM controls and a <video>).
import { BodyPose } from './pose.mjs';

export class BodyView {
  constructor(head, { mode = 'seated', workerUrl = new URL('./worker.mjs', import.meta.url), width = 512 } = {}) {
    this.head = head; this.workerUrl = workerUrl; this.width = width;
    this.mode = mode; this.pose = new BodyPose(mode === 'off' ? 'seated' : mode); this.enabled = mode !== 'off';
    this.lastCapture = -Infinity; this.lastTs = 0; this.busy = false; this.ready = false; this.failed = false; this.error = null;
    this.frames = 0; this.fps = 0; this.latency = 0; this.inferenceMs = 0; this.windowStart = performance.now();
    this.generation = 0; this.lastFaceCount = 0; this.captureAt = new Map(); this.joints = null;
    addEventListener('pagehide', () => this.stop(), { once: true });
  }
  setMode(mode) {
    this.mode = mode; this.enabled = mode !== 'off'; this.pose.recenter(this.enabled ? mode : 'seated');
    if (!this.enabled) this.stop(); else this.failed = false;
  }
  recenter() { this.pose.recenter(this.enabled ? this.mode : 'seated'); }
  stop() { this.generation++; this.worker?.terminate(); this.worker = null; this.ready = false; this.busy = false; clearTimeout(this.timer); }
  start() {
    try {
      this.worker = new Worker(this.workerUrl, { type: 'module' });
      const fail = e => { this.error = e?.message || String(e); this.stop(); this.failed = true; };
      this.worker.onerror = e => fail(e.message || 'worker error');
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'error') return fail(data.message);
        if (data.type === 'ready') { this.ready = true; this.delegate = data.delegate; clearTimeout(this.timer); return; }
        if (data.type === 'pose') {
          this.busy = false; const now = performance.now(), cap = this.captureAt.get(data.ts); this.captureAt.delete(data.ts);
          if (cap != null) this.latency = now - cap; this.inferenceMs = data.inferenceMs ?? 0;
          this.frames++; if (now - this.windowStart >= 1000) { this.fps = Math.round(this.frames * 1000 / (now - this.windowStart)); this.frames = 0; this.windowStart = now; }
          this.pose.receive(data.pose, now);
        }
      };
      this.timer = setTimeout(() => fail('body worker init timeout'), 60000);
    } catch (e) { this.error = e.message; this.failed = true; this.stop(); }
  }
  wantsFrame(now) {
    const interval = Math.max(this.latency, this.head.perf.latency) > 65 ? 125 : 66;
    return this.enabled && this.head.mode !== 'off' && !document.hidden && this.ready && !this.busy && !this.failed && !this.head.busy &&
      this.head.completedFrames - this.lastFaceCount >= 2 && now - this.lastCapture >= interval;
  }
  // Two completed face frames earn one body frame. Serial inference prevents GPU competition, while this turn-taking
  // prevents body starvation on CPU. src: <video> or <img>.
  async capture(src, now = performance.now()) {
    if (!this.wantsFrame(now)) return false;
    const W = src.videoWidth || src.naturalWidth || src.width, H = src.videoHeight || src.naturalHeight || src.height;
    if (!W || !H) return false;
    this.busy = true; this.lastCapture = now; this.lastFaceCount = this.head.completedFrames;
    const generation = this.generation;
    try {
      const width = Math.min(this.width, W);
      const frame = await createImageBitmap(src, { resizeWidth: width, resizeHeight: Math.round(width * H / W) });
      if (generation !== this.generation) { frame.close(); this.busy = false; return false; }
      const ts = this.lastTs = Math.max(this.lastTs + 1, Math.floor(now)); this.captureAt.set(ts, now);
      this.worker.postMessage({ frame, ts }, [frame]);
      return true;
    } catch (e) { if (generation === this.generation) { this.error = e.message; this.stop(); this.failed = true; } return false; }
  }
  // eyePosition: the head position in the same player frame the joints use (only differences matter: the seated
  // "head carries body" rule anchors the hips to it). headSeen: a face within 650 ms.
  update(now, dt, headSeen, eyePosition = [0, 0, 0]) {
    const active = this.enabled && this.head.mode !== 'off' && !document.hidden;
    if (active && !this.worker && !this.failed && this.head.ready) this.start();
    this.joints = this.pose.update(now, dt, active && headSeen, eyePosition, this.mode === 'seated');
    return this.joints;
  }
  status(now) {
    const mode = this.mode;
    return !this.enabled ? 'body: off' : this.failed ? 'body: unavailable' : !this.ready ? 'body: loading'
      : now - this.pose.seen > 500 ? (this.joints ? 'body: held' : 'body: no shoulders')
      : mode === 'standing' && !this.pose.hipsTracked ? 'body: show hips'
      : !this.pose.neutral ? `body: calibrating ${Math.min(100, Math.round(this.pose.samples.length / 12 * 100))}%`
      : `body: ${mode} ${this.fps}fps ${Math.round(this.latency)}ms`;
  }
}
