import assert from 'node:assert/strict';
import {imagePalmSize,sizeDepth,wallShift} from './size-wall-depth.mjs';
const palm=Array.from({length:21},(_,i)=>({x:.4+(i%5)*.015,y:.5+Math.floor(i/5)*.02}));
const size=imagePalmSize(palm,1.5),ref={size,depth:.5};
assert.equal(sizeDepth(size*2,ref),.25);assert.equal(sizeDepth(size/2,ref),1);
const spread=palm.map(p=>({...p}));for(const i of [4,8,12,16,20])spread[i].x+=.5;assert.equal(imagePalmSize(spread,1.5),size);
for(const wall of [-.4,-.8])for(const back of [-1,-.5,-.2]){const delta=wallShift(back,wall);assert.ok(back+delta>=wall-1e-12);if(back>=wall)assert.equal(delta,0);}
assert.equal(sizeDepth(null,ref,.6),.6);
console.log('PASS: inverse size ratio, fingertip-spread independence, wall boundary and invalid-input fallback');
