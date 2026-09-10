"""Record the page running a clip: python web_video.py "?video=test/counting.webm" out_dir [seconds]. Writes a .webm."""
import asyncio, sys, os, glob
from playwright.async_api import async_playwright
q, outdir, secs = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 20
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 900, "height": 600}, record_video_dir=outdir, record_video_size={"width": 900, "height": 600})
        pg = await ctx.new_page(); await pg.goto("http://localhost:8765/" + q, wait_until="load")
        await pg.wait_for_function("!document.getElementById('status')", timeout=60000); await pg.wait_for_timeout(secs * 1000)
        print(await pg.inner_text("#stats")); await ctx.close(); await b.close()
asyncio.run(run())
