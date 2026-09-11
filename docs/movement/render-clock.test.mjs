import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderClock} from './render-clock.mjs';
test('60Hz rendering stays at 60 on 60, 75, 90, 120, 144 and 165Hz displays',()=>{
 for(const hz of [60,75,90,120,144,165]){const c=new RenderClock();let count=0,elapsed=0;
 for(let i=0;i<hz*4;i++){const dt=c.step(i*1000/hz);if(dt!==null){count++;elapsed+=dt;}}
 assert.ok(Math.abs(count-240)<=1,`${hz}Hz produced ${count} renders`);assert.ok(Math.abs(elapsed-4)<.04);
 }
});
test('slow frames render immediately without queuing catch-up frames after a pause',()=>{
 const c=new RenderClock();assert.notEqual(c.step(0),null);assert.equal(c.step(1),null);
 assert.equal(c.step(5000),.1);assert.equal(c.step(5001),null);assert.notEqual(c.step(5034),null);
 assert.equal(c.step(NaN),null);
});
