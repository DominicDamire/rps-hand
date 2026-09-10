"""Dump image landmarks vs displayed GL points for a still: python probe_chir.py test/raised_fist.jpg"""
import asyncio, sys, json
from playwright.async_api import async_playwright
img = sys.argv[1]; extra = sys.argv[2] if len(sys.argv) > 2 else ""
JS = """() => { const s = Object.values(dbg.slots).find(s => s.imgLm); if (!s) return null; const lm = s.imgLm, g = s.gl;
  const o = {name: s.name, img: {}, gl: {}}; for (const i of [0,4,5,9,17,20]) { o.img[i] = [+lm[i].x.toFixed(3), +lm[i].y.toFixed(3), +lm[i].z.toFixed(3)]; o.gl[i] = [+g[3*i].toFixed(3), +g[3*i+1].toFixed(3), +g[3*i+2].toFixed(3)]; }
  o.world = s.raw ? [] : null; return o; }"""
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 900, "height": 600})
        await pg.goto(f"http://localhost:8765/?img={img}{extra}", wait_until="load")
        await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
        await pg.wait_for_timeout(6000)
        print(await pg.inner_text("#hand")); print(json.dumps(await pg.evaluate(JS)))
        await b.close()
asyncio.run(run())
