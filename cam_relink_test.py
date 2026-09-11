r"""Phone-as-camera without re-scanning. PC = Edge A (?cam), phone = Edge B (fake camera) opened from the QR link once.
Then: Stop/Start on the PC, a PC reload, and the phone page reload; each time the PC must get the stream back with the
SAME code and no new scan.   python cam_relink_test.py [pc url base]"""
import asyncio, os, sys
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8767/movement/"
PHONE_ARGS = ["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
              "--use-file-for-fake-video-capture=" + os.path.join(HERE, "fakecam3.y4m")]
PC_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]

async def wait(pg, js, n=40, step=500):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(step)
    return False
PC_LINKED = "!document.getElementById('camlink') && !!document.getElementById('cam').srcObject && document.getElementById('cam').srcObject.active && document.getElementById('cam').readyState >= 2"
TRACKING = "/tracker \\d+ ms/.test(document.getElementById('gestureStats').textContent)"

async def run():
    async with async_playwright() as p:
        bPC = await p.chromium.launch(channel="msedge", headless=True, args=PC_ARGS)
        bPH = await p.chromium.launch(channel="msedge", headless=True, args=PHONE_ARGS)
        pc = await bPC.new_page(viewport={"width": 1000, "height": 640}); ph = await bPH.new_page(viewport={"width": 390, "height": 800})
        errs = []; pc.on("pageerror", lambda e: errs.append("pc: " + str(e))); ph.on("pageerror", lambda e: errs.append("phone: " + str(e)))
        await pc.goto(BASE + "?v=62&cam"); await wait(pc, "/^\\d{3}$/.test(document.getElementById('camCode')?.textContent || '')")
        code = await pc.text_content("#camCode"); print("1 PC shows code", code, "|", await pc.text_content("#camState"))
        await ph.goto(BASE + "camera.html?cam=" + code)            # = scanning the QR once
        ok = await wait(pc, PC_LINKED); await wait(pc, TRACKING, 60)
        print("2 phone linked:", ok, "| phone:", await ph.text_content("#status"), "| PC:", await pc.text_content("#gestureStats"))
        # 3. Stop / Start on the PC: no overlay, stream reused
        await pc.click("#start"); await pc.wait_for_timeout(800); print("3a stopped:", await pc.text_content("#status"))
        await pc.click("#start"); ok = await wait(pc, PC_LINKED, 30) and await wait(pc, TRACKING, 60)
        print("3b started again:", ok, "| overlay shown:", await pc.evaluate("!!document.getElementById('camlink')"), "| PC:", await pc.text_content("#status"))
        # 4. PC reload: same code, the phone re-dials by itself
        await pc.reload(); await wait(pc, "/^\\d{3}$/.test(document.getElementById('camCode')?.textContent || '')")
        code2 = await pc.text_content("#camCode"); ok = await wait(pc, PC_LINKED, 60) and await wait(pc, TRACKING, 60)
        print("4 PC reload: same code:", code2 == code, "(", code2, ") | relinked without a scan:", ok, "| phone:", await ph.text_content("#status"))
        # 5. phone page reload (it remembers the code): re-dials, PC takes the new stream
        await ph.reload(); ok = await wait(pc, PC_LINKED, 60)
        await pc.wait_for_timeout(2500)
        print("5 phone reload: relinked:", ok, "| PC status:", await pc.text_content("#status"), "| tracking:", await pc.evaluate(TRACKING))
        # 6. hidden PC tab does not drop the link
        await pc.evaluate("Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange'))")
        await pc.wait_for_timeout(600); print("6 hidden tab keeps running:", await pc.evaluate("!!document.getElementById('cam').srcObject"), "| status:", await pc.text_content("#status"))
        await pc.screenshot(path=os.path.join(HERE, "cam_relink_pc.png"))
        print("errors:", errs[:6] or "none")
        await bPC.close(); await bPH.close()
asyncio.run(run())
