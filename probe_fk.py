"""Tracked vs FK geometry for a still: python probe_fk.py test/raised_fist.jpg [extra query]"""
import asyncio, sys, json, math
from playwright.async_api import async_playwright
img = sys.argv[1]; extra = sys.argv[2] if len(sys.argv) > 2 else ""
JS = "() => ({ fk: dbg.fk.map(p => [p.x, p.y, p.z]), tr: dbg.fkIn.map(p => [p.x, p.y, p.z]), bind: dbg.bind.map(p => [p.x, p.y, p.z]) })"
PARENT = {1:0,2:1,3:2,4:3,5:0,6:5,7:6,8:7,9:0,10:9,11:10,12:11,13:0,14:13,15:14,16:15,17:0,18:17,19:18,20:19}
def sub(a,b): return [a[i]-b[i] for i in range(3)]
def norm(a): return math.sqrt(sum(x*x for x in a))
def ang(a,b,c):  # bend at b between segments ab and bc, degrees (0 = straight)
    u=sub(b,a); v=sub(c,b); d=sum(u[i]*v[i] for i in range(3))/(norm(u)*norm(v)+1e-12); return math.degrees(math.acos(max(-1,min(1,d))))
def segdist(p,a,b):  # point to segment
    ab=sub(b,a); t=max(0,min(1,sum((p[i]-a[i])*ab[i] for i in range(3))/(norm(ab)**2+1e-12))); q=[a[i]+t*ab[i] for i in range(3)]; return norm(sub(p,q))
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="msedge", headless=True, args=["--enable-gpu", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 900, "height": 600})
        await pg.goto(f"http://localhost:8765/?img={img}{extra}", wait_until="load")
        await pg.wait_for_function("!document.getElementById('status')", timeout=60000); await pg.wait_for_timeout(6000)
        print(await pg.inner_text("#hand")); r = await pg.evaluate(JS); await b.close()
    fk, tr, bind = r["fk"], r["tr"], r["bind"]
    s = norm(sub(tr[0],tr[9]))/norm(sub(bind[0],bind[9]))
    print(f"scale {s:.3f}  palm tracked {norm(sub(tr[0],tr[9]))*100:.1f} cm")
    for name, ch in [("thumb",[1,2,3,4]),("index",[5,6,7,8]),("middle",[9,10,11,12]),("ring",[13,14,15,16]),("pinky",[17,18,19,20])]:
        lt=[norm(sub(tr[j],tr[PARENT[j]]))*100 for j in ch[1:]]; lb=[norm(sub(bind[j],bind[PARENT[j]]))*s*100 for j in ch[1:]]
        fl=sum(lt); r_=norm(sub(tr[ch[-1]],tr[ch[0]]))/fl
        bt=[ang(tr[ch[k-1]],tr[ch[k]],tr[ch[k+1]]) for k in range(1,3)]; bf=[ang(fk[ch[k-1]],fk[ch[k]],fk[ch[k+1]]) for k in range(1,3)]
        print(f"{name:6s} len tracked {['%.1f'%x for x in lt]} bind*s {['%.1f'%x for x in lb]} | tip/knuckle r={r_:.2f} | bends tracked {['%.0f'%x for x in bt]} fk {['%.0f'%x for x in bf]}")
    # thumb tip vs index proximal segment
    print(f"thumb tip -> index proximal: tracked {segdist(tr[4],tr[5],tr[6])*100:.1f} cm  fk {segdist(fk[4],fk[5],fk[6])*100:.1f} cm ; thumb tip -> index middle seg: tracked {segdist(tr[4],tr[6],tr[7])*100:.1f} fk {segdist(fk[4],fk[6],fk[7])*100:.1f}")
    # fingertip height above the palm plane (wrist, index & pinky knuckles), + = palm side
    import itertools
    def cross(a,b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    for lab, P in [("tracked",tr),("fk",fk)]:
        n=cross(sub(P[5],P[0]),sub(P[17],P[0])); n=[x/norm(n) for x in n]
        # sign so that fingertips (curled) count positive: use the thumb tip side? use middle tip
        hs=[sum((P[t][i]-P[0][i])*n[i] for i in range(3))*100 for t in [8,12,16,20,4]]
        print(f"{lab:7s} tip heights over palm plane (idx,mid,ring,pinky,thumb) cm: {['%.1f'%h for h in hs]}")
asyncio.run(run())
