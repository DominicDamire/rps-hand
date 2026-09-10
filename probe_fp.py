"""First-person footprint check: where the video pane shows each landmark vs where handCam projects the shown 3D points.
python probe_fp.py test/user_fist.jpg"""
import asyncio, sys, json
from playwright.async_api import async_playwright
img = sys.argv[1]
JS = """() => { const s = Object.values(dbg.slots).find(s => s.imgLm); if (!s) return null;
  const pane = document.querySelector('.pane').getBoundingClientRect(), W = pane.width, H = pane.height, fw = dbg.frameW, fh = dbg.frameH;
  const sc = Math.max(W / fw, H / fh), dw = fw * sc, dh = fh * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;   // object-fit: cover
  const vid = s.imgLm.map(l => [W - (ox + l.x * dw), oy + l.y * dh]);   // mirrored pane pixels
  const cam = window.handCam, g = s.hist[s.hist.length - 1].a, v = new THREE.Vector3(), out = [];
  for (let i = 0; i < 21; i++) { v.set(g[3*i], g[3*i+1], g[3*i+2]).project(cam); out.push([(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]); }
  return { W, H, fw, fh, fov: cam.fov, vid: vid.map(p => p.map(x => +x.toFixed(1))), fp: out.map(p => p.map(x => +x.toFixed(1))) }; }"""
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 900, "height": 600})
        await pg.goto(f"http://localhost:8765/?img={img}&view=0&lines=1", wait_until="load")
        await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
        await pg.wait_for_timeout(6000)
        await pg.add_script_tag(content="import('three').then(m => window.THREE = m)", type="module"); await pg.wait_for_timeout(500)
        r = await pg.evaluate(JS); print(await pg.inner_text("#hand"))
        if r:
            print("pane", r["W"], r["H"], "frame", r["fw"], r["fh"], "handCam fov", round(r["fov"],1))
            for i in [0,4,5,8,9,12,17,20]: print(i, "video", r["vid"][i], "fp", r["fp"][i], "d", [round(a-b,1) for a,b in zip(r["fp"][i], r["vid"][i])])
        await pg.screenshot(path="shot_fp_" + img.split("/")[-1].split(".")[0] + ".png")
        await b.close()
asyncio.run(run())
