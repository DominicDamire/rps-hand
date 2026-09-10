import asyncio, sys, math
from playwright.async_api import async_playwright
CASES=[("img","victory.jpg",0),("img","test/peace.jpg",0),("video","test/counting.webm",12.0),("video","test/counting.webm",9.0),("img","woman_hands.jpg",0)]
JS="""(() => { const out=[]; for (const s of Object.values(window.dbg.slots)) { if (!s.gl) continue; const g=s.gl; const P=i=>[g[3*i],g[3*i+1],g[3*i+2]];
 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], ang=(u,v)=>{const d=u[0]*v[0]+u[1]*v[1]+u[2]*v[2], n=Math.hypot(...u)*Math.hypot(...v); return Math.acos(Math.max(-1,Math.min(1,d/n)))*180/Math.PI;};
 const fin={}; for (const m of [5,9,13,17]) { const a=sub(P(m+1),P(m)), b=sub(P(m+2),P(m+1)), c=sub(P(m+3),P(m+2)); const a2=[a[0],a[1],0], b2=[b[0],b[1],0], c2=[c[0],c[1],0];
   fin[m]={pip:ang(a,b).toFixed(0), dip:ang(b,c).toFixed(0), pip_img:ang(a2,b2).toFixed(0), dip_img:ang(b2,c2).toFixed(0), z:[P(m)[2],P(m+1)[2],P(m+2)[2],P(m+3)[2]].map(v=>(v*100).toFixed(1)), len:[Math.hypot(...a),Math.hypot(...b),Math.hypot(...c)].map(v=>(v*1000).toFixed(0))}; }
 out.push({name:s.name, fit:s.fit, fin}); } return out; })()"""
async def run():
    async with async_playwright() as p:
        b=await p.chromium.launch(channel="msedge",headless=True,args=["--enable-gpu","--ignore-gpu-blocklist","--autoplay-policy=no-user-gesture-required"])
        pg=await b.new_page(viewport={"width":900,"height":600})
        for kind,src,t in CASES:
            await pg.goto(f"http://localhost:8765/?{kind}={src}",wait_until="load")
            await pg.wait_for_function("!document.getElementById('status')",timeout=60000)
            if kind=="video":
                await pg.evaluate(f"(() => {{ const v=document.getElementById('cam'); v.pause(); v.currentTime={t}; }})()"); await pg.wait_for_timeout(1500); await pg.evaluate("window.dbg.freeze=true")
            await pg.wait_for_timeout(2500)
            for h in await pg.evaluate(JS):
                print(f"== {src} t={t} hand {h['name']} fit {h['fit']*100:.1f}%")
                for m,f in h['fin'].items(): print(f"   finger {m:>2}: bend3D pip {f['pip']:>3} dip {f['dip']:>3} | bendImg pip {f['pip_img']:>3} dip {f['dip_img']:>3} | z(cm) {f['z']} | seg mm {f['len']}")
        await b.close()
asyncio.run(run())
