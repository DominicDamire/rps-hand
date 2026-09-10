r"""The rest of the Online panel, live: QUICK MATCH with no lobby (B opens one), REFRESH on A shows it, CLOSE hides the
panel, QUICK MATCH on A joins B, packets stop -> the other player disappears after 3 s and returns when they resume,
A leaves -> B gets 'opponent left' and the Online button resets."""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
URL = sys.argv[1] if len(sys.argv) > 1 else "https://d14life.github.io/rps-hand/movement/?v=62"
ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
async def page(b, tag):
    pg = await b.new_page(viewport={"width": 1000, "height": 640}); await pg.goto(URL + "&t=" + tag); await pg.wait_for_timeout(1500); return pg
async def until(pg, js, n=40):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(500)
    return False
async def run():
    async with async_playwright() as p:
        bA = await p.chromium.launch(channel="msedge", headless=True, args=ARGS); bB = await p.chromium.launch(channel="msedge", headless=True, args=ARGS)
        A = await page(bA, "A"); B = await page(bB, "B")
        # 1. B: QUICK MATCH with nobody online -> opens a lobby and waits
        await B.click("#online"); await B.wait_for_timeout(300); await B.click("#quick")
        ok = await until(B, "/lobby \\d+ open/.test(document.getElementById('net').textContent)")
        print("1 QUICK MATCH alone ->", await B.text_content("#net"), "| ok" if ok else "| FAIL")
        # 2. A: Online opens the panel, REFRESH lists B's lobby, CLOSE hides the panel
        await A.click("#online"); await A.wait_for_timeout(300)
        print("2a panel shown:", await A.evaluate("!document.getElementById('lobby').hidden"))
        await A.click("#refresh"); await A.wait_for_timeout(4000)
        rooms = (await A.text_content("#rooms")).strip(); print("2b REFRESH ->", rooms[:60], "| ok" if "JOIN" in rooms else "| FAIL")
        await A.click("#closeLobby"); print("2c CLOSE hides:", await A.evaluate("document.getElementById('lobby').hidden"))
        # 3. A: QUICK MATCH joins B's lobby
        await A.click("#online"); await A.wait_for_timeout(300); await A.click("#quick")
        ok = await until(A, "!!window.mv?.net?.opp?.open") and await until(B, "!!window.mv?.net?.opp?.open")
        print("3 QUICK MATCH joins ->", await A.text_content("#online"), "/", await B.text_content("#online"), "| roles:", await A.text_content("#net"), "/", await B.text_content("#net"), "| ok" if ok else "| FAIL")
        print("   panel hidden after match:", await A.evaluate("document.getElementById('lobby').hidden"), "| Online button inert now:", await A.evaluate("() => { document.getElementById('online').click(); return document.getElementById('lobby').hidden; }"))
        await until(B, "window.mv.remote.group.visible"); print("4 B sees A:", await B.evaluate("window.mv.remote.group.visible"), "at", await B.evaluate("window.mv.remote.group.position.toArray().map(v=>+v.toFixed(1))"), "A is at", await A.evaluate("window.mv.camera.position.toArray().map(v=>+v.toFixed(1))"))
        # 5. A goes silent (channel open, no packets): B hides A after 3 s; A resumes: B shows A again
        await A.evaluate("window.mv._send = window.mv.net.sendHands; window.mv.net.sendHands = () => {}")
        await B.wait_for_timeout(3800); print("5a silent 3.8 s -> hidden:", not await B.evaluate("window.mv.remote.group.visible"))
        await A.evaluate("window.mv.net.sendHands = window.mv._send"); await B.wait_for_timeout(600); print("5b resumed -> visible:", await B.evaluate("window.mv.remote.group.visible"))
        # 6. A leaves: B is told, button resets, A's body goes away
        await A.close()
        ok = await until(B, "document.getElementById('online').textContent === 'Online'", 30)
        print("6 A left ->", await B.text_content("#net"), "| button:", await B.text_content("#online"), "| body gone:", not await B.evaluate("window.mv.remote.group.visible"), "| ok" if ok else "| FAIL")
        await bA.close(); await bB.close()
asyncio.run(run())
