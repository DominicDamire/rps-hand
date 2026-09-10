import test from 'node:test';import assert from 'node:assert/strict';import {ThumbJoystick,measureThumb,fitThumbCalibration} from './thumb-joystick.mjs';
// A biased, coupled tracker: neither raw horizontal nor bend is a movement axis.
const sample=(x=0,z=0)=>({axes:[.65+.4*x+.15*z,-.3+.12*x+.5*z,.2-.2*x+.3*z,.93+.03*x-.08*z]});
const setup=()=>{const c=new ThumbJoystick();c.configure([sample(),sample(-1),sample(1),sample(0,-1),sample(0,1)]);c.receive(sample(),0);return c;};
test('no movement before setup, even with the old always-forward bend',()=>{const c=new ThumbJoystick();c.receive(sample(1,-1),10);assert.deepEqual(c.step(20,.02),{dx:0,dz:0});});
test('biased centre is stationary and all four directions are reachable without cross-axis drift',()=>{const c=setup();assert.equal(c.direction,null);for(const [x,z] of [[-1,0],[1,0],[0,-1],[0,1]]){c.receive(sample(x,z),10);assert.ok(Math.abs(c.x-x)<.02);assert.ok(Math.abs(c.z-z)<.02);}});
test('backward diagonals work and diagonal speed is capped',()=>{const c=setup();for(const x of [-1,1]){c.receive(sample(x,1),20);assert.equal(Math.sign(c.x),x);assert.ok(c.z>.5);assert.ok(Math.hypot(c.x,c.z)<=1.00001);}});
test('tracking loss preserves calibration and requires centre before resuming',()=>{const c=setup(),cal=c.calibration;c.receive(sample(-1),10);c.receive(null,20);assert.equal(c.calibration,cal);c.receive(sample(1),30);assert.equal(c.direction,null);c.receive(sample(),40);c.receive(sample(-1),50);assert.ok(c.x<-.9);assert.deepEqual(c.step(401,.02),{dx:0,dz:0});assert.equal(c.calibration,cal);});
test('setup does not walk in the final backward position until centred',()=>{const c=setup();c.reset();c.receive(sample(0,1),1);assert.equal(c.direction,null);c.receive(sample(),2);c.receive(sample(0,1),3);assert.ok(c.z>.9);});
test('indistinguishable directions reject calibration instead of guessing',()=>{assert.throws(()=>fitThumbCalibration([sample(),sample(1),sample(1),sample(1),sample(1)]));assert.throws(()=>fitThumbCalibration(Array(5).fill(sample())));});
test('invalid landmarks stop',()=>assert.equal(measureThumb([],[]),null));
