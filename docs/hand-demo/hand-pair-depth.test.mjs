import assert from 'node:assert/strict';
import {solveTouchDepth,findTouchPair} from './hand-pair-depth.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]);
for(const distance of [.2,.4,.7]){
 const a=[0,0,-distance+.05],b=[0,0,-distance-.05],A=[-.04,0,-distance+.05],B=[.04,0,-distance-.05],fit=solveTouchDepth(a,b,A,B);
 assert.ok(fit);assert.ok(Math.hypot(...add(a,fit.A).map((v,i)=>v-add(b,fit.B)[i]))<=.006000001);
 assert.ok(Math.abs(fit.A[2]+fit.B[2])<1e-10,'preserve mean size-derived distance');
 const segment=[.01,.03,-.02];assert.deepEqual(add(add(a,segment),fit.A).map((v,i)=>+(v-add(a,fit.A)[i]).toFixed(8)),segment,'rigid translation preserves bone geometry');
}
assert.equal(solveTouchDepth([0,0,-.1],[0,0,-1],[0,0,-.1],[0,0,-1]),null,'reject ambiguous excessive depth discrepancy');
assert.equal(solveTouchDepth([NaN,0,0],[0,0,-.5],[0,0,-.5],[0,0,-.5]),null);
const lm=Array.from({length:21},(_,i)=>({x:.2+i*.003,y:.3+i*.004}));
const far=lm.map(p=>({...p,x:p.x+.5})),pts=lm.map(p=>[p.x,p.y,-.4]);
assert.equal(findTouchPair({lm,points:pts},{lm:far,points:pts}),null,'separated image landmarks never attach');
const near=far.map(p=>({...p}));near[8]={...lm[8]};
assert.ok(findTouchPair({lm,points:pts},{lm:near,points:pts}),'visible fingertip contact provides candidate');
console.log('PASS: near/far contact, mean distance, rigid bone geometry, excessive-depth rejection, invalid data and image separation');
