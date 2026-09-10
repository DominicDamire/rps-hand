"""Re-download the test photos and clips (Wikimedia Commons, CC licences) into web/test/.
They are not committed to git because two of them are big. Run:  python fetch_test_media.py
Commons rate-limits aggressively: this script sleeps between requests; rerun if you get 429s."""
import json, os, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "docs" if os.path.isdir(os.path.join(HERE, "docs")) else "web", "test")
UA = {"User-Agent": "rps-hand-test/1.0 (research; contact letanyknow123@gmail.com)"}
FILES = {  # Commons title -> local name
    "File:Shake hand.jpg": "handshake1.jpg", "File:Man and Woman Shaking Hands.jpg": "handshake2.jpg",
    "File:Hands-Fingers-Crossed.jpg": "crossed1.jpg", "File:Fingers Crossed.jpg": "crossed2.jpg", "File:Crossed hands (Unsplash).jpg": "crossed_hands.jpg",
    "File:A Peace sign photo.jpg": "peace.jpg", "File:Manual worker's dirty hand showing a peace sign (50579532757).jpg": "dirty_peace.jpg",
    "File:Robbie paparazzi V sign (cropped).jpg": "robbie_v.jpg", "File:President Donald Trump gestures with a fist pump.jpg": "fist_pump.jpg",
    "File:Raised fist.jpg": "raised_fist.jpg", "File:Rock-paper-scissors (scissors).png": "scissors_png.png", "File:Finger-counting to 5 from thumb.png": "count5.png",
    "File:Handshake.webm": "handshake.webm", "File:Hand Washing.webmhd.webm": "handwash.webm", "File:Clean hands short.webm": "cleanhands.webm",
    "File:Rock, Paper, Scissors.webm": "rps.webm", "File:HandWaveExample.webm": "wave.webm", "File:Finger-counting in Dutch.webm": "counting.webm",
    "File:6-7 hand gesture 2025.webm": "gesture67.webm", "File:Nigerian Young girls playing 'Hand-clap' game.webm": "handclap.webm",
}

def api(params):
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=30))

os.makedirs(OUT, exist_ok=True)
titles = list(FILES)
for chunk in (titles[i:i + 8] for i in range(0, len(titles), 8)):
    r = api({"action": "query", "titles": "|".join(chunk), "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": 900, "format": "json"})
    for pg in r["query"]["pages"].values():
        t = pg.get("title"); ii = pg.get("imageinfo", [{}])[0]
        if not ii: print("missing", t); continue
        out = os.path.join(OUT, FILES[t])
        if os.path.exists(out): print("have", FILES[t]); continue
        url = ii.get("thumburl") if ii["mime"].startswith("image") else ii["url"]
        for attempt in range(3):
            try:
                time.sleep(6)
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as resp, open(out, "wb") as f:
                    f.write(resp.read())
                print(f"{FILES[t]:18s} {os.path.getsize(out) / 1e6:6.2f} MB"); break
            except Exception as e:
                print("retry", FILES[t], e); time.sleep(30)
    time.sleep(5)
print("done ->", OUT)
