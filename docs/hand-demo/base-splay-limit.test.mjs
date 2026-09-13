import assert from 'node:assert/strict';
import {limitBaseSplay} from './base-splay-limit.mjs';
const rad=Math.PI/180,dir=(bend,splay)=>[Math.sin(splay*rad),Math.cos(bend*rad)*Math.cos(splay*rad),Math.sin(bend*rad)*Math.cos(splay*rad)];
for(const sign of [-1,1])for(const bend of [0,30,52,54,56,70,80,95])for(const spread of [-25,0,25]){
 const input=dir(bend,spread);input[0]*=sign;const actual=limitBaseSplay(input,[0,1,0],[sign,0,0]);
 assert.ok(Math.abs(Math.hypot(...actual)-1)<1e-10);
 assert.ok(Math.abs(Math.atan2(actual[2],actual[1])/rad-bend)<1e-8,'preserve bend');
 if(bend<=52)assert.ok(Math.hypot(...actual.map((v,i)=>v-input[i]))<1e-10,'open fingers keep their splay');
 if(bend>=56)assert.ok(Math.abs(actual[0])<1e-10,'no sideways motion at 70% or more');
}
const a=limitBaseSplay(dir(55.999,25),[0,1,0],[1,0,0]),b=limitBaseSplay(dir(56.001,25),[0,1,0],[1,0,0]);
assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<.0001,'continuous threshold');
assert.deepEqual(limitBaseSplay([0,0,0],[0,1,0],[1,0,0]),[0,0,0]);
console.log('PASS: mirrored hands, 70% threshold, preserved bend, open-hand freedom and continuous transition');
