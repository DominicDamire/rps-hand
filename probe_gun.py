"""Gun state probe: python probe_gun.py "<query>" "<js before wait>" secs"""
import asyncio, sys, json
from playwright.async_api import async_playwright
q, js, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
out = sys.argv[4] if len(sys.argv) > 4 else None
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 900, "height": 600}); errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await pg.goto("http://localhost:8765/" + q, wait_until="load")
        await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
        if js: await pg.evaluate(js)
        await pg.wait_for_timeout(secs * 1000)
        r = await pg.evaluate("() => { const g = window.gun; if (!g) return null; const s = g.state; return { mode: s.mode, holder: s.holder, shots: s.shots, armed: s.armed, marks: g.marks, pos: g.obj.position.toArray().map(x => +x.toFixed(3)), flash: s.flashT }; }")
        print(await pg.inner_text("#hand")); print(json.dumps(r)); print("errors:", errs)
        if out: await pg.screenshot(path=out)
        await b.close()
asyncio.run(run())
