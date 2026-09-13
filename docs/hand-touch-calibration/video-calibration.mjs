const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
export function fitVideoCalibration(rows){
 const valid=rows.filter(r=>r.sizeL>0&&r.sizeR>0&&r.zL>0&&r.zR>0);
 if(valid.length<20)return null;
 const far=[...valid].sort((a,b)=>(b.zL+b.zR)-(a.zL+a.zR)).slice(0,Math.max(10,Math.floor(valid.length*.25)));
 const ratios=far.map(r=>r.neckRatio).filter(v=>Number.isFinite(v)&&v>.25&&v<4);
 const curves={};
 for(const side of ['L','R']){const pairs=valid.map(r=>[1/r['size'+side],r['z'+side]]);let sw=0,sx=0,sy=0,sxx=0,sxy=0;for(const [x,y]of pairs){sw++;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}const det=sw*sxx-sx*sx;if(det<1e-8)return null;const b=(sw*sxy-sx*sy)/det,a=(sy-b*sx)/sw;if(b<=0)return null;curves[side]={a,b};}
 return {curves,headScale:ratios.length>=8?median(ratios):1,headSamples:ratios.length,frames:valid.length};
}
export function videoDepth(fit,side,size,fallback){const c=fit?.curves?.[side],z=c&&size>0?c.a+c.b/size:NaN;return Number.isFinite(z)&&z>.06&&z<2.5?z:fallback;}
