// Contact is a visual constraint, not measured monocular depth.
import {imagePalmSize} from './size-wall-depth.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),add=(a,b)=>a.map((v,i)=>v+b[i]);
const tips=new Set([4,8,12,16,20]);
export function contactSamples(lm,points){
 const samples=lm.map((p,i)=>({image:[p.x,p.y],point:points[i],tip:tips.has(i),key:String(i)}));
 for(let f=0;f<5;f++)for(let k=1;k<4;k++){const a=1+4*f+k-1,b=a+1;samples.push({image:[(lm[a].x+lm[b].x)/2,(lm[a].y+lm[b].y)/2],point:points[a].map((v,i)=>(v+points[b][i])/2),tip:false,key:a+'-'+b});}
 samples.push({image:[(lm[0].x+lm[9].x)/2,(lm[0].y+lm[9].y)/2],point:points[0].map((v,i)=>(v+points[9][i])/2),tip:false,key:'palm'});return samples;
}
export function findTouchPair(left,right,aspect=1,previousKey=null){
 const size=Math.min(imagePalmSize(left.lm,aspect)||0,imagePalmSize(right.lm,aspect)||0);
 if(size<=0)return null;const threshold=Math.max(.002,Math.min(.014,size*.13)),A=contactSamples(left.lm,left.points),B=contactSamples(right.lm,right.points);let best=null;
 for(const a of A)for(const b of B){if(!a.tip&&!b.tip&&!(a.key==='palm'&&b.key==='palm'))continue;
  const gap=Math.hypot((a.image[0]-b.image[0])*aspect,a.image[1]-b.image[1]),key=a.key+':'+b.key;
  if(gap>threshold*(key===previousKey?1.5:1))continue;
  const score=gap*(key===previousKey?.65:1);if(!best||score<best.score)best={a:a.point,b:b.point,key,score,gap};
 }return best;
}
export function solveTouchDepth(a,b,rootA,rootB,{maxDepthChange=.18,maxSideChange=.025,surfaceGap=.006}={}){
 if(![a,b,rootA,rootB].every(p=>p?.length===3&&p.every(Number.isFinite))||rootA[2]>=-.04||rootB[2]>=-.04)return null;
 const rayA=mul(rootA,1/-rootA[2]),rayB=mul(rootB,1/-rootB[2]),v=add(rayA,rayB),difference=sub(a,b);
 // Equal and opposite distance corrections retain the palm-size mean distance.
 const d=-dot(difference,v)/dot(v,v);if(Math.abs(d)>maxDepthChange)return null;
 let A=mul(rayA,d),B=mul(rayB,-d);if(rootA[2]+A[2]>-.04||rootB[2]+B[2]>-.04)return null;
 const residual=sub(add(a,A),add(b,B)),length=Math.hypot(...residual),amount=Math.max(0,length-surfaceGap)/2;
 if(amount>maxSideChange)return null;
 const settle=length?mul(residual,amount/length):[0,0,0];A=sub(A,settle);B=add(B,settle);
 return {A,B,gap:Math.min(length,surfaceGap),distanceCorrection:d};
}
