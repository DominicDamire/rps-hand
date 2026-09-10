import asyncio, sys
from playwright.async_api import async_playwright
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 900, "height": 600}); msgs = []
        pg.on("console", lambda m: msgs.append(m.type + ": " + m.text[:200]) if m.type == "error" else None)
        pg.on("pageerror", lambda e: msgs.append("pageerror: " + str(e)[:300]))
        await pg.goto("http://localhost:8765/place.html", wait_until="load"); await pg.wait_for_timeout(6000)
        await pg.click("#j8"); await pg.mouse.click(520, 300); await pg.wait_for_timeout(500)
        await pg.screenshot(path="shot_place.png"); print("json:", (await pg.input_value("#out"))[:120]); print("MSGS:", msgs or "none")
        await b.close()
asyncio.run(run())
