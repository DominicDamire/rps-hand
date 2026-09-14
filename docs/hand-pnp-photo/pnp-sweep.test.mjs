import assert from 'node:assert/strict';
import {fitNeckSweep} from './neck-sweep.mjs';
const samples=[];
for(const elapsed of [-900,-800,-700,7200,7400,7600]){
 const z=elapsed<0?-.3:-.6;
 samples.push({elapsed,aspect:1,points:Array.from({length:21},()=>[0,0,z]),face:{neckContact:{neck:[0,0,-.6],palm:[0,0,-.6],shoulderDepth:.6,shoulderPoint:[0,0,-.6]}}});
}
const result=fitNeckSweep(samples);
assert.ok(result.fit,result.error);
assert.equal(result.fit.handScale,1);
assert.equal(result.fit.shoulderDistance,.6);
assert.ok(fitNeckSweep(samples.map(s=>({...s,points:null}))).error);
console.log('PASS: PnP sweep uses solved 3D endpoints without legacy palm-size observations; invalid positions rejected.');
