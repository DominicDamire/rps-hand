import test from 'node:test';import assert from 'node:assert/strict';import {ThumbJoystick} from './thumb-joystick.mjs';
const s=(x=.3,y=-.5,depth=-.8,bend=.8)=>({axes:[x,y,depth,bend]});
const ready=()=>{const c=new ThumbJoystick();for(const t of [0,90,180])c.receive(s(),t);return c;};
test('no movement while finding centre; arbitrary stationary thumb remains stopped',()=>{const c=new ThumbJoystick();for(const t of [0,90,180,250,350]){c.receive(s(.8,-.1),t);assert.equal(c.direction,null);}});
test('depth and bend noise cannot produce backward drift',()=>{const c=ready();for(const d of [-1,-.8,-.5,0,1]){c.receive(s(.3,-.5,d,.1),200);assert.deepEqual(c.step(210,.02),{dx:0,dz:0});}});
test('all four directions and diagonals work relative to automatic centre',()=>{for(const [x,y,expected] of [[.75,-.5,'LEFT'],[-.15,-.5,'RIGHT'],[.3,-.9,'FORWARD'],[.3,-.1,'BACKWARD'],[-.15,-.1,'BACKWARD RIGHT']]){const c=ready();c.receive(s(x,y),200);assert.equal(c.direction,expected);assert.ok(Math.hypot(c.x,c.z)<=1.000001);}});
test('fist stops and requires a fresh stable centre before any resumed motion',()=>{const c=ready();c.receive(s(.3,-.1),200);c.receive({...s(),rest:true},220);assert.equal(c.direction,null);c.receive(s(.9,-.2),240);assert.equal(c.direction,null);});
test('missing or stale tracking stops rather than retaining walking input',()=>{const c=ready();c.receive(s(.3,-.1),200);assert.deepEqual(c.step(551,.02),{dx:0,dz:0});c.receive(null,600);assert.equal(c.direction,null);});
