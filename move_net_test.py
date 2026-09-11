r"""Two players in Dust II through the real PeerJS broker: browser A (fake two-hand camera, tracker on) creates a lobby,
browser B joins from the lobby list; A walks (demo push) and B must see A's body move and A's rigged hand appear.
  python move_net_test.py [url] [y4m]"""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8767/movement/?v=62"
Y4M = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "fakecam3.y4m")
ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream", "--use-file-for-fake-video-capture=" + Y4M]
VIEW = '{"viewFov":"65","phoneFov":"60","handDist":"0.6","handHeight":"-0.05","handTilt":"0"}'

async def page(b, errors, tag):
    pg = await b.new_page(viewport={"width": 1000, "height": 640})
    pg.on("pageerror", lambda e: errors.append(tag + ": " + str(e)))
    pg.on("console", lambda m: errors.append(tag + ": " + m.text[:150]) if m.type == "error" and "favicon" not in m.text else None)
    await pg.add_init_script("localStorage.setItem('move.view2', " + repr(VIEW) + ")")
    await pg.goto(URL + "&t=" + tag); await pg.wait_for_timeout(1500)
    return pg

async def run():
    async with async_playwright() as p:
        bA = await p.chromium.launch(channel="msedge", headless=True, args=ARGS)
        bB = await p.chromium.launch(channel="msedge", headless=True, args=ARGS)
        errors = []
        A = await page(bA, errors, "A"); B = await page(bB, errors, "B")
        await A.click("#start")                                   # A tracks the fake two-hand clip
        await A.click("#online"); await A.wait_for_timeout(500); await A.click("#create")
        for _ in range(30):
            await A.wait_for_timeout(500)
            if "lobby" in (await A.text_content("#net") or "") and "open" in (await A.text_content("#net") or ""): break
        print("A:", await A.text_content("#net"))
        await B.click("#online"); await B.wait_for_timeout(4000)   # opens the lobby list (probes the rooms)
        rooms = await B.text_content("#rooms"); print("B sees:", rooms.strip()[:80])
        if "JOIN" in rooms: await B.click("#rooms button")
        else: await B.click("#quick")
        for _ in range(40):
            await B.wait_for_timeout(500)
            if await B.evaluate("!!window.mv?.net?.opp?.open") and await A.evaluate("!!window.mv?.net?.opp?.open"): break
        print("matched:", await A.text_content("#online"), "/", await B.text_content("#online"), "| A net:", await A.text_content("#net"))
        # A walks forward for a second (demo movement), B should see A move and A's hand
        before = await B.evaluate("window.mv.remote.group.position.toArray().map(v => +v.toFixed(2))")
        await A.evaluate("window.mv.camera.position.z -= 1.5; window.mv.camera.rotation.y = 0.7")   # A steps forward and turns
        await A.wait_for_timeout(5000)
        stats = await B.evaluate("""() => { const r = window.mv.remote; return {
            visible: r.group.visible, before: null, pos: r.group.position.toArray().map(v => +v.toFixed(2)), yaw: +r.group.rotation.y.toFixed(2), hand: r.hand.visible, right: r.hand.right,
            handMesh: !!r.hand.group.children.find(o => o.isSkinnedMesh && o.visible), age: Math.round(performance.now() - r.seen), net: document.getElementById('net').textContent }; }""")
        stats["before"] = before
        aPos = await A.evaluate("window.mv.camera.position.toArray().map(v => +v.toFixed(2))")
        print("A camera:", aPos, "| B's copy of A:", json.dumps(stats))
        print("A stats:", await A.evaluate("window.mv.net.stats"), "B stats:", await B.evaluate("window.mv.net.stats"))
        # look at A from B: stand 2 m in front of A (along A's look direction) and face A
        await B.evaluate("""() => { const c = window.mv.camera, r = window.mv.remote.group, y = r.rotation.y;
            c.position.set(r.position.x - 2 * Math.sin(y), r.position.y, r.position.z - 2 * Math.cos(y)); c.rotation.set(0, y + Math.PI, 0, 'YXZ'); }""")
        await B.click("#collapse"); await B.click("#hidePreview"); await B.wait_for_timeout(400)   # clear the panels off the view
        await B.screenshot(path=os.path.join(HERE, "move_net_B.png")); await A.screenshot(path=os.path.join(HERE, "move_net_A.png"))
        print("errors:", errors[:8] if errors else "none")
        await bA.close(); await bB.close()
asyncio.run(run())
