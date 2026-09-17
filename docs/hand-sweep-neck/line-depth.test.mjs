import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPosition,projectCamera} from './projection.mjs';
import {liftFinger,closeFingertips,updateOKContact} from './line-depth.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const lengths=c=>c.slice(1).map((p,i)=>distance(p,c[i]));
const flatten=(chain,aspect)=>chain.map(p=>cameraPosition(projectCamera(p,aspect),.6,aspect));
function checkLengths(chain,lens){for(let k=1;k<4;k++)assert.ok(Math.abs(distance(chain[k],chain[k-1])-lens[k-1])<1e-8);}

test('recovers a curled chain with both toward-camera and away-camera segments',()=>{
 const chain=[[.03,.02,-.6],[.031,.064,-.58],[.032,.072,-.61],[.032,.048,-.62]];
 for(const aspect of [9/16,4/3,16/9]){
  const result=liftFinger({root:chain[0],observed:flatten(chain,aspect),lengths:lengths(chain),hints:chain,aspect});
  for(let i=0;i<4;i++)assert.ok(distance(result[i],chain[i])<1e-8);
  checkLengths(result,lengths(chain));
 }
});

test('anchors shifted roots while retaining screen segment vectors when feasible',()=>{
 const truth=[[.015,0,-.7],[.02,.027,-.675],[.027,.051,-.69],[.029,.071,-.695]],aspect=1.5;
 const observed=flatten(truth,aspect),root=[.016,0,-.7];
 const result=liftFinger({root,observed,lengths:lengths(truth),hints:truth,aspect});
 assert.deepEqual(result[0],root);checkLengths(result,lengths(truth));
 for(let i=1;i<4;i++){
  const a=projectCamera(result[i-1],aspect),b=projectCamera(result[i],aspect),s=projectCamera(observed[i-1],aspect),t=projectCamera(observed[i],aspect);
  assert.ok(Math.hypot(b.x-a.x-t.x+s.x,b.y-a.y-t.y+s.y)<1e-9);
 }
});

test('impossible image lengths produce finite fixed-length results, not stretched bones',()=>{
 const observed=[[0,0,-.5],[1,0,-.5],[2,0,-.5],[3,0,-.5]],lens=[.04,.03,.02];
 const result=liftFinger({root:observed[0],observed,lengths:lens,hints:observed,aspect:1});
 assert.ok(result.flat().every(Number.isFinite));checkLengths(result,lens);
 assert.ok(distance(result[3],observed[3])>1);
});

test('OK contact closes in 3D without moving either root or changing lengths',()=>{
 const a=[[-.045,0,-.6],[-.02,.02,-.59],[0,.026,-.575],[.012,.035,-.58]];
 const b=[[.035,.025,-.6],[.034,.061,-.62],[.015,.07,-.63],[.009,.046,-.628]];
 const la=lengths(a),lb=lengths(b),result=closeFingertips(a,b,la,lb);
 assert.deepEqual(result.a[0],a[0]);assert.deepEqual(result.b[0],b[0]);
 checkLengths(result.a,la);checkLengths(result.b,lb);assert.ok(result.gap<.0001);
});

test('unreachable contact leaves a reported gap without stretching',()=>{
 const a=[[0,0,-.6],[.02,0,-.6],[.04,0,-.6],[.06,0,-.6]],b=[[.3,0,-.6],[.28,0,-.6],[.26,0,-.6],[.24,0,-.6]];
 const result=closeFingertips(a,b,lengths(a),lengths(b));
 assert.equal(result.reachable,false);assert.ok(result.gap>.17);
 checkLengths(result.a,lengths(a));checkLengths(result.b,lengths(b));
});

test('straight chains can flex to achieve a shared contact point',()=>{
 const a=[[0,0,-.6],[.03,0,-.6],[.06,0,-.6],[.09,0,-.6]],b=[[.07,0,-.6],[.04,0,-.6],[.01,0,-.6],[-.02,0,-.6]];
 const result=closeFingertips(a,b,lengths(a),lengths(b));
 assert.ok(result.gap<.0001);checkLengths(result.a,lengths(a));checkLengths(result.b,lengths(b));
});

test('contact hysteresis releases and never changes other gesture pairs',()=>{
 const lm=Array.from({length:21},()=>({x:0,y:0}));lm[8].x=.02;
 assert.equal(updateOKContact(false,lm,480,360,true,12,20),true);
 lm[8].x=.035;assert.equal(updateOKContact(false,lm,480,360,true,12,20),false);
 assert.equal(updateOKContact(true,lm,480,360,true,12,20),true);
 lm[8].x=.05;assert.equal(updateOKContact(true,lm,480,360,true,12,20),false);
 assert.equal(updateOKContact(true,lm,480,360,false,12,20),false);
});
