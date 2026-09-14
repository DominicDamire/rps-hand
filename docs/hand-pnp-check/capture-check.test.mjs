import assert from 'node:assert/strict';
import {StableCapture,contactCheck} from './capture-check.mjs';
import {fitNeckSweep} from './neck-sweep.mjs';
const c=new StableCapture();
assert.equal(c.update(9000,null,'Outside frame').done,false);
const sample=t=>({time:t,points:[[0,0,-.4]]});
for(let t=10000;t<12000;t+=100)assert.equal(c.update(t,sample(t)).done,false);
assert.equal(c.update(12000,sample(12000)).done,true);
c.reset();c.update(0,sample(0));assert.equal(c.update(3000,sample(0)).done,false);
assert.equal(c.update(3100,null,'Lost tracking').progress,0);
c.reset();c.update(0,sample(0));assert.equal(c.update(1900,{time:1900,points:[[.1,0,-.4]]}).progress,0);
const hands=['Left','Right'].map(label=>({label,landmarks:Array.from({length:21},()=>({x:.5,y:.5}))}));
const rendered={L:{result:{points:Array.from({length:21},()=>({x:0,y:0,z:-.4}))}},R:{result:{points:Array.from({length:21},()=>({x:.04,y:0,z:-.4}))}}};
assert.equal(contactCheck(hands,rendered).passed,false);
assert.equal(rendered.R.result.points[8].x,.04);
const samples=[];for(const elapsed of [-900,-800,-700,7200,7400,7600]){const z=elapsed<0?-.3:-.7;samples.push({elapsed,aspect:1,points:Array.from({length:21},()=>[0,0,z]),face:{neckContact:{neck:[0,0,-.5],palm:[0,0,-.7],shoulderDepth:.5,shoulderPoint:[0,0,-.5]}}});}
const {fit,error}=fitNeckSweep(samples);assert.ok(fit,error);assert.notEqual(fit.handScale,1);
assert.ok(Math.abs(-.7*fit.handScale-(-.5*fit.headScale+fit.headOffset[2]))<1e-9);
console.log('PASS: waits for valid start; duplicate frames do not complete; motion/loss resets; contact check does not move hands; nontrivial calibration aligns modeled endpoints.');
