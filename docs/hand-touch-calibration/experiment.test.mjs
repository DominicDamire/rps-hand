import assert from 'node:assert/strict';import {fitSweep,sweepDepth} from './experiment.mjs';
const lm=scale=>Array.from({length:21},(_,i)=>({x:.4+(i%5)*.02*scale,y:.4+Math.floor(i/5)*.02*scale,z:0}));
const samples=Array.from({length:80},(_,i)=>({elapsed:i*100,landmarks:lm(i<20?2:i>=60?1:1.5),face:{raw:.7,depth:.7,neckDepth:.65,handDepth:.3}}));
const fit=fitSweep(samples,1);assert.ok(fit);assert.ok(Math.abs(sweepDepth(lm(2),1,fit,.5)-.3)<1e-9,'starting position is retained exactly');assert.ok(Math.abs(sweepDepth(lm(1),1,fit,.5)-.65)<1e-9,'neck endpoint maps to captured plane');assert.ok(sweepDepth(lm(1.5),1,fit,.5)>.3&&sweepDepth(lm(1.5),1,fit,.5)<.65);const saved=JSON.stringify(fit);sweepDepth(lm(.8),1,fit,.5);assert.equal(JSON.stringify(fit),saved,'no live refitting');assert.equal(fitSweep([],1),null);assert.equal(fitSweep(samples.map(s=>({...s,landmarks:lm(1)})),1),null);
console.log('PASS: one-hand two-endpoint map preserves starting distance, reaches neck plane, interpolates continuously and never refits live');

const moving=samples.map((s,i)=>({...s,landmarks:lm(i<5?2:i>=75?1:1.5)}));
const endpointFit=fitSweep(moving,1);assert.ok(endpointFit);
assert.ok(Math.abs(sweepDepth(lm(2),1,endpointFit,.5)-.3)<1e-9,'first half-second anchors start, not two seconds of moving hand');
assert.ok(Math.abs(sweepDepth(lm(1),1,endpointFit,.5)-.65)<1e-9,'last half-second anchors neck endpoint');
assert.equal(fitSweep(moving.filter(s=>s.elapsed>=500),1),null,'missing real start cannot silently use mid-sweep samples');
console.log('PASS: endpoint windows exclude middle motion');
