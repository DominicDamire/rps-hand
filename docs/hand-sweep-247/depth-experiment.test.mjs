import assert from 'node:assert/strict';
import {metricPalmDepth} from './depth-experiment.mjs';
const world=Array.from({length:21},(_,i)=>({x:i*.002,y:i*.003,z:0}));
const image=d=>world.map(p=>({x:.5+p.x/(2*Math.tan(Math.PI/6)*d),y:.5+p.y/(2*Math.tan(Math.PI/6)*d)}));
assert.ok(Math.abs(metricPalmDepth(image(.5),world,1)-.5)<1e-9);
assert.ok(Math.abs(metricPalmDepth(image(.25),world,1)-.25)<1e-9);
assert.equal(metricPalmDepth(world.map(()=>({x:.5,y:.5})),world,1,.7),.7);
console.log('Metric depth: known projection, approach, degenerate fallback passed');
