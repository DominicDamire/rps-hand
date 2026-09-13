// Fit one rigid translation using all 21 landmarks. Joint angles and lengths
// are already solved; fingers cannot independently drag toward another hand.
export function fitWholeHand(points,lm,aspect,focal){
 if(!points?.length||!lm||!(aspect>0&&focal>0))return null;
 const palm=new Set([0,5,9,13,17]),root=points[0],rows=[];
 for(let i=0;i<21;i++){const p=points[i],l=lm[i];if(!p?.every(Number.isFinite)||!l||!Number.isFinite(l.x)||!Number.isFinite(l.y)||l.x<-.04||l.x>1.04||l.y<-.04||l.y>1.04)continue;
  const d=p.map((v,k)=>v-root[k]),u=(l.x-.5)*aspect/focal,v=(.5-l.y)/focal;
  rows.push({d,u,v,w:palm.has(i)?1:5/16});
 }
 if(rows.length<17)return null;
 let t=[...root];
 for(let iteration=0;iteration<3;iteration++){
  const A=Array.from({length:3},()=>[0,0,0]),B=[0,0,0];
  for(const r of rows){const z=-(t[2]+r.d[2]);if(z<=.01)return null;
   const error=Math.hypot((t[0]+r.d[0])/z-r.u,(t[1]+r.d[1])/z-r.v)*focal;
   const weight=r.w*Math.min(1,.015/Math.max(error,1e-9))/(z*z);
   for(const [a,b] of [[[1,0,r.u],-r.d[0]-r.u*r.d[2]],[[0,1,r.v],-r.d[1]-r.v*r.d[2]]])for(let j=0;j<3;j++){B[j]+=weight*a[j]*b;for(let k=0;k<3;k++)A[j][k]+=weight*a[j]*a[k];}
  }
  const m=A.map((a,i)=>[...a,B[i]]);
  for(let j=0;j<3;j++){let pivot=j;for(let k=j+1;k<3;k++)if(Math.abs(m[k][j])>Math.abs(m[pivot][j]))pivot=k;[m[j],m[pivot]]=[m[pivot],m[j]];const v=m[j][j];if(Math.abs(v)<1e-10)return null;for(let k=j;k<4;k++)m[j][k]/=v;for(let i=0;i<3;i++)if(i!==j){const f=m[i][j];for(let k=j;k<4;k++)m[i][k]-=f*m[j][k];}}
  t=m.map(r=>r[3]);
 }
 if(!t.every(Number.isFinite)||-t[2]<.04||-t[2]>4)return null;
 return t.map((v,k)=>v-root[k]);
}
