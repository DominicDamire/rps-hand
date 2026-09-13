import assert from 'node:assert/strict';
import {TrackingJitter} from './tracking-jitter.mjs';
const filter=new TrackingJitter(),packet=(i,x)=>({time:i*1000/30,landmarks:[[{x,y:0,z:0}]],worldLandmarks:[[{x,y:0,z:0}]],handedness:[[{categoryName:'Left'}]]});
let raw=[],filtered=[];for(let i=0;i<120;i++){const x=.5+.002*Math.sin(i*2.3),p=packet(i,x),out=filter.filter(p);if(i>20){raw.push(x-.5);filtered.push(out.landmarks[0][0].x-.5);}assert.equal(filter.filter(p),out,'duplicate frames are not filtered repeatedly');}
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length),ratio=rms(filtered)/rms(raw);assert.ok(ratio<.65);
filter.reset();let last=0;for(let i=0;i<60;i++){const x=.2+i*.01;last=filter.filter(packet(i,x)).landmarks[0][0].x;}assert.ok(.79-last<.025,'steady motion lag stays below 2.5 frames');
assert.equal(filter.filter(packet(0,.1)).landmarks[0][0].x,.1,'backward seeks reset the filter');console.log('PASS: stationary noise RMS ratio',ratio.toFixed(3),'and bounded ramp lag');
