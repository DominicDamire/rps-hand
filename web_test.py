"""Headless check of the web page: python web_test.py [url]  (default localhost:8765)"""
import asyncio, sys
from playwright.async_api import async_playwright
URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/") + "?img=victory.jpg"
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":900,"height":600})
        errs=[]; pg.on("console", lambda m: errs.append(m.text[:300]) if m.type=="error" and "XNNPACK" not in m.text else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)[:300]))
        await pg.goto(URL, wait_until="load")
        try:
            await pg.wait_for_function("document.getElementById('move').textContent.includes('SCISSORS')", timeout=90000); print("RESULT: SCISSORS")
        except Exception as e: print("TIMEOUT", type(e).__name__)
        await pg.wait_for_timeout(2500)
        print("HAND:", await pg.inner_text("#hand")); print("STATS:", (await pg.inner_text("#stats")).replace("\n"," / "))
        game = pg.locator("#game")
        if await game.count(): print("GAME:", await game.inner_text())
        mode = pg.locator("#mode")
        if await mode.is_visible():
            for i in range(3):
                await mode.click(); await pg.wait_for_timeout(600); print("MODE:", await mode.inner_text(), "| move:", await pg.inner_text("#move"))
        else: print("MODE: hidden in the current hands-only UI")
        await pg.screenshot(path="web_check3.png"); print("ERRORS:", errs or "none")
        await b.close()
asyncio.run(run())
