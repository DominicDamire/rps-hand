import test from 'node:test';
import assert from 'node:assert/strict';
import {stableHands} from './hand-identity.mjs';
const hand=(label,x,seen)=>({label,seen,landmarks:Array.from({length:21},(_,i)=>({x:x+i*.002,y:.4+i*.001}))});
test('label flip does not create ghost hand',()=>{const m=new Map();stableHands([hand('Right',.3,0)],m,0,1000);const h=stableHands([hand('Left',.31,40)],m,40,1000);assert.equal(h.length,1);assert.equal(h[0].label,'Right');});
test('two hands survive simultaneous label swap',()=>{const m=new Map();stableHands([hand('Right',.2,0),hand('Left',.7,0)],m,0,1000);const h=stableHands([hand('Left',.21,40),hand('Right',.69,40)],m,40,1000);assert.equal(h.length,2);assert.equal(h[0].label,'Right');assert.equal(h[1].label,'Left');});
test('duplicate overlapping detections collapse',()=>{assert.equal(stableHands([hand('Right',.3,0),hand('Left',.301,0)],new Map(),0,1000).length,1);});
test('brief loss holds separate hand, then expires',()=>{const m=new Map();stableHands([hand('Right',.2,0),hand('Left',.7,0)],m,0,200);assert.equal(stableHands([hand('Right',.21,40)],m,40,200).length,2);assert.equal(stableHands([hand('Right',.22,250)],m,250,200).length,1);});
test('new same-labelled second hand gets unused identity',()=>{const m=new Map();stableHands([hand('Right',.7,0)],m,0,1000);const h=stableHands([hand('Right',.2,40),hand('Right',.71,40)],m,40,1000);assert.equal(h.length,2);assert.equal(h.find(p=>p.landmarks[0].x===.71).label,'Right');});

test('prediction preserves finger pose, stops moving and expires',()=>{const m=new Map();stableHands([hand('Right',.2,0)],m,0,1000);stableHands([hand('Right',.21,40)],m,40,1000);const a=stableHands([],m,100,1000)[0],b=stableHands([],m,400,1000)[0],c=stableHands([],m,600,1000)[0];assert.equal(a.predicted,true);assert.equal(a.seen,40);assert.ok(a.landmarks[0].x>.21);assert.ok(b.landmarks[0].x-.21<=.03);assert.equal(b.landmarks[0].x,c.landmarks[0].x);assert.ok(Math.abs((a.landmarks[8].x-a.landmarks[0].x)-.016)<1e-10);assert.equal(stableHands([],m,1100,1000).length,0);});
