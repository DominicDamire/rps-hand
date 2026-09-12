import assert from 'node:assert/strict';
import {calibratePalm,projectivePalmDepth,armObservation,fuseArmDepth,finishScan} from './arm-depth.mjs';
function hand(depth=.5,angle=0,aspect=1,shift=.12){
 const a=angle*Math.PI/180,world=Array.from({length:21},()=>({x:0,y:0,z:0}));
 for(const [i,x,y] of [[5,.035,-.06],[9,.012,-.075],[13,-.012,-.07],[17,-.032,-.052]])world[i]={x:x*Math.cos(a),y,z:-x*Math.sin(a)};
 return {world,landmarks:world.map(p=>({x:.5+(shift+p.x)/(depth+p.z)/aspect,y:.5+p.y/(depth+p.z),z:p.z}))};
}
for(const aspect of [.5625,1,1.777]){
 const ref=calibratePalm(hand(.5,0,aspect),.5,aspect);assert.ok(ref);
 for(const depth of [.22,.5,1,1.5])for(const angle of [-85,-60,0,45,85]){
  const result=projectivePalmDepth(hand(depth,angle,aspect),ref,aspect);
  assert.ok(result,`${depth}/${angle}`);assert.ok(Math.abs(result.depth-depth)<1e-8,JSON.stringify(result));
 }
}
assert.equal(projectivePalmDepth(hand(),null),null);
const observation={id:15,dz:-.2,upper:.3,forearm:.25,shoulder:.4,error:0,confidence:1};
const reference={...observation,dz:0};
const fused=fuseArmDepth(.35,observation,reference,.5,0);assert.ok(fused.depth<.35&&fused.depth>.3);
for(const age of [151,NaN,Infinity])assert.equal(fuseArmDepth(.35,observation,reference,.5,age).depth,.35);
assert.equal(fuseArmDepth(.35,{...observation,id:16},reference,.5,0).depth,.35);
assert.equal(fuseArmDepth(.35,{...observation,forearm:.6},reference,.5,0).depth,.35);
assert.equal(fuseArmDepth(.1,observation,reference,2,0).depth,.1);
const pose={points:{},world:{}};
for(const [i,x,y,z] of [[0,0,0,0],[11,-.2,.1,0],[12,.2,.1,0],[13,-.3,.35,0],[15,-.3,.49,-.1]]){pose.world[i]={x,y,z};pose.points[i]={x:.5+x,y:.5+y,z,visibility:1,presence:1};}
const detected={landmarks:[{x:.2,y:.99,z:0}]};assert.equal(armObservation(detected,pose).id,15);
pose.points[13].visibility=.2;assert.equal(armObservation(detected,pose),null);
const samples=Array.from({length:20},(_,i)=>({time:i*50,palm:{depth:.5,length:.07,focal:1},arm:reference}));
assert.ok(finishScan(samples)?.arm);assert.equal(finishScan(samples.slice(0,5)),null);
samples[10].palm.depth=.8;assert.equal(finishScan(samples),null);
console.log('PASS: 60 projection poses, scan stability, stale/occluded/wrong-arm rejection, bounded fusion');
