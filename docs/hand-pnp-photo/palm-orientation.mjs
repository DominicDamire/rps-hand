const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function frame(p){
 const y=sub(p[2],p[0]),x=sub(p[1],p[4]);
 const yn=Math.hypot(...y);if(yn<1e-6)return null;
 for(let i=0;i<3;i++)y[i]/=yn;
 const d=dot(x,y);for(let i=0;i<3;i++)x[i]-=d*y[i];
 const xn=Math.hypot(...x);if(xn<1e-6)return null;
 for(let i=0;i<3;i++)x[i]/=xn;
 return [x,y,cross(x,y)];
}
// Raw tracker world coordinates share OpenCV's right/down/forward camera axes.
// Do not construct this frame from image XY or depth-flattened display points.
export function observedPalmRotation(model,world){
 if(![0,5,9,13,17].every(i=>world?.[i]&&['x','y','z'].every(k=>Number.isFinite(world[i][k]))))return null;
 const a=frame(model),b=frame([0,5,9,13,17].map(i=>[world[i].x,world[i].y,world[i].z]));
 if(!a||!b)return null;
 return Array.from({length:9},(_,n)=>{const row=Math.floor(n/3),col=n%3;return b.reduce((s,v,k)=>s+v[row]*a[k][col],0);});
}
export function rotationDistance(a,b){return Math.acos(Math.max(-1,Math.min(1,(dot(a,b)-1)/2)));}
// Linear perspective translation fit with orientation held to the 3D observation.
// This remains observable when the five planar image landmarks become edge-on.
export function fitTranslation(model,lm,aspect,focal,R){
 const A=Array.from({length:3},()=>[0,0,0]),b=[0,0,0];
 for(const [j,id]of [0,5,9,13,17].entries()){
  const p=model[j],v=[0,1,2].map(k=>dot(R.slice(k*3,k*3+3),p));
  const u=(lm[id].x-.5)*aspect/focal,w=(lm[id].y-.5)/focal;
  for(const [a,c]of [[[1,0,-u],u*v[2]-v[0]],[[0,1,-w],w*v[2]-v[1]]])for(let i=0;i<3;i++){b[i]+=a[i]*c;for(let k=0;k<3;k++)A[i][k]+=a[i]*a[k];}
 }
 const rows=A.map((a,i)=>[...a,b[i]]);
 for(let i=0;i<3;i++){
  let p=i;for(let j=i+1;j<3;j++)if(Math.abs(rows[j][i])>Math.abs(rows[p][i]))p=j;
  [rows[i],rows[p]]=[rows[p],rows[i]];const d=rows[i][i];if(Math.abs(d)<1e-10)return null;
  for(let k=i;k<4;k++)rows[i][k]/=d;
  for(let j=0;j<3;j++)if(j!==i){const f=rows[j][i];for(let k=i;k<4;k++)rows[j][k]-=f*rows[i][k];}
 }
 const t=rows.map(r=>r[3]);return t.every(Number.isFinite)&&t[2]>.04&&t[2]<4?t:null;
}
