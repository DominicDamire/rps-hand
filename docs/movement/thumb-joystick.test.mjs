import test from 'node:test';import assert from 'node:assert/strict';import {ThumbJoystick} from './thumb-joystick.mjs';
const s=(x=0,y=0,rest=false)=>({position:{x,y},rest});
const ready=()=>{const c=new ThumbJoystick();for(const t of [0,80,160])c.receive(s(),t);return c;};
test('stable starting thumb centres without walking',()=>{const c=new ThumbJoystick();for(const t of [0,80,160,240]){c.receive(s(.4,.9),t);assert.equal(c.direction,null);}});
test('four axes and diagonal stick input remain available',()=>{for(const [x,y,name] of [[.4,0,'LEFT'],[-.4,0,'RIGHT'],[0,.4,'FORWARD'],[0,-.4,'BACKWARD'],[-.4,-.4,'BACKWARD RIGHT']]){const c=ready();c.receive(s(x,y),240);assert.equal(c.direction,name);assert.ok(Math.hypot(c.x,c.z)<=1);}});
test('centre dead zone stops without deceleration drift',()=>{const c=ready();c.receive(s(0,-.4),240);assert.ok(c.z>0);c.receive(s(.01,.01),300);assert.deepEqual(c.step(320,.02),{dx:0,dz:0});});
test('fist and tracking loss stop immediately',()=>{for(const next of [s(.5,.5,true),null]){const c=ready();c.receive(s(0,-.4),240);c.receive(next,260);assert.equal(c.direction,null);}const c=ready();c.receive(s(0,-.4),240);assert.deepEqual(c.step(421,.02),{dx:0,dz:0});});
test('extra inferred depth values cannot affect planar walking',()=>{const c=ready();for(const depth of [-1,0,1]){c.receive({...s(),depth},240);assert.equal(c.direction,null);}});
