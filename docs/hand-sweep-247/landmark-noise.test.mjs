import assert from 'node:assert/strict';
import {LandmarkNoise} from './landmark-noise.mjs';
const f=new LandmarkNoise(),pts=x=>Array.from({length:21},()=>({x,y:.5,z:0}));
f.update(pts(.5),pts(0));
assert.equal(f.update(pts(.5005),pts(.0005)).lm[0].x,.5);
assert.equal(f.update(pts(.52),pts(.02)).lm[0].x,.52);
assert.equal(f.previous.world[0].x,.02);
console.log('Small noise held; deliberate motion copied without interpolation');
