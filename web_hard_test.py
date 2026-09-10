"""Hard tests for the web tracker. Runs in the system Edge (new headless, real GPU) so the tracker runs at
phone speed (~30 fps). Serve docs/ on :8765 first (python -m http.server 8765 --directory docs).   python web_hard_test.py [seconds_per_video] [stills|videos|all]
Stills carry an expected move; videos print motion metrics from window.dbg:
  two-hand %   frames where MediaPipe returned 2 hands
  held         frames a lost hand rode along with the other one (handshake rule)
  spikes/snaps/handovers  whole-hand jumps >12 cm rejected / accepted / passed to the other slot
  dispJumps    displayed palm moved >10 cm between two rendered frames = what the player sees jump
  reproj       mean distance displayed lines vs latest tracker lines, % of frame width (0 = exact)
  lag          mean distance between the raw landmarks of a frame and what was ON SCREEN when that frame was captured
               (includes pipeline latency; the number the player feels as drift on fast moves)
  moves        histogram of the detected move per tracker frame"""
import asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://localhost:8765/"
QS = os.environ.get("QS", "")   # extra query string for every run, e.g. QS="&head=0"
STILLS = [  # (file, expected move or None)
    ("victory.jpg", "SCISSORS"), ("test/peace.jpg", "SCISSORS"), ("test/dirty_peace.jpg", "SCISSORS"), ("test/robbie_v.jpg", "SCISSORS"),
    ("test/fist_pump.jpg", "ROCK"), ("test/raised_fist.jpg", "ROCK"), ("woman_hands.jpg", "PAPER"), ("test/crossed_hands.jpg", "PAPER"),
    ("test/scissors_png.png", "SCISSORS"), ("test/count5.png", None), ("test/crossed1.jpg", None), ("test/crossed2.jpg", None),
    ("test/handshake1.jpg", None), ("test/handshake2.jpg", None),
]
ALL_VIDEOS = [("test/rps.webm", "predict"), ("test/wave.webm", "predict"), ("test/counting.webm", "predict"), ("test/gesture67.webm", "predict"),
          ("test/handclap.webm", "predict"), ("test/cleanhands.webm", "predict"), ("test/handwash.webm", "predict")]
VIDEOS = [v for v in ALL_VIDEOS if len(sys.argv) < 4 or any(k in v[0] for k in sys.argv[3].split(","))]
SECS = int(sys.argv[1]) if len(sys.argv) > 1 else 24
WHAT = sys.argv[2] if len(sys.argv) > 2 else "all"
ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
RESET = "Object.assign(window.dbg, {frames:0,two:0,held:0,labelFlips:0,maxJump:0,bigJumps:0,spikes:0,snaps:0,handovers:0,dispJumps:0,reprojN:0,reprojSum:0,lagSum:0,lagN:0,depthClamps:0,fitSum:0,moves:{ROCK:0,PAPER:0,SCISSORS:0,none:0}})"

def fmt(d, stats):
    fr = max(d["frames"], 1); rp = 100 * d["reprojSum"] / max(d["reprojN"], 1); lag = 100 * d["lagSum"] / max(d["lagN"], 1); m = d["moves"]
    return (f"frames {d['frames']} | two-hand {100 * d['two'] / fr:.0f}% | held {d['held']} | flips {d['labelFlips']} | rawJumps {d['bigJumps']} | spikes {d['spikes']} snaps {d['snaps']} handovers {d['handovers']} "
            f"| dispJumps {d['dispJumps']} | depthClamps {d.get('depthClamps', 0)} | reproj {rp:.2f}% | lag {lag:.2f}% | fit {100 * d['fitSum'] / max(d['reprojN'], 1):.1f}% | moves R{m['ROCK']} P{m['PAPER']} S{m['SCISSORS']} -{m['none']}  ||  {stats}")

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=ARGS)
        pg = await b.new_page(viewport={"width": 900, "height": 600})
        errs = []
        pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" and "XNNPACK" not in m.text and "404" not in m.text else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:200]))
        if WHAT in ("all", "stills"):
            ok = n = 0
            for img, expect in STILLS:
                name = os.path.basename(img).split(".")[0]
                await pg.goto(f"{BASE}?img={img}{QS}", wait_until="load")
                try: await pg.wait_for_function("/HANDS: [RL] /.test(document.getElementById('hand').textContent)", timeout=20000)
                except Exception: pass
                await pg.wait_for_timeout(2500)
                move = (await pg.inner_text("#move")).replace("MOVE: ", ""); hands = await pg.inner_text("#hand")
                verdict = ""
                if expect: n += 1; ok += move == expect; verdict = "OK " if move == expect else f"WRONG (want {expect})"
                print(f"[img {name:14s}] {verdict:22s} move={move:9s} {hands}")
                await pg.screenshot(path=os.path.join(HERE, f"hard_{name}.png"))
            print(f"STILLS: {ok}/{n} labelled moves correct")
            await pg.goto(f"{BASE}?img=victory.jpg{QS}", wait_until="load")
            await pg.wait_for_function("/HANDS: [RL] /.test(document.getElementById('hand').textContent)", timeout=30000)
            await pg.evaluate("window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {beta: 60, gamma: 0, alpha: 0}))")
            await pg.wait_for_timeout(1500); await pg.evaluate(RESET); await pg.wait_for_timeout(1500)
            d = await pg.evaluate("window.dbg"); print(f"[tilt 30 up      ] reproj {100 * d['reprojSum'] / max(d['reprojN'], 1):.2f}%  ||  {(await pg.inner_text('#stats')).replace(chr(10), ' / ')}")
            # face stills (build 16): the tracked eye point projected back into the picture vs the face mesh's outer-eye midpoint, % frame width
            for img, want in [("woman_hands.jpg", "head"), ("test/seated_desk.jpg", "body")]:
                name = os.path.basename(img).split(".")[0]
                await pg.goto(f"{BASE}?img={img}{QS}", wait_until="load")
                try: await pg.wait_for_function("window.dbg && window.dbg.head && window.dbg.head.reproj != null", timeout=30000)
                except Exception: pass
                await pg.wait_for_timeout(6000)
                h = await pg.evaluate("window.dbg.head"); st = (await pg.inner_text("#stats")).replace(chr(10), " / ")
                hs = await pg.evaluate("window.dbg.headView ? window.dbg.headView.status(performance.now()) : 'head: off'"); bs = await pg.evaluate("window.dbg.bodyView ? window.dbg.bodyView.status(performance.now()) : 'body: off'")
                ok = h is not None and h["reproj"] < 0.01
                print(f"[face {name:11s}] {'OK ' if ok else 'FAIL'} head reproj {100 * h['reproj'] if h else -1:.2f}% depth {h['depth'] if h else 0:.2f} m yaw {h['yaw'] * 180 / 3.14159 if h else 0:.0f}° | {hs} | {bs}  ||  {st}")
                await pg.screenshot(path=os.path.join(HERE, f"hard_{name}_face.png"))
        if WHAT in ("all", "videos"):
            for vid, mode in VIDEOS:
                name = os.path.basename(vid).split(".")[0]
                await pg.goto(f"{BASE}?video={vid}{QS}", wait_until="load")
                try: await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
                except Exception: print(f"[vid {name}] tracker did not start"); continue
                while (await pg.inner_text("#mode")) != "MODE: " + mode: await pg.click("#mode")
                await pg.evaluate(RESET)
                for t in range(0, SECS, 6):
                    await pg.wait_for_timeout(6000)
                    await pg.screenshot(path=os.path.join(HERE, f"hard_{name}_{t + 6:02d}s.png"))
                d = await pg.evaluate("window.dbg"); stats = (await pg.inner_text("#stats")).replace("\n", " / ")
                print(f"[vid {name:10s}] {fmt(d, stats)}")
        print("ERRORS:", errs or "none")
        await b.close()

asyncio.run(run())
