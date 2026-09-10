"""Screenshot the page in the system Edge (real GPU) after the tracker has started.
  python web_shot.py "?img=victory.jpg" out.png [seconds] [js-to-run-before-shot]
Prints console errors and the HUD text. Serve docs/ on :8765 first."""
import asyncio, sys
from playwright.async_api import async_playwright

query, out = sys.argv[1], sys.argv[2]
secs = float(sys.argv[3]) if len(sys.argv) > 3 else 3
js = sys.argv[4] if len(sys.argv) > 4 else None

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 900, "height": 600})
        msgs = []
        pg.on("console", lambda m: msgs.append(m.type + ": " + m.text[:300]) if m.type in ("error", "warning") and "XNNPACK" not in m.text else None)
        pg.on("pageerror", lambda e: msgs.append("pageerror: " + str(e)[:300]))
        await pg.goto("http://localhost:8765/" + query, wait_until="load")
        try: await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
        except Exception: print("tracker did not start")
        if js: await pg.evaluate(js)
        await pg.wait_for_timeout(secs * 1000)
        print((await pg.inner_text("#top")).replace("\n", " / "))
        await pg.screenshot(path=out)
        print("MSGS:", msgs or "none")
        await b.close()
asyncio.run(run())
