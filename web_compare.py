"""Side-by-side sheet: the real hand (video pane, mirrored) next to the rendered mesh (3D pane, mirror view) for many
hand positions - stills plus paused clip frames. Both panes share the same screen mapping in mirror view, so the same
crop box shows the same hand.   python web_compare.py out.png [extra query, e.g. "&fit=rigged"]
Serve docs/ on :8765 first. Needs the system Microsoft Edge."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw

out = sys.argv[1] if len(sys.argv) > 1 else "compare.png"
extra = sys.argv[2] if len(sys.argv) > 2 else ""
W, H = 900, 600; PANE = 450
CASES = [("img", "victory.jpg", 0), ("img", "test/peace.jpg", 0), ("img", "woman_hands.jpg", 0), ("img", "test/crossed_hands.jpg", 0),
         ("img", "test/raised_fist.jpg", 0), ("img", "test/crossed1.jpg", 0), ("img", "test/handshake2.jpg", 0),
         ("video", "test/counting.webm", 1.5), ("video", "test/counting.webm", 4.0), ("video", "test/counting.webm", 6.5), ("video", "test/counting.webm", 9.0), ("video", "test/counting.webm", 12.0),
         ("video", "test/rps.webm", 3.0), ("video", "test/rps.webm", 9.0), ("video", "test/rps.webm", 20.0), ("video", "test/rps.webm", 31.0),
         ("video", "test/gesture67.webm", 2.0), ("video", "test/gesture67.webm", 5.0), ("video", "test/wave.webm", 3.0), ("video", "test/handclap.webm", 4.0)]

async def run():
    tiles = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": W, "height": H})
        for kind, src, t in CASES:
            await pg.goto(f"http://localhost:8765/?{kind}={src}{extra}", wait_until="load")
            try: await pg.wait_for_function("!document.getElementById('status')", timeout=60000)
            except Exception: print("no tracker", src); continue
            if kind == "video":
                await pg.evaluate(f"(() => {{ const v = document.getElementById('cam'); v.pause(); v.currentTime = {t}; }})()")
                await pg.wait_for_timeout(1500)
                await pg.evaluate("window.dbg.freeze = true")   # keep tracking the paused frame so the hand stays displayed
            await pg.wait_for_timeout(2500)
            hands = await pg.evaluate("window.dbg.lm ? window.dbg.lm() : []")
            fw, fh = await pg.evaluate("[window.dbg.frameW, window.dbg.frameH]")
            hud = await pg.inner_text("#hand")
            shot = f"cmp_{len(tiles):02d}.png"; await pg.screenshot(path=shot)
            im = Image.open(shot).convert("RGB")
            # video pane: object-fit cover of a fw x fh frame in PANE x H, mirrored
            sc = max(PANE / fw, H / fh); dw, dh = fw * sc, fh * sc; ox, oy = (PANE - dw) / 2, (H - dh) / 2
            for lm in hands[:2]:
                xs = [ox + q["x"] * dw for q in lm]; ys = [oy + q["y"] * dh for q in lm]
                x0, x1 = min(xs), max(xs); y0, y1 = min(ys), max(ys); m = 0.35 * max(x1 - x0, y1 - y0) + 12
                x0, x1, y0, y1 = x0 - m, x1 + m, y0 - m, y1 + m
                mx0, mx1 = PANE - x1, PANE - x0   # mirrored
                box = [max(0, mx0), max(0, y0), min(PANE, mx1), min(H, y1)]
                if box[2] - box[0] < 20 or box[3] - box[1] < 20: continue
                real = im.crop((box[0], box[1], box[2], box[3])); mesh = im.crop((box[0] + PANE, box[1], box[2] + PANE, box[3]))
                tiles.append((f"{src.split('/')[-1]} @{t}s" if kind == "video" else src.split('/')[-1], real, mesh, hud[:60]))
            print(f"{src} t={t}: {len(hands)} hands  {hud[:80]}")
        await b.close()
    # sheet: each tile = real | mesh, scaled to 220 px tall
    TH = 220; cols = 4; rows = (len(tiles) + cols - 1) // cols
    cellw = 2 * int(TH * 1.0) + 8
    sheet = Image.new("RGB", (cols * (cellw + 10), rows * (TH + 30)), "black"); d = ImageDraw.Draw(sheet)
    for i, (name, real, mesh, hud) in enumerate(tiles):
        r, c = divmod(i, cols); x = c * (cellw + 10); y = r * (TH + 30) + 22
        for k, im2 in enumerate([real, mesh]):
            w2 = int(im2.width * TH / im2.height); im2 = im2.resize((max(1, min(w2, TH)), TH)); sheet.paste(im2, (x + k * (TH + 8), y))
        d.text((x, y - 18), f"{i}: {name}", fill=(255, 255, 0))
    sheet.save(out); print("sheet", out, len(tiles), "tiles")
asyncio.run(run())
