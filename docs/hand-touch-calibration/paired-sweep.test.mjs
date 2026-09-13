import assert from 'node:assert/strict';
import {PairedSweep,middleContactSample,fitPairedSweep,pairedSweepDepth} from './paired-sweep.mjs';
import {pairFrame} from './paired-sweep-fixture.mjs';
const sweep=new PairedSweep();sweep.begin(0);assert.match(sweep.update(0,[],null).message,/Starting in 5/);
for(let now=4000;now<13000;now+=100){const z=now<5000?.3:.3+(now-5000)/7900*.35;const result=sweep.update(now,pairFrame(z,now),null);assert.equal(result.done,undefined);}
const result=sweep.update(13000,[],null);assert.ok(result.done);assert.ok(result.samples);assert.equal(sweep.update(14000,[],null),null);
const report=fitPairedSweep(result.samples);assert.ok(report.fit,report.error);assert.ok(report.fit.residualMm<1);
const frozen=JSON.stringify(report.fit);
for(const z of [.3,.38,.5,.65])for(const [i,side] of ['L','R'].entries()){
 const h=pairFrame(z,0)[i],estimated=pairedSweepDepth(side,h.landmarks,1,report.fit,.9);assert.ok(Math.abs(estimated-z)<.001,'recover previously unseen depth from contact-calibrated palm span');
}
assert.equal(JSON.stringify(report.fit),frozen,'runtime evaluation never refits calibration');
assert.match(middleContactSample(pairFrame(.4,0).slice(0,1),0).reason,/both hands/);
const separated=pairFrame(.4,0);separated[1].landmarks[12].x+=.2;assert.ok(middleContactSample(separated,0).reason,'do not use a drawn/imagined connection over separated fingertips');
const wrongFinger=pairFrame(.4,0);wrongFinger[1].landmarks[12].x+=.2;wrongFinger[1].landmarks[8]={...wrongFinger[0].landmarks[8]};assert.ok(middleContactSample(wrongFinger,0).reason,'index contact cannot substitute for middle contact');
const stale=pairFrame(.4,0);assert.match(middleContactSample(stale,400).reason,/visible/);
const asyncPair=pairFrame(.4,0);asyncPair[1].time=1;assert.match(middleContactSample(asyncPair,0).reason,/same camera frame/);
sweep.begin(0);assert.equal(sweep.update(13000,[],null).samples,undefined,'always stop at the deadline with no tracking');
assert.ok(fitPairedSweep(result.samples.map(s=>({...s,values:result.samples[0].values}))).error,'stationary hands are not a depth sweep');
console.log('PASS: middle-only paired capture, one-way timing, unseen-depth recovery, frozen per-hand curves, stale/missing/non-touching rejection');
