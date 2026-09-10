"""Render the fist still at several FIST prior angles: python sweep_fist.py"""
import asyncio, itertools
from playwright.async_api import async_playwright
CAMS=[("front","0.0,0.0,-0.02,0.0,0.0,-0.19"),("side","0.14,0.0,-0.19,0.0,0.0,-0.19")]
SETS=["85,100,60","95,110,70","100,120,80","110,130,85"]
async def run():
    async with async_playwright() as p:
        b=await p.chromium.launch(channel="msedge",headless=True,args=["--enable-gpu","--ignore-gpu-blocklist"]); pg=await b.new_page(viewport={"width":900,"height":600})
        for s in SETS:
            for cn,cam in CAMS:
                await pg.goto(f"http://localhost:8765/?img=test/user_fist.jpg&fist={s}&cam={cam}",wait_until="load")
                await pg.wait_for_function("!document.getElementById('status')",timeout=60000); await pg.wait_for_timeout(6000)
                await pg.screenshot(path=f"sw_{s.replace(',','_')}_{cn}.png")
            print("done", s, flush=True)
        await b.close()
asyncio.run(run())
