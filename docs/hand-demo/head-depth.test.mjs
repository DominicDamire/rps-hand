import assert from 'node:assert/strict';
import {calibratedDepth,faceReference,eyeCenter,eyeCenters,faceImageSize,capturedFaceDepth} from './head-depth.mjs';
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

const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-80,1],face={points:pts,matrix},reference={size:.4,depth:.448};
assert.ok(Math.abs(faceImageSize(face,1)-.4)<1e-9);
assert.ok(Math.abs(capturedFaceDepth(face,1,reference)-.448)<1e-9);
const close={...face,points:pts.map(p=>p&&({...p,x:.5+2*(p.x-.5),y:.4+2*(p.y-.4)}))};
assert.ok(Math.abs(capturedFaceDepth(close,1,reference)-.224)<1e-9,'twice the face size means half the distance');
const turned={points:pts.map(p=>p&&({...p,x:.5+.5*(p.x-.5)})),matrix:[.5,0,Math.sqrt(.75),...matrix.slice(3)]};
assert.ok(Math.abs(capturedFaceDepth(turned,1,reference)-.448)<1e-9,'turning head does not impersonate receding');
assert.equal(capturedFaceDepth({points:[]},1,reference),null);
const saved=JSON.stringify(reference);capturedFaceDepth(close,1,reference);assert.equal(JSON.stringify(reference),saved);
console.log('PASS: head uses its own image-size ratio, rotation compensation, immutable capture and missing-face rejection');
