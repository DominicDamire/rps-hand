import assert from 'node:assert/strict';
import {solveTouchDepth,findTouchPair,closeContact} from './hand-pair-depth.mjs';
const add=(a,b)=>a.map((v,i)=>v+b[i]);
for(const distance of [.2,.4,.7]){
 const a=[0,0,-distance+.05],b=[0,0,-distance-.05],A=[-.04,0,-distance+.05],B=[.04,0,-distance-.05],fit=solveTouchDepth(a,b,A,B);
 assert.ok(fit);assert.ok(Math.hypot(...add(a,fit.A).map((v,i)=>v-add(b,fit.B)[i]))<=.006000001);

 const segment=[.01,.03,-.02];assert.deepEqual(add(add(a,segment),fit.A).map((v,i)=>+(v-add(a,fit.A)[i]).toFixed(8)),segment,'rigid translation preserves bone geometry');
}
assert.equal(solveTouchDepth([0,0,-.1],[0,0,-1],[0,0,-.1],[0,0,-1]),null,'reject ambiguous excessive depth discrepancy');
assert.equal(solveTouchDepth([NaN,0,0],[0,0,-.5],[0,0,-.5],[0,0,-.5]),null);
const lm=Array.from({length:21},(_,i)=>({x:.2+i*.003,y:.3+i*.004}));
const far=lm.map(p=>({...p,x:p.x+.5})),pts=lm.map(p=>[p.x,p.y,-.4]);
assert.equal(findTouchPair({lm,points:pts},{lm:far,points:pts}),null,'separated image landmarks never attach');
const near=far.map(p=>({...p}));near[8]={...lm[8]};
assert.ok(findTouchPair({lm,points:pts},{lm:near,points:pts}),'visible fingertip contact provides candidate');
const leftRoot=[-.14,0,-.6],rightRoot=[.14,0,-.6],leftTip=[-.04,0,-.6],rightTip=[.04,0,-.6];
const shared=solveTouchDepth(leftTip,rightTip,leftRoot,rightRoot);assert.ok(shared);
assert.ok(shared.depthA<.5&&shared.depthB<.5,'both hands must move closer together when the common depth is too far');
assert.ok(Math.hypot(...add(leftTip,shared.A).map((v,i)=>v-add(rightTip,shared.B)[i]))<=.0010001,'close the visible fingertip gap');
console.log('PASS: shared camera-distance correction, near/far contact, rigid bone geometry, invalid estimates and image separation');

const almost=far.map(p=>({...p}));almost[8]={...lm[8],y:lm[8].y+.01};
assert.equal(findTouchPair({lm,points:pts},{lm:almost,points:pts},1,null,{rangePercent:2}),null,'small detection range rejects a visible gap');
assert.ok(findTouchPair({lm,points:pts},{lm:almost,points:pts},1,null,{rangePercent:50}),'larger detection range accepts the same gap');
assert.equal(solveTouchDepth([0,0,-.5],[0,.08,-.5],[-.1,0,-.5],[.1,0,-.5],{maxSideChange:.01}),null,'sideways correction limit is enforced');
assert.ok(solveTouchDepth([0,0,-.5],[0,.08,-.5],[-.1,0,-.5],[.1,0,-.5],{maxSideChange:.05}),'raising sideways limit permits the same correction');

const easedA=shared.A.map(v=>v*.5),easedB=shared.B.map(v=>v*.5),closed=closeContact(leftTip,rightTip,easedA,easedB,.001);assert.ok(Math.hypot(...add(leftTip,closed.A).map((v,i)=>v-add(rightTip,closed.B)[i]))<=.00100001,'easing cannot reopen a confirmed contact');
