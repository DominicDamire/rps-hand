import assert from 'node:assert/strict';
import {calibratedDepth,faceReference,eyeCenter,eyeCenters} from './head-depth.mjs';
assert.equal(calibratedDepth(.7,.7,.4),.4);
assert.equal(calibratedDepth(1.4,.7,.4),.8);
assert.equal(calibratedDepth(1.4,.7,.4,0),.4);
assert.equal(calibratedDepth(.35,.7,.4),.2);
assert.equal(calibratedDepth(NaN,.7,.4),null);
assert.equal(calibratedDepth(.3,0,.4),null);
assert.equal(faceReference({matrix:Array.from({length:16},(_,i)=>i===14?-40:0)}),.4);
assert.equal(eyeCenter([]),null);
console.log('PASS shared depth reference: fixed calibration, near/far movement, zero sensitivity and invalid estimates');

const pts=[];pts[33]={x:.2,y:.4};pts[133]={x:.4,y:.4};pts[263]={x:.8,y:.4};pts[362]={x:.6,y:.4};
const eyes=eyeCenters(pts);assert.ok(Math.abs(eyes[1].x-eyes[0].x-.4)<1e-9);assert.deepEqual(eyeCenter(pts),{x:.5,y:.4});
console.log('PASS head size uses matching eye centres, not outer corners');
