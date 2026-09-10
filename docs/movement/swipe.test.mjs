import test from 'node:test';import assert from 'node:assert/strict';import {SwipeController} from './swipe.mjs';
const p=(x=.5,z=.5)=>({x,z,extended:true,pinch:.2});
function stroke(axis,end,duration=180){const c=new SwipeController();let yaw=0,dz=0,count=0;for(let i=0;i<=60;i++){let q=p();q[axis]+=(end)*Math.min(i*16/duration,1);const r=c.update(q,i*16);yaw+=r.yaw;dz+=r.dz;if(r.yaw||r.dz)count++;}return {c,yaw,dz,count};}
test('horizontal flick triggers exactly once and then holds still',()=>{const r=stroke('x',.3);assert.equal(r.count,1);assert.ok(r.yaw<0);assert.equal(r.dz,0);assert.ok(stroke('x',-.3).yaw>0);});
test('push moves back, pull moves forward in same mode',()=>{const push=stroke('z',-.15),pull=stroke('z',.15);assert.equal(push.count,1);assert.ok(push.dz>0);assert.ok(pull.dz<0);assert.equal(pull.yaw,0);});
test('slow finger following and tremor do not move',()=>{assert.equal(stroke('x',.3,2000).count,0);const c=new SwipeController();for(let i=0;i<100;i++){const r=c.update(p(.5+Math.sin(i)*.003,.5+Math.cos(i)*.004),i*16);assert.equal(r.yaw,0);assert.equal(r.dz,0);}});
test('return stroke and tracking loss do not rearm',()=>{const {c}=stroke('x',.3);c.update(null,1000);for(let i=0;i<20;i++)assert.equal(c.update(p(.8-i*.02),1020+i*16).yaw,0);});
test('deliberate release rearms next action',()=>{const {c}=stroke('x',.3);c.update({...p(),extended:false},1000);c.update({...p(),extended:false},1080);let yaw=0;for(let i=0;i<15;i++)yaw+=c.update(p(.5-i*.02),1100+i*16).yaw;assert.ok(yaw>0);});
test('single bad depth frame cannot step',()=>{const c=new SwipeController();c.update(p(),0);assert.equal(c.update(p(.5,.4),40).dz,0);assert.equal(c.update(p(),80).dz,0);});
test('missing depth does not block turning',()=>{const c=new SwipeController();let yaw=0;for(let i=0;i<15;i++)yaw+=c.update({...p(.5+i*.02),z:undefined},i*16).yaw;assert.ok(yaw<0);});
