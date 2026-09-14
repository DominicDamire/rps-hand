import assert from 'node:assert/strict';import {frontReference,FrontCapture}from './front-reference.mjs';
const lm=[{x:.5,y:.85,z:0}];for(let f=0;f<5;f++)for(let k=0;k<4;k++)lm.push({x:f===0?.36-k*.04:.36+(f-1)*.09,y:f===0?.76-k*.06:.61-k*.105,z:0});
const hand={confidence:.99,label:'Right',landmarks:lm,world:lm.map(p=>({...p})),time:0};
assert.ok(frontReference(hand).points);const mirror={...hand,label:'Left',landmarks:lm.map(p=>({...p,x:1-p.x})),world:lm.map(p=>({...p,x:1-p.x}))};
assert.deepEqual(frontReference(hand).points.map(p=>p.map(v=>+v.toFixed(6))),frontReference(mirror).points.map(p=>p.map(v=>+v.toFixed(6))));
assert.ok(frontReference({...hand,confidence:.2}).error);
assert.ok(frontReference({...hand,world:lm.map(p=>({...p,z:p.x*10}))}).error);
const c=new FrontCapture();for(let i=0;i<30;i++)assert.equal(c.update(hand,1,i*100).points,undefined);
c.reset();let r;for(let i=0;i<20;i++)r=c.update({...hand,time:i},1,i*100);assert.ok(r.points);
console.log('PASS: frontal capture, mirrored-hand equivalence, tilted/uncertain rejection, duplicate frames cannot complete, stable distinct frames complete.');

const bent=lm.map(p=>({...p}));bent[8]={...bent[5]};assert.ok(frontReference({...hand,world:bent}).error);
assert.ok(frontReference({...hand,world:lm.map(p=>({...p,z:NaN}))}).error);
assert.ok(frontReference({...hand,world:lm.map(()=>({x:0,y:0,z:0}))}).error);
