import assert from 'node:assert/strict';
import {ExtendedReferenceCapture,referenceDepth,validReference} from './extended-reference.mjs';
const lm=Array.from({length:21},(_,i)=>({x:.4+(i%5)*.02,y:.4+Math.floor(i/5)*.02,z:0}));
const face={raw:.8,depth:.7,size:.09,modelEyeSpan:.063};
const points=lm.map(p=>({x:(p.x-.4)*.5,y:(p.y-.4)*.5,z:-.32}));
function capture(label='Left',data=face){
 const c=new ExtendedReferenceCapture(),rendered={[label==='Left'?'L':'R']:{result:{points}}};c.begin(0);
 assert.match(c.update(0,[],null,1,{}).message,/Starting in 5/);
 for(let n=5000;n<6500;n+=100)c.update(n,[{label,time:n,seen:n,confidence:.9,landmarks:lm}],data,1,rendered);
 const result=c.update(6500,[],null,1,{});assert.equal(c.update(6600,[],null,1,{}),null);return result.reference;
}
const r=capture();assert.ok(validReference(r));assert.equal(r.version,3);
assert.equal(r.depth,.32,'captured hand stays at its existing depth');
assert.ok(Math.abs(r.face.depth-.448)<1e-9,'head fitted from hand camera scale and model/image proportions');
assert.notEqual(r.face.depth,face.depth,'head no longer blindly retains old distance');
assert.equal(r.face.size,.09);assert.equal(r.face.mode,'size');
assert.deepEqual(capture('Right'),r,'either extended hand captures the same shared reference');
assert.deepEqual(capture('Left',{...face,depth:2}),r,'old head distance does not change the fit');
for(const label of ['Left','Right'])assert.equal(referenceDepth(lm,null,1,r,.9),.32,label+' uses the common reference');
const big=lm.map(p=>({...p,x:.4+(p.x-.4)*2,y:.4+(p.y-.4)*2}));
assert.ok(Math.abs(referenceDepth(big,null,1,r,.5)-.16)<1e-8);assert.equal(referenceDepth(null,null,1,r,.5),.5);
assert.equal(capture('Left',null),undefined);assert.equal(capture('Left',{...face,size:0}),undefined);
assert.equal(validReference({version:1,size:1,depth:.5}),false);
assert.equal(validReference({...r,version:2,face:{raw:.8,depth:.7}}),true,'previous saved reference retained until recapture');
console.log('PASS: one capture for either/both hands, wrist preserved, head fitted from shared camera scale, no manual input or old-head-depth dependence, missing-face rejection');
